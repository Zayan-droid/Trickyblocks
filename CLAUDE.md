# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server (defaults to port 5173, falls back if taken; honors `PORT` env).
- `npm run build` — type-checks (`tsc -b`) then produces a production build with Vite.
- `npm run lint` — `tsc -b --noEmit`. This is the only "lint" — there is no ESLint config, so type-checking is the gate. Run it before committing.
- `npm run preview` — serve the built `dist/` locally.

There is **no test runner** in this project (no Jest/Vitest, no test files). Don't invent test commands; verify changes by running the app.

## Deployment

Hosted on Vercel (project `trickyblocks`). The repo is linked to the GitHub remote with auto-deploy: **pushing to `main` triggers a production deploy** that the canonical alias `https://trickyblocks.vercel.app` points at. `vercel.json` supplies the SPA rewrite (all routes → `/index.html`) needed for client-side react-router.

## Path alias

`@` resolves to `src/` (configured in `vite.config.ts` and `tsconfig`). Import app modules as `@/game/...`, `@/store/...`, etc.

## Architecture

A physics-based block-stacking game. **The game itself is an imperative engine that runs outside React**; React only renders the menu/HUD chrome and forwards input.

### The engine ↔ React boundary (most important thing to understand)

`src/game/engine.ts` (`GameEngine`) owns the canvas, the Matter.js world, the `requestAnimationFrame` loop, scoring, difficulty, the tray, and all VFX. It knows nothing about React.

`src/screens/GameScreen.tsx` is the glue:
- Instantiates **one** `GameEngine` in a `useEffect` (empty deps — created once per mount), wiring `EngineCallbacks` (`onScore`, `onCombo`, `onTray`, `onLost`, …) that push values into the Zustand `gameStore`.
- Holds the engine in a `useRef`; UI actions call methods on it: drag input (`beginDrop` / `setPointer` / `releaseDrop` / `cancelDrop`) and power-ups (`triggerUndo` / `triggerShuffle` / `triggerPin`).
- React components (`HUD`, `BlockTray`, `ActionsTray`, overlays) sit on top of the `<canvas>` and read from the store.

So: **engine → store → React for state; React → engine methods for input.** When adding gameplay, put logic in the engine and surface it through a callback + a store field, not in React.

### State (Zustand, `src/store/`)

- `gameStore` — transient per-session state (score, combo, tray, phase, current `platform`/`challenge`). **Not persisted**; `resetGame()` clears it.
- `settingsStore` — volumes, `reduceMotion`, `theme`, etc. **Persisted** to `localStorage` key `tricky-blocks-settings`.
- `progressStore` — high scores, endless level reached, challenge/daily history. **Persisted** to `tricky-blocks-progress`.

### Game modules (`src/game/`)

- `physicsWorld.ts` — Matter.js wrapper. Note the deliberate design: **there are no side walls** — blocks that slide off the platform fall into the void and get swept by a fallen-block check. `platformProps()` maps each `PlatformType` to friction/restitution (e.g. `ice` → friction `0.02`). Tetrominoes are built as single or compound bodies.
- `shapes.ts` — tetromino geometry (`I O T S Z L J`) in unit-cell coords. **Critical gotcha:** Matter's `body.position` is the *centroid*, but outlines are anchored at the *geometric center*; the renderer translates by `centroidOffsetFor(...)` to align visuals with physics. Touch this carefully when editing shapes or rendering.
- `blockFactory.ts` — generates `BlockSpec`s; `seededRng` gives deterministic sequences for challenges/dailies (seeded from the challenge id).
- `scoring.ts` — `scorePlacement` (height/combo/centeredness/perfect-stack bonuses) and `levelScoreThreshold` (endless level pacing).
- `adaptiveAI.ts` — rule-based dynamic difficulty. `analyze → performanceScore → targetDifficulty` yields a 1..5 level (smoothed ±1 at a time); `effectsFor(d)` converts it into concrete knobs: tray capacity, wind, shake, modifier probability.
- `renderer.ts` — all canvas drawing (backdrop, platform, blocks, ghosts, particles). Has parallel "default" and Ice-Mode code paths (`drawIceBackdrop`, `drawIcePlatform`, ice branches in `drawBlock`).
- `particles.ts` — `ParticleSystem` with named emitters (`emitConfetti`, `emitFrostRing`, `emitAurora`, `emitIceShatter`, …).
- `themes.ts` / `audio.ts` — see theming below; audio is Howler-based (`playSfx`, `startMusic`).

### Routing & screens

`App.tsx` defines react-router routes; `src/screens/` holds one component per route (`Splash`, `Welcome`, `MainMenu`, `GameScreen`, `GameOver`, `ChallengeSelect`, `EndlessSelect`, `Settings`, `HowToPlay`). Unknown paths redirect to `/`.

### Theming vs. Ice Mode (two distinct systems — don't conflate them)

1. **Color themes** (`classic`, `neon`, `sunset`, `mint`, `arcade`): selected in settings, applied via a `data-theme` attribute on `<html>` (`applyTheme`). Colors live as CSS variables in `src/styles/index.css` and in `THEMES` / `SHAPE_PALETTES` in `themes.ts`. Adding a theme means updating **all three**: the `THEMES` array, the `SHAPE_PALETTES` record, and a `:root[data-theme='…']` block in the CSS.
2. **Ice Mode** is **not** a theme — it's the `ice` `PlatformType` (chosen from `EndlessSelect`). It changes physics (slippery, periodic cold gusts), backdrop, VFX, and the whole UI look. The flag is derived as `platform === 'ice'`: the engine sets `this.iceMode`, and React components read `useGameStore(s => s.platform === 'ice')` to switch to the `ice-*` CSS classes (`ice-panel`, `ice-btn`, defined in `index.css`) and the `ICE_PALETTE` / `ICE_SHAPE_PALETTE`. When adding gameplay UI, branch on this flag so Ice Mode stays cohesive.

`PlatformType` (`wood | ice | bouncy | magnetic | fragile`) is the central switch that drives both physics behavior and visual treatment.
