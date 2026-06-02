import Matter from 'matter-js';
import {
  applyMagneticPull,
  applyWind,
  createWorld,
  disposeWorld,
  recreatePlatform,
  spawnBlock,
  towerHeightFromPlatform,
  type BodyMeta,
  type WorldHandles,
} from './physicsWorld';
import { ALL_SHAPES, generateBlock, seededRng } from './blockFactory';
import {
  analyze,
  effectsFor,
  performanceScore,
  smoothDifficulty,
  targetDifficulty,
} from './adaptiveAI';
import { levelScoreThreshold, scorePlacement } from './scoring';
import {
  ensureAudio,
  playSfx,
  startMusic,
  stopMusic,
  vibrate,
} from './audio';
import { ParticleSystem } from './particles';
import { getAccentColor } from './themes';
import {
  clear,
  drawBackdrop,
  drawBlock,
  drawDragGhost,
  drawGustFrostOverlay,
  drawHeightLine,
  drawIceBackdrop,
  drawInvalidIndicator,
  drawJellyBackdrop,
  drawLandingSilhouette,
  drawPlatform,
} from './renderer';
import { cellsFor, centroidOffsetFor } from './shapes';
import type {
  BlockSpec,
  ChallengeSpec,
  GameMode,
  PlatformType,
} from './types';

export interface EngineCallbacks {
  onScore: (n: number, breakdown: Array<[string, number]>) => void;
  onCombo: (combo: number) => void;
  onLevel: (level: number) => void;
  onDifficulty: (d: number) => void;
  onTray: (tray: BlockSpec[]) => void;
  onTrayCapacity: (n: number) => void;
  onCollapse: (n: number) => void;
  onPlace: () => void;
  onLost: () => void;
  onWon: () => void;
  onToast: (msg: string) => void;
  onHeight: (h: number) => void;
  onActionCounts: (
    undosLeft: number,
    shufflesLeft: number,
    pinsLeft: number,
    pinArmed: boolean,
  ) => void;
}

export const MAX_UNDOS = 3;
export const MAX_SHUFFLES = 3;
export const MAX_PINS = 3;

export interface EngineConfig {
  canvas: HTMLCanvasElement;
  mode: GameMode;
  challenge?: ChallengeSpec | null;
  platform: PlatformType;
  reduceMotion: boolean;
  callbacks: EngineCallbacks;
  goalScore?: number;
  goalHeight?: number;
}

const DEFAULT_BOTTOM_RESERVED = 170;

interface DropPreview {
  spec: BlockSpec;
  pointerX: number;
  pointerY: number;
  snappedX: number;
  landingY: number;
  valid: boolean;
}

export class GameEngine {
  private cfg: EngineConfig;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private world!: WorldHandles;
  private particles = new ParticleSystem();
  private rafId = 0;
  private running = false;
  private paused = false;
  private lastTs = 0;
  private placedBlocks: Matter.Body[] = [];
  private inflightDrop: DropPreview | null = null;
  private trayBlocks: BlockSpec[] = [];
  private trayCapacity = 3;
  private difficulty = 1;
  private combo = 0;
  private score = 0;
  private level = 1;
  private platformBaseY = 0;
  private bottomReserved = DEFAULT_BOTTOM_RESERVED;
  private cameraY = 0;
  private targetCameraY = 0;
  private wind = 0;
  private undoStack: Matter.Body[] = [];
  private undosLeft = MAX_UNDOS;
  private shufflesLeft = MAX_SHUFFLES;
  private pinsLeft = MAX_PINS;
  private pinArmed = false;
  private excludeNextShape: import('./types').BlockShape | null = null;
  private mode: GameMode;
  private challenge: ChallengeSpec | null = null;
  private platformType: PlatformType = 'wood';
  private startTs = Date.now();
  private lastPlaceTs = Date.now();
  private placementsTimes: number[] = [];
  private collapses = 0;
  private blocksPlacedCount = 0;
  private blocksCollapsedCount = 0;
  private bestComboThisGame = 0;
  private nearMisses = 0;
  private rng: () => number;
  private isLost = false;
  private isWon = false;
  private goalScore: number;
  private goalHeight: number;
  private bossActive = false;
  private bossTimer = 0;
  private lastWindBlast = 0;
  private disturbanceTimer = 0;
  private iceMode = false;
  private jellyMode = false;
  private classicMode = false;
  private snowEmitTimer = 0;
  private iceGustTimer = 0;
  private iceGustDir = 1;
  private iceShakeAmp = 0;
  private iceFrostFlash = 0;
  private jellyWiggleTimer = 0;

  constructor(cfg: EngineConfig) {
    this.cfg = cfg;
    this.canvas = cfg.canvas;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('No 2D context');
    this.ctx = ctx;
    this.mode = cfg.mode;
    this.challenge = cfg.challenge ?? null;
    this.platformType = cfg.platform;
    this.iceMode = cfg.platform === 'ice';
    this.jellyMode = cfg.platform === 'jelly';
    this.classicMode = cfg.mode === 'endless' && cfg.platform === 'wood';
    this.goalScore = cfg.goalScore ?? 0;
    this.goalHeight = cfg.goalHeight ?? 0;
    this.rng = this.challenge
      ? seededRng(hashChallenge(this.challenge.id))
      : Math.random;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.resize();

    this.world = createWorld(this.canvas.clientWidth, this.canvas.clientHeight);
    if (this.classicMode) {
      this.world.engine.positionIterations = 10;
      this.world.engine.velocityIterations = 10;
    }
    this.platformBaseY = this.canvas.clientHeight - this.bottomReserved;
    recreatePlatform(
      this.world,
      this.canvas.clientWidth / 2,
      this.platformBaseY,
      this.platformType,
      220,
    );

    if (this.challenge) {
      this.wind = this.challenge.wind;
      this.bossActive = !!this.challenge.bossTag;
    }

    this.applyDifficultyPhysics();
    this.refillTray();
    this.cfg.callbacks.onActionCounts(
      this.undosLeft,
      this.shufflesLeft,
      this.pinsLeft,
      this.pinArmed,
    );

    Matter.Events.on(this.world.engine, 'collisionStart', this.handleCollision);

    ensureAudio();
    startMusic();

    this.lastTs = performance.now();
    this.loop(this.lastTs);

    window.addEventListener('resize', this.handleResize);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerUp);
    this.canvas.addEventListener('contextmenu', this.handleContextMenu);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    Matter.Events.off(this.world?.engine, 'collisionStart', this.handleCollision);
    if (this.world) disposeWorld(this.world);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerUp);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
    stopMusic();
  }

  pause() {
    this.paused = true;
  }
  resume() {
    if (!this.running) return;
    this.paused = false;
    this.lastTs = performance.now();
    this.loop(this.lastTs);
  }

  // --- Player actions ---

  /** Remove the most recently placed block. Limited to MAX_UNDOS per game. */
  triggerUndo() {
    if (this.undosLeft <= 0) {
      this.cfg.callbacks.onToast('No undos left');
      return;
    }
    const last = this.undoStack.pop();
    if (!last) {
      this.cfg.callbacks.onToast('Nothing to undo');
      return;
    }
    Matter.World.remove(this.world.world, last);
    const idx = this.placedBlocks.indexOf(last);
    if (idx >= 0) this.placedBlocks.splice(idx, 1);
    if (this.blocksPlacedCount > 0) this.blocksPlacedCount--;
    this.undosLeft--;
    this.cfg.callbacks.onActionCounts(
      this.undosLeft,
      this.shufflesLeft,
      this.pinsLeft,
      this.pinArmed,
    );
    playSfx('click');
    this.cfg.callbacks.onToast(`Undone · ${this.undosLeft} left`);
  }

  /**
   * Toggle "Pin" mode. While armed, the next placement spawns a STATIC body at
   * the pointer position (no support required, won't move) and consumes one
   * use. Re-clicking before placing disarms without spending. Limited to
   * MAX_PINS per game.
   */
  triggerPin() {
    if (this.pinArmed) {
      this.pinArmed = false;
      this.cfg.callbacks.onActionCounts(
        this.undosLeft,
        this.shufflesLeft,
        this.pinsLeft,
        this.pinArmed,
      );
      this.cfg.callbacks.onToast('Pin disarmed');
      return;
    }
    if (this.pinsLeft <= 0) {
      this.cfg.callbacks.onToast('No pins left');
      return;
    }
    this.pinArmed = true;
    this.cfg.callbacks.onActionCounts(
      this.undosLeft,
      this.shufflesLeft,
      this.pinsLeft,
      this.pinArmed,
    );
    playSfx('powerup');
    this.cfg.callbacks.onToast(
      `Pin armed · place anywhere · ${this.pinsLeft} left`,
    );
    // Force the active drag (if any) to re-evaluate validity under pin rules.
    this.recomputePreview();
  }

  /** Replace every block currently in the tray. Limited to MAX_SHUFFLES per game. */
  triggerShuffle() {
    if (this.shufflesLeft <= 0) {
      this.cfg.callbacks.onToast('No shuffles left');
      return;
    }
    this.trayBlocks = [];
    this.refillTray();
    this.shufflesLeft--;
    this.cfg.callbacks.onActionCounts(
      this.undosLeft,
      this.shufflesLeft,
      this.pinsLeft,
      this.pinArmed,
    );
    playSfx('powerup');
    this.cfg.callbacks.onToast(`Shuffled · ${this.shufflesLeft} left`);
  }

  // --- Internals ---

  private handleResize = () => this.resize();
  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.reflowLayout(rect.width, rect.height);
  }

  /**
   * Sets how many pixels at the bottom of the canvas are reserved for UI
   * (BlockTray + safe-area). Engine repositions the platform so it always
   * sits just above this reserved area.
   */
  setBottomReserved(px: number) {
    const next = Math.max(80, Math.round(px));
    if (next === this.bottomReserved) return;
    this.bottomReserved = next;
    if (this.world?.platform) {
      this.reflowLayout(this.canvas.clientWidth, this.canvas.clientHeight);
    }
  }

  /**
   * Re-anchor the platform and ground to the current canvas size and the
   * current bottomReserved offset. Existing placed blocks shift by the same
   * vertical delta so the player's tower stays visually in place relative to
   * the platform across orientation changes / URL-bar collapse.
   */
  private reflowLayout(width: number, height: number) {
    if (!this.world?.platform) return;

    const newBaseY = height - this.bottomReserved;
    const newCx = width / 2;
    const dy = newBaseY - this.platformBaseY;
    const dx = newCx - this.world.platform.position.x;

    if (dy !== 0 || dx !== 0) {
      Matter.Body.setPosition(this.world.platform, { x: newCx, y: newBaseY });

      if (dy !== 0) {
        for (const b of this.placedBlocks) {
          Matter.Body.setPosition(b, { x: b.position.x, y: b.position.y + dy });
        }
        for (const b of this.undoStack) {
          if (!this.placedBlocks.includes(b)) {
            Matter.Body.setPosition(b, { x: b.position.x, y: b.position.y + dy });
          }
        }
        this.cameraY += dy;
        this.targetCameraY += dy;
      }
      this.platformBaseY = newBaseY;
    }

    if (this.world.ground) {
      Matter.Body.setPosition(this.world.ground, { x: width / 2, y: height + 200 });
    }
  }

  private handleContextMenu = (e: Event) => {
    e.preventDefault();
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.inflightDrop) return;
    const rect = this.canvas.getBoundingClientRect();
    this.inflightDrop.pointerX = e.clientX - rect.left;
    this.inflightDrop.pointerY = e.clientY - rect.top;
    this.recomputePreview();
  };

  private handlePointerUp = () => {
    if (this.inflightDrop) {
      this.releaseDrop();
    }
  };

  /** Begin dragging a block from the tray. Called from React tray UI. */
  beginDrop(spec: BlockSpec, pointerX: number, pointerY: number) {
    const rect = this.canvas.getBoundingClientRect();
    const px = pointerX - rect.left;
    this.inflightDrop = {
      spec,
      pointerX: px,
      pointerY: pointerY - rect.top,
      snappedX: px,
      landingY: 0,
      valid: false,
    };
    this.recomputePreview();
    playSfx('pickup', 0.7);
  }

  cancelDrop() {
    this.inflightDrop = null;
  }

  setPointer(x: number, y: number) {
    if (!this.inflightDrop) return;
    const rect = this.canvas.getBoundingClientRect();
    this.inflightDrop.pointerX = x - rect.left;
    this.inflightDrop.pointerY = y - rect.top;
    this.recomputePreview();
  }

  releaseDrop() {
    if (!this.inflightDrop) return;
    if (!this.inflightDrop.valid) {
      // Reject the drop — block stays in the tray.
      this.cfg.callbacks.onToast('Invalid spot');
      this.inflightDrop = null;
      return;
    }
    this.snapPlace();
  }

  /**
   * Update the preview's landing Y and validity based on current pointer.
   */
  private recomputePreview() {
    if (!this.inflightDrop) return;
    const { spec, pointerX, pointerY } = this.inflightDrop;
    const snappedX = this.snapToGrid(pointerX, spec);
    this.inflightDrop.snappedX = snappedX;
    const halfW = spec.width / 2;

    // Horizontal bounds: snapped position must fit in canvas
    const fitsHorizontal =
      snappedX - halfW >= 0 && snappedX + halfW <= this.canvas.clientWidth;

    if (!fitsHorizontal) {
      this.inflightDrop.valid = false;
      this.inflightDrop.landingY = pointerY + this.cameraY;
      return;
    }

    if (this.pinArmed) {
      // Pin mode: the block lands where the cursor IS, with no support
      // requirement. Validity = no overlap with any obstacle at that pose.
      const worldY = pointerY + this.cameraY;
      this.inflightDrop.landingY = worldY;
      this.inflightDrop.valid = this.canPlaceAt(spec, snappedX, worldY);
      return;
    }

    const pointerWorldY = pointerY + this.cameraY;
    const projected = this.projectLanding(spec, snappedX, pointerWorldY);
    if (!Number.isFinite(projected.y) || projected.cellsSupported === 0) {
      this.inflightDrop.valid = false;
      this.inflightDrop.landingY = pointerY + this.cameraY;
      return;
    }

    this.inflightDrop.landingY = projected.y;
    this.inflightDrop.valid = true;
  }

  /**
   * Returns true if the piece at (centerX, centerY) doesn't overlap the
   * platform or any placed block part. Used by pin mode where there is no
   * gravity projection — the block lands wherever the cursor points provided
   * the pose is non-overlapping.
   */
  private canPlaceAt(spec: BlockSpec, x: number, y: number): boolean {
    const layout = cellsFor(spec.shape);
    const u = spec.unit;
    const cells = layout.cells.map((c) => {
      const cx = x + c.cx * u;
      const cy = y + c.cy * u;
      return {
        left: cx - u / 2,
        right: cx + u / 2,
        top: cy - u / 2,
        bottom: cy + u / 2,
      };
    });

    type Rect = { minX: number; maxX: number; minY: number; maxY: number };
    const obstacles: Rect[] = [];

    const platform = this.world.platform;
    const pW =
      (platform as Matter.Body & { _platformWidth?: number })._platformWidth ?? 220;
    const pH = 26;
    obstacles.push({
      minX: platform.position.x - pW / 2,
      maxX: platform.position.x + pW / 2,
      minY: platform.position.y - pH / 2,
      maxY: platform.position.y + pH / 2,
    });
    for (const body of this.placedBlocks) {
      const parts = body.parts.length > 1 ? body.parts.slice(1) : [body];
      for (const p of parts) {
        const bb = p.bounds;
        obstacles.push({
          minX: bb.min.x,
          maxX: bb.max.x,
          minY: bb.min.y,
          maxY: bb.max.y,
        });
      }
    }

    const EPS = 0.5;
    for (const cell of cells) {
      for (const obs of obstacles) {
        const xO =
          Math.min(cell.right, obs.maxX) - Math.max(cell.left, obs.minX);
        if (xO <= EPS) continue;
        const yO =
          Math.min(cell.bottom, obs.maxY) - Math.max(cell.top, obs.minY);
        if (yO > EPS) return false;
      }
    }
    return true;
  }

  /**
   * Free-form placement with a soft magnetic snap. The pointer follows the
   * cursor smoothly; when it comes within ~6 px of a grid column aligned to
   * the platform edge, it gently snaps so pieces still align with neighbours.
   * Odd-width pieces (T/S/Z) align on integer-unit columns; even-width pieces
   * (I/O/L/J) align on half-unit columns so all cells land on grid positions.
   */
  private snapToGrid(pointerX: number, spec: BlockSpec): number {
    const u = spec.unit;
    const platformX = this.world.platform.position.x;
    const platformW =
      (this.world.platform as Matter.Body & { _platformWidth?: number })
        ._platformWidth ?? 220;
    const gridOrigin = platformX - platformW / 2;
    const layout = cellsFor(spec.shape);

    let snapped: number;
    if (layout.width % 2 === 0) {
      const n = Math.round((pointerX - gridOrigin) / u - 0.5);
      snapped = gridOrigin + (n + 0.5) * u;
    } else {
      const n = Math.round((pointerX - gridOrigin) / u);
      snapped = gridOrigin + n * u;
    }

    // Soft magnetic snap: only pull to the grid column when the cursor is
    // within MAGNET px of it, otherwise track the cursor freely. This keeps
    // movement smooth while still helping pieces line up with neighbours.
    const MAGNET = 6;
    const dx = snapped - pointerX;
    const placement = Math.abs(dx) <= MAGNET ? snapped : pointerX;

    const halfW = spec.width / 2;
    const canvasW = this.canvas.clientWidth;
    return Math.max(halfW, Math.min(canvasW - halfW, placement));
  }

  /**
   * For the given block spec at horizontal pointer X, compute the world Y at
   * which the block's center would settle. Returns Infinity if no supporting
   * surface exists.
   *
   * When `pointerWorldY` is provided and the piece has multiple valid rest
   * positions (e.g. one ON TOP of a structure and one IN a pocket beneath it),
   * the one whose center is closest to the pointer wins. That way, dragging
   * above the stack lands on top, and dragging into the gap slots underneath.
   * If omitted, falls back to the deepest valid rest.
   */
  private projectLanding(
    spec: BlockSpec,
    pointerX: number,
    pointerWorldY?: number,
  ): { y: number; cellsSupported: number } {
    const layout = cellsFor(spec.shape);
    const u = spec.unit;

    const cells = layout.cells.map((c) => {
      const cx = pointerX + c.cx * u;
      return {
        left: cx - u / 2,
        right: cx + u / 2,
        topLocal: (c.cy - 0.5) * u,
        bottomLocal: (c.cy + 0.5) * u,
      };
    });
    const pieceMinX = Math.min(...cells.map((c) => c.left));
    const pieceMaxX = Math.max(...cells.map((c) => c.right));

    // Gather obstacles (platform + each placed block part) as AABBs, filtered
    // to those whose horizontal range overlaps the piece.
    type Rect = { minX: number; maxX: number; minY: number; maxY: number };
    const obstacles: Rect[] = [];

    const platform = this.world.platform;
    const pW =
      (platform as Matter.Body & { _platformWidth?: number })._platformWidth ?? 220;
    const pH = 26;
    const platRect: Rect = {
      minX: platform.position.x - pW / 2,
      maxX: platform.position.x + pW / 2,
      minY: platform.position.y - pH / 2,
      maxY: platform.position.y + pH / 2,
    };
    if (platRect.maxX > pieceMinX && platRect.minX < pieceMaxX) {
      obstacles.push(platRect);
    }
    for (const body of this.placedBlocks) {
      const parts = body.parts.length > 1 ? body.parts.slice(1) : [body];
      for (const p of parts) {
        const bb = p.bounds;
        if (bb.max.x > pieceMinX && bb.min.x < pieceMaxX) {
          obstacles.push({
            minX: bb.min.x,
            maxX: bb.max.x,
            minY: bb.min.y,
            maxY: bb.max.y,
          });
        }
      }
    }

    // Candidate rest Y values: for every (cell, obstacle in same column),
    // the body Y at which that cell's bottom would touch the obstacle's top.
    // Sub-pixel x-overlap is filtered out so settled-neighbour jitter doesn't
    // pin the piece on top of a column it's barely grazing.
    const OVERLAP_EPS = 3;
    const candidates: number[] = [];
    for (const cell of cells) {
      for (const obs of obstacles) {
        const xOverlap =
          Math.min(cell.right, obs.maxX) - Math.max(cell.left, obs.minX);
        if (xOverlap > OVERLAP_EPS) {
          candidates.push(obs.minY - cell.bottomLocal);
        }
      }
    }
    if (candidates.length === 0) {
      return { y: Number.POSITIVE_INFINITY, cellsSupported: 0 };
    }

    candidates.sort((a, b) => b - a);

    const FIT_EPS = 0.5;
    const SUPPORT_TOL = 1;

    const validLandings: { y: number; supported: number }[] = [];
    for (const y of candidates) {
      let overlap = false;
      for (let ci = 0; ci < cells.length && !overlap; ci++) {
        const cell = cells[ci];
        const cellTop = y + cell.topLocal;
        const cellBot = y + cell.bottomLocal;
        for (const obs of obstacles) {
          const xO =
            Math.min(cell.right, obs.maxX) - Math.max(cell.left, obs.minX);
          if (xO <= FIT_EPS) continue;
          const yO =
            Math.min(cellBot, obs.maxY) - Math.max(cellTop, obs.minY);
          if (yO > FIT_EPS) {
            overlap = true;
            break;
          }
        }
      }
      if (overlap) continue;

      let supported = 0;
      for (const cell of cells) {
        const cellBot = y + cell.bottomLocal;
        for (const obs of obstacles) {
          const xO =
            Math.min(cell.right, obs.maxX) - Math.max(cell.left, obs.minX);
          if (xO > OVERLAP_EPS && Math.abs(cellBot - obs.minY) < SUPPORT_TOL) {
            supported++;
            break;
          }
        }
      }
      validLandings.push({ y, supported });
    }

    if (validLandings.length === 0) {
      return {
        y: candidates[candidates.length - 1],
        cellsSupported: 0,
      };
    }

    let chosen = validLandings[0];
    if (pointerWorldY !== undefined && validLandings.length > 1) {
      let bestDist = Math.abs(chosen.y - pointerWorldY);
      for (let i = 1; i < validLandings.length; i++) {
        const d = Math.abs(validLandings[i].y - pointerWorldY);
        if (d < bestDist) {
          bestDist = d;
          chosen = validLandings[i];
        }
      }
    }
    return { y: chosen.y, cellsSupported: chosen.supported };
  }

  private snapPlace() {
    if (!this.inflightDrop || !this.inflightDrop.valid) return;
    const { spec, snappedX, landingY } = this.inflightDrop;
    const pinned = this.pinArmed;
    this.inflightDrop = null;

    // Remove from tray
    this.trayBlocks = this.trayBlocks.filter((b) => b.id !== spec.id);
    this.cfg.callbacks.onTray([...this.trayBlocks]);

    // Matter sets compound body.position to the centroid (centre of mass), not
    // the geometric centre. For asymmetric pieces (T, L, J) those differ — so
    // shift the spawn position by the centroid offset so the geom centre lands
    // exactly at the snap column / projected landing Y.
    const off = centroidOffsetFor(spec.shape, spec.unit);
    // Ice mode: low kinetic friction so a tipping block slides off freely
    // once it starts moving, but kinetic only — frictionStatic is bumped after
    // spawn so centred, stationary stacks grip and don't slowly drift under
    // the ambient turbulence. The slip is reserved for badly placed pieces.
    // Classic mode: heavier wood — bumped density and a small landing thud via
    // restitution, with friction left grippy so settled stacks hold.
    const spawnSpec = this.iceMode
      ? { ...spec, friction: 0.04, restitution: 0.05 }
      : this.jellyMode
        ? // Springy & grippy: the block compresses and bounces once on impact,
          // then the high friction lets the stack settle without sliding.
          { ...spec, friction: 0.6, restitution: 0.42 }
        : this.classicMode
          ? { ...spec, density: spec.density * 1.6, restitution: 0.06 }
          : spec;
    const body = spawnBlock(this.world.world, {
      x: snappedX + off.x,
      y: landingY + off.y,
      spec: spawnSpec,
      angle: 0,
      isStatic: pinned,
    });

    if (pinned) {
      this.pinsLeft--;
      this.pinArmed = false;
      this.cfg.callbacks.onActionCounts(
        this.undosLeft,
        this.shufflesLeft,
        this.pinsLeft,
        this.pinArmed,
      );
    }

    // Less angular damping at higher difficulty → blocks tip more easily. In
    // ice mode we floor the value so spins keep going long after impact, like
    // a curling stone gliding on glass. Classic shaves a touch off so heavy
    // wood pieces rock and tip naturally instead of locking in place.
    const baseAngDamp = Math.max(0.002, 0.012 - (this.difficulty - 1) * 0.0025);
    const angDamp = this.iceMode
      ? Math.min(baseAngDamp, 0.001)
      : this.classicMode
        ? Math.max(0.0015, baseAngDamp - 0.003)
        : baseAngDamp;
    (body as Matter.Body & { angularDamping: number }).angularDamping = angDamp;
    if (this.iceMode) {
      // Reduce linear damping too — Matter applies frictionAir per step; the
      // default damps lateral drift quickly, which kills the slide feel.
      (body as Matter.Body & { frictionAir: number }).frictionAir = 0.005;
      // Static friction must be higher than kinetic so a centred stack doesn't
      // slowly creep under the ambient turbulence. Matter resolves per-pair
      // static friction as max(a.frictionStatic, b.frictionStatic), so this
      // value also anchors the bottom block on the platform at rest while the
      // platform's low kinetic friction (min) still lets it slide off once
      // motion starts. Compound bodies share friction props via parent.
      const grip = 0.22;
      (body as Matter.Body & { frictionStatic: number }).frictionStatic = grip;
      if (body.parts.length > 1) {
        for (const p of body.parts) {
          (p as Matter.Body & { frictionStatic: number }).frictionStatic = grip;
        }
      }
    }

    Matter.Body.setVelocity(body, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(body, 0);

    this.placedBlocks.push(body);
    this.undoStack.push(body);
    if (this.undoStack.length > MAX_UNDOS) this.undoStack.shift();
    this.lastPlaceTs = Date.now();
    this.blocksPlacedCount++;
    // Block this shape from being the immediate next-spawn in the tray.
    this.excludeNextShape = spec.shape;

    const ts = Date.now();
    this.placementsTimes.push(ts - this.startTs);
    if (this.placementsTimes.length > 30) this.placementsTimes.shift();

    playSfx(this.jellyMode ? 'boing' : 'place');
    vibrate(10);
    if (this.iceMode) {
      // Ice-mode placement burst: a frost shockwave ring at the contact line,
      // a soft compression cloud at the block's centre, an outward spray of
      // ice chips, and a handful of drifting snowflakes settling on top.
      const sx = body.position.x;
      const sy = body.position.y - this.cameraY;
      const bottomY = body.bounds.max.y - this.cameraY;
      this.particles.emitFrostRing(sx, bottomY, 16);
      this.particles.emitFrostBreath(sx, sy, 14);
      this.particles.emitIceFlakes(sx, bottomY, 12);
      this.particles.emitSnowflakes(sx, sy, 8);
    } else if (this.jellyMode) {
      // Jelly-mode placement: a bubble-pop shockwave at the contact line and a
      // spray of candy droplets + sugar sparkles at the block's centre.
      const sx = body.position.x;
      const sy = body.position.y - this.cameraY;
      const bottomY = body.bounds.max.y - this.cameraY;
      this.particles.emitBubblePop(sx, bottomY, 14);
      this.particles.emitJellyDroplets(sx, sy, 10);
      this.particles.emitCandySparkle(sx, sy, 8);
    } else {
      this.particles.emitImpact(
        body.position.x,
        body.position.y - this.cameraY,
        8,
      );
    }

    setTimeout(() => this.scoreAfterSettle(body, 0), 700);

    if (this.trayBlocks.length === 0) {
      this.refillTray();
    } else if (this.trayBlocks.length < this.trayCapacity) {
      this.addToTrayNext();
    }

    this.cfg.callbacks.onPlace();
  }

  private addToTrayNext() {
    const shapeCounts = new Map<string, number>();
    for (const b of this.trayBlocks) {
      shapeCounts.set(b.shape, (shapeCounts.get(b.shape) ?? 0) + 1);
    }
    const baseAllowed = this.challenge?.shapesAllowed ?? ALL_SHAPES;
    let filtered = baseAllowed.filter((s) => (shapeCounts.get(s) ?? 0) < 2);
    // Don't immediately respawn the just-placed shape. Consume the exclusion
    // after one spawn so subsequent additions can use the full pool again.
    if (this.excludeNextShape) {
      const withoutLast = filtered.filter((s) => s !== this.excludeNextShape);
      if (withoutLast.length > 0) filtered = withoutLast;
      this.excludeNextShape = null;
    }
    const block = generateBlock({
      difficulty: this.difficulty,
      rng: this.rng,
      shapesAllowed: filtered.length > 0 ? filtered : baseAllowed,
      unitSize: 32,
    });
    this.trayBlocks.push(block);
    this.cfg.callbacks.onTray([...this.trayBlocks]);
  }

  refillTray() {
    const eff = effectsFor(this.difficulty);
    this.trayCapacity = eff.trayCapacity;
    this.cfg.callbacks.onTrayCapacity(this.trayCapacity);
    while (this.trayBlocks.length < this.trayCapacity) {
      this.addToTrayNext();
    }
  }

  private scoreAfterSettle(body: Matter.Body, attempt: number) {
    // Block was removed (fell off / undone) — nothing to score.
    if (!this.placedBlocks.includes(body)) return;
    const meta = (body as Matter.Body & { _meta?: BodyMeta })._meta;
    if (!meta || meta.scored) return;
    if (meta.shattered) return;
    if (body.position.y > this.platformBaseY) return;

    const sleeping = body.isSleeping;
    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    const angSpeed = Math.abs(body.angularVelocity);
    const stable = sleeping || (speed < 0.4 && angSpeed < 0.05);

    // Not yet settled — give physics more time before deciding. If after
    // several retries it's still moving (i.e., wobbling toward the edge or
    // tumbling), forfeit the score and break the combo. This prevents banking
    // points for a block that is still in motion and will shortly fall off.
    if (!stable) {
      if (attempt < 5) {
        setTimeout(() => this.scoreAfterSettle(body, attempt + 1), 400);
        return;
      }
      meta.scored = true;
      if (this.combo !== 0) {
        this.combo = 0;
        this.cfg.callbacks.onCombo(0);
      }
      return;
    }

    const heightAboveBase = Math.max(0, this.platformBaseY - body.position.y);
    const platformX = this.world.platform.position.x;
    const platformWidth =
      (this.world.platform as Matter.Body & { _platformWidth?: number })._platformWidth ??
      220;
    const horizontalOffset = Math.abs(body.position.x - platformX);
    const centeredness = Math.max(0, 1 - horizontalOffset / (platformWidth / 2));

    this.combo += 1;
    this.bestComboThisGame = Math.max(this.bestComboThisGame, this.combo);
    this.cfg.callbacks.onCombo(this.combo);

    const { total, breakdown } = scorePlacement({
      heightAboveBase,
      combo: this.combo,
      difficulty: this.difficulty,
      blockSpec: meta.spec,
      stable: true,
      perfectStack: centeredness > 0.92 && this.combo >= 3,
      centeredness,
    });
    meta.scored = true;
    this.score += total;
    this.cfg.callbacks.onScore(total, breakdown);

    const isPerfect = centeredness > 0.92 && this.combo >= 3;
    if (this.combo >= 3) {
      playSfx('placeGood', 0.9);
      const cbx = body.position.x;
      const cby = body.position.y - this.cameraY;
      if (this.iceMode) {
        // Combo punch reads as ice cracking: a flat frost shockwave plus a
        // spray of shards, scaling slightly with the combo length.
        this.particles.emitFrostRing(cbx, cby, 18);
        this.particles.emitIceFlakes(cbx, cby, Math.min(22, 12 + this.combo));
      } else if (this.jellyMode) {
        // Gummy explosion for a combo; a full rainbow jelly burst when the
        // placement is also perfect.
        playSfx('pop', 0.6);
        if (isPerfect) this.particles.emitRainbowBurst(cbx, cby, 28);
        else this.particles.emitGummyExplosion(cbx, cby, Math.min(28, 16 + this.combo));
      } else {
        this.particles.emitBurst(cbx, cby, meta.spec.color, 12);
      }
      // Soft halo on the placed block — longer / brighter for perfect stacks.
      meta.glowUntil = performance.now() + (isPerfect ? 1400 : 900);
    }

    if (this.blocksPlacedCount % 3 === 0) {
      this.maybeAdjustDifficulty();
    }

    if (this.mode === 'endless') {
      const threshold = levelScoreThreshold(this.level);
      if (this.score >= threshold) {
        this.level++;
        playSfx('levelup');
        const lx = this.canvas.clientWidth / 2;
        const ly = this.canvas.clientHeight / 3;
        if (this.iceMode) {
          this.particles.emitAurora(lx, ly, 50);
          this.particles.emitSnowflakes(lx, ly, 24);
        } else if (this.jellyMode) {
          this.particles.emitCandyShower(lx, ly, 50);
        } else {
          this.particles.emitConfetti(lx, ly, 80);
        }
        this.cfg.callbacks.onLevel(this.level);
        this.cfg.callbacks.onToast(`Level ${this.level}!`);
      }
    }

    if (this.mode === 'daily' || this.mode === 'challenge') {
      const totalHeight = towerHeightFromPlatform(this.world.world, this.platformBaseY);
      if (this.score >= this.goalScore && totalHeight >= this.goalHeight) {
        this.win();
      }
    }
  }

  private maybeAdjustDifficulty() {
    const totalDrops = this.blocksPlacedCount + this.blocksCollapsedCount;
    if (totalDrops < 4) return;
    const stats = {
      startedAt: this.startTs,
      blocksPlaced: this.blocksPlacedCount,
      blocksCollapsed: this.blocksCollapsedCount,
      highestY: 0,
      comboBest: this.bestComboThisGame,
      comboCurrent: this.combo,
      nearMisses: this.nearMisses,
      avgPlacementMs:
        this.placementsTimes.length > 1
          ? avgDelta(this.placementsTimes)
          : 0,
      lastPlacementMs: 0,
      totalActiveMs: Date.now() - this.startTs,
      collapses: this.collapses,
      attemptsAtCurrentLevel: 1,
    };
    const snap = analyze(stats);
    const perf = performanceScore(snap);
    const target = targetDifficulty(perf);
    const next = smoothDifficulty(this.difficulty, target);
    if (next !== this.difficulty) {
      this.difficulty = next;
      this.cfg.callbacks.onDifficulty(next);
      this.applyDifficultyPhysics();
    }
  }

  /**
   * Crank up gravity (and slip) at higher difficulty so the tower feels more
   * sensitive to imperfect placements. Existing blocks are left alone — the
   * change only affects the gravity field and newly-spawned pieces.
   * Classic mode runs a steeper, heavier curve so wood feels weighty and
   * imperfect stacks punish faster.
   */
  private applyDifficultyPhysics() {
    const d = this.difficulty;
    const scale = this.classicMode
      ? 0.0021 + (d - 1) * 0.00035
      : 0.0014 + (d - 1) * 0.00025;
    this.world.engine.gravity.scale = scale;
  }

  /**
   * Challenge-only: at difficulty ≥ 3 apply periodic micro-impulses to the
   * upper tower so it sways and requires more careful placement. Endless mode
   * never gets disturbances — collapses there must come from the player's own
   * placements, not surprise shoves.
   */
  private tickDisturbances(dt: number) {
    if (!this.challenge) return;
    const d = this.difficulty;
    if (d < 3 || this.placedBlocks.length < 3) return;
    this.disturbanceTimer += dt;
    const interval = 3600 - d * 600;
    if (this.disturbanceTimer < interval) return;
    this.disturbanceTimer = 0;

    const sorted = [...this.placedBlocks].sort((a, b) => a.position.y - b.position.y);
    const topCount = Math.max(1, Math.ceil(sorted.length / 3));
    const target = sorted[Math.floor(Math.random() * topCount)];
    if (!target || target.isStatic) return;

    const forceMag = 0.000035 * (d - 2) * target.mass;
    const dir = Math.random() > 0.5 ? 1 : -1;
    Matter.Body.applyForce(target, target.position, { x: dir * forceMag, y: 0 });
    Matter.Sleeping.set(target, false);
  }

  /**
   * Ice-mode environmental forces — weather, not arcade effects.
   *
   *  1. Layered turbulence breeze: three sines of different periods plus a
   *     very slow drift trend, summed and scaled. The result is no longer a
   *     predictable oscillation — players perceive "ice instability" rather
   *     than math.
   *
   *  2. Periodic cold storm gusts (~7s) that wake every block, push the
   *     tower, trigger a brief camera shake, and paint a white frost
   *     overlay at the canvas edges that fades over the next second. Plume
   *     particles use only ice-white / frost-mist (no neon).
   */
  private tickIcePhysics(dt: number, ts: number) {
    if (!this.iceMode) return;

    // Layered turbulence. Three sine harmonics with prime-ratio frequencies
    // so the sum never repeats cleanly. Magnitude stays well below the
    // gust force so it nudges off-centre stacks without pushing centred
    // ones around. A tiny constant drift is added so even at moments where
    // all the sines cross zero, there's still a hint of wind direction.
    const turbulence =
      Math.sin(ts * 0.00041) * 0.000011 +
      Math.sin(ts * 0.00133) * 0.000007 +
      Math.sin(ts * 0.00301) * 0.000004 +
      Math.sin(ts * 0.00007) * 0.000006;
    for (const body of this.world.world.bodies) {
      if (body.isStatic) continue;
      if (!body.label.startsWith('block')) continue;
      Matter.Body.applyForce(body, body.position, {
        x: turbulence * body.mass,
        y: 0,
      });
    }

    // Decay shake and frost-flash each frame so the gust visuals fade out
    // naturally over ~1s after the event.
    if (this.iceShakeAmp > 0) {
      this.iceShakeAmp = Math.max(0, this.iceShakeAmp - dt * 0.012);
    }
    if (this.iceFrostFlash > 0) {
      this.iceFrostFlash = Math.max(0, this.iceFrostFlash - dt * 0.001);
    }

    this.iceGustTimer += dt;
    const GUST_INTERVAL = 7000;
    if (this.iceGustTimer >= GUST_INTERVAL) {
      this.iceGustTimer = 0;
      this.iceGustDir = Math.random() > 0.5 ? 1 : -1;
      const dir = this.iceGustDir;

      // Wake every settled block so the whole tower feels the storm.
      for (const body of this.world.world.bodies) {
        if (body.isStatic) continue;
        if (!body.label.startsWith('block')) continue;
        Matter.Sleeping.set(body, false);
        Matter.Body.applyForce(body, body.position, {
          x: dir * 0.00018 * body.mass,
          y: 0,
        });
      }

      // Frost-edge overlay only — the platform shouldn't jitter during a
      // gust, so the camera-shake is intentionally not triggered. The frost
      // flash plus the windblown blocks carry the storm cue on their own.
      if (!this.cfg.reduceMotion) {
        this.iceFrostFlash = 1;
      }

      // Plume — ice-white / frost-mist only. No neon.
      const w = this.canvas.clientWidth;
      const h = this.canvas.clientHeight;
      const startX = dir > 0 ? -20 : w + 20;
      this.particles.emit({
        x: startX,
        y: h * 0.28,
        count: 30,
        colors: ['#F7FDFF', '#DFF6FF', '#ffffff'],
        speed: 9,
        spread: Math.PI / 7,
        life: 1300,
        size: 2.2,
        gravity: 0.018,
        shape: 'circle',
      });
      this.particles.emit({
        x: startX,
        y: h * 0.52,
        count: 22,
        colors: ['#F7FDFF', '#DFF6FF'],
        speed: 7,
        spread: Math.PI / 8,
        life: 1100,
        size: 1.6,
        gravity: 0.018,
        shape: 'circle',
      });

      // Plume needs horizontal initial velocity — emit() only spreads
      // around vertical-up. Patch the latest particles.
      const total = 52;
      const particles = this.particles.particles;
      for (let i = particles.length - total; i < particles.length; i++) {
        if (i < 0) continue;
        const p = particles[i];
        const sideSpeed = 8 + Math.random() * 6;
        p.vx = dir * sideSpeed;
        p.vy = (Math.random() - 0.5) * 1.2;
      }

      // Muffled wind cue — quieter than before. No on-screen toast: the
      // visuals (shake + frost overlay + plume) carry the message.
      playSfx('wobble', 0.32);
    }
  }

  /**
   * Jelly-mode ambient motion. Nothing should feel rigid: every few seconds a
   * tiny vertical "jiggle" impulse wakes the settled tower so it gently
   * wobbles and resettles. Much gentler than the ice storm — there is no
   * camera shake and no horizontal push that could topple a fair stack.
   */
  private tickJellyPhysics(dt: number) {
    if (!this.jellyMode) return;
    this.jellyWiggleTimer += dt;
    const WIGGLE_INTERVAL = 3600;
    if (this.jellyWiggleTimer < WIGGLE_INTERVAL) return;
    this.jellyWiggleTimer = 0;
    for (const body of this.world.world.bodies) {
      if (body.isStatic) continue;
      if (!body.label.startsWith('block')) continue;
      Matter.Sleeping.set(body, false);
      // A faint upward nudge — the tower bobs and settles, propagating a
      // little wobble up the stack via the springy restitution.
      Matter.Body.applyForce(body, body.position, {
        x: (Math.random() - 0.5) * 0.00002 * body.mass,
        y: -0.00006 * body.mass,
      });
    }
  }

  /**
   * Apply the current ice-mode camera shake to a base cameraY value.
   * Returns a tweaked y so the render loop can centralise the shift.
   */
  private applyIceShake(baseY: number): number {
    if (this.iceShakeAmp <= 0) return baseY;
    // Random small offset, weighted by current amplitude. Decay handled in
    // tickIcePhysics so the shake naturally fades each frame.
    return baseY + (Math.random() - 0.5) * this.iceShakeAmp * 2;
  }

  /**
   * Detect blocks that have fallen off the platform. With no side walls,
   * a block that slips off either side falls into the void and gets
   * cleaned up here once its center crosses the fall threshold. The
   * side-slip check covers the edge case of a block balanced on the
   * platform's corner with its center already past the edge.
   */
  private checkForFallenBlocks() {
    const platform = this.world.platform;
    const platformWidth =
      (platform as Matter.Body & { _platformWidth?: number })._platformWidth ?? 220;
    const platformLeft = platform.position.x - platformWidth / 2;
    const platformRight = platform.position.x + platformWidth / 2;
    // Platform half-height is 13 px. Any block whose center has dropped past
    // the platform's bottom face has clearly slipped off and shouldn't linger
    // wedged against the platform's underside or the wall corner.
    const fallThreshold = this.platformBaseY + 14;
    // A block whose center has slipped off the side of the platform and is
    // no longer stacked on top of anything (i.e., it's at or below platform
    // level rather than part of the rising tower) has no real support. Left
    // alone, such blocks get wedged in the corner between the platform's
    // side and the canvas edge wall, where they accumulate and block new
    // drops. Treat them as fallen as soon as they end up there.
    const sideFallThreshold = this.platformBaseY - 30;
    let collapsedThisTick = 0;
    for (let i = this.placedBlocks.length - 1; i >= 0; i--) {
      const body = this.placedBlocks[i];
      const meta = (body as Matter.Body & { _meta?: BodyMeta })._meta;
      if (!meta || meta.shattered) continue;
      if (body.isStatic) continue;

      const fellBelow = body.position.y > fallThreshold;
      const centerOffSide =
        body.position.x < platformLeft - 2 || body.position.x > platformRight + 2;
      const atPlatformLevel = body.position.y > sideFallThreshold;
      const slippedOffSide = centerOffSide && atPlatformLevel;

      if (fellBelow || slippedOffSide) {
        meta.shattered = true;
        collapsedThisTick++;
        this.blocksCollapsedCount++;
        this.collapses++;
        this.combo = 0;
        const px = body.position.x;
        const py = body.position.y;
        // In ice mode, a collapse reads as the block fracturing on the frozen
        // floor: shards spraying out, fine ice chips, and a puff of drifting
        // snow that lingers as the piece breaks apart.
        const screenY = Math.min(this.canvas.clientHeight - 20, py - this.cameraY);
        if (this.iceMode) {
          this.particles.emitIceShatter(px, screenY, 20);
          this.particles.emitIceFlakes(px, screenY, 14);
          this.particles.emitSnowflakes(px, screenY - 8, 10);
        } else {
          this.particles.emitBurst(px, screenY, meta.spec.color, 14);
        }
        this.placedBlocks.splice(i, 1);
        const undoIdx = this.undoStack.indexOf(body);
        if (undoIdx >= 0) this.undoStack.splice(undoIdx, 1);
        Matter.World.remove(this.world.world, body);
      }
    }
    if (collapsedThisTick > 0) {
      this.cfg.callbacks.onCombo(0);
      this.cfg.callbacks.onCollapse(collapsedThisTick);
      playSfx('wobble', 0.6);
      if (this.collapses >= 3 && this.blocksPlacedCount >= 4) {
        this.lose();
      }
    }
  }

  private handleCollision = (event: Matter.IEventCollision<Matter.Engine>) => {
    for (const pair of event.pairs) {
      const a = pair.bodyA;
      const b = pair.bodyB;
      const blockBody = a.label.startsWith('block')
        ? a
        : b.label.startsWith('block')
          ? b
          : null;
      const groundHit =
        a.label === 'ground' || b.label === 'ground'
          ? blockBody
          : null;

      // Squash-on-landing: any block colliding with the platform or another
      // block at non-trivial downward speed flags itself for a quick visual
      // squash. Pick the block that's actually falling (larger downward vy).
      const platformInvolved = a.label === 'platform' || b.label === 'platform';
      const bothBlocks = a.label.startsWith('block') && b.label.startsWith('block');
      if (platformInvolved || bothBlocks) {
        const candidates: Matter.Body[] = [];
        if (a.label.startsWith('block')) candidates.push(a);
        if (b.label.startsWith('block')) candidates.push(b);
        for (const cand of candidates) {
          const m = (cand as Matter.Body & { _meta?: BodyMeta })._meta;
          if (!m || m.shattered) continue;
          const vy = cand.velocity.y;
          if (vy > 1.6) {
            const now = performance.now();
            const sinceLast = now - (m.landAt ?? 0);
            m.landAt = now;
            m.landIntensity = Math.max(
              m.landIntensity ?? 0,
              Math.min(1, (vy - 1) / 9),
            );
            // Ice mode: chip a few ice flakes off the impact point, throttled
            // so the same impact across multiple collision pairs doesn't
            // flood the scene. Stronger landings → more flakes + a snow puff.
            if (this.iceMode && sinceLast > 200) {
              const intensity = Math.min(1, (vy - 1.6) / 6);
              const flakeCount = 6 + Math.round(intensity * 10);
              const px = cand.position.x;
              const py = cand.bounds.max.y - this.cameraY;
              this.particles.emitIceFlakes(px, py, flakeCount);
              if (intensity > 0.4) {
                this.particles.emitSnowflakes(
                  px,
                  py - 4,
                  4 + Math.round(intensity * 6),
                );
              }
            }
            // Jelly mode: a bubble pop at the contact line on each notable
            // impact, throttled the same way so stacked collisions don't flood.
            if (this.jellyMode && sinceLast > 200) {
              const intensity = Math.min(1, (vy - 1.6) / 6);
              const px = cand.position.x;
              const py = cand.bounds.max.y - this.cameraY;
              this.particles.emitBubblePop(px, py, 8 + Math.round(intensity * 8));
              if (intensity > 0.45) {
                this.particles.emitJellyDroplets(px, py - 4, 4 + Math.round(intensity * 5));
              }
            }
          }
        }
      }

      if (groundHit) {
        const meta = (groundHit as Matter.Body & { _meta?: BodyMeta })._meta;
        if (meta && !meta.shattered) {
          this.blocksCollapsedCount++;
          this.collapses++;
          this.combo = 0;
          this.cfg.callbacks.onCombo(0);
          this.cfg.callbacks.onCollapse(1);
          playSfx('wobble', 0.6);
          if (this.iceMode) {
            const gx = groundHit.position.x;
            const gy = this.canvas.clientHeight - 40;
            this.particles.emitIceShatter(gx, gy, 20);
            this.particles.emitIceFlakes(gx, gy, 14);
            this.particles.emitSnowflakes(gx, gy - 8, 10);
          } else {
            this.particles.emitBurst(
              groundHit.position.x,
              this.canvas.clientHeight - 40,
              meta.spec.color,
              14,
            );
          }
          meta.shattered = true;
          const toRemove = groundHit;
          setTimeout(() => {
            if (this.world.world.bodies.includes(toRemove)) {
              Matter.World.remove(this.world.world, toRemove);
              const idx = this.placedBlocks.indexOf(toRemove);
              if (idx >= 0) this.placedBlocks.splice(idx, 1);
            }
          }, 400);
          if (this.collapses >= 4 && this.blocksPlacedCount > 5) {
            this.lose();
          }
        }
      }
    }
  };

  private lose() {
    if (this.isLost || this.isWon) return;
    this.isLost = true;
    playSfx('gameover');
    const lcx = this.canvas.clientWidth / 2;
    const lcy = this.canvas.clientHeight / 2;
    if (this.iceMode) {
      // The tower shatters: an icy cloud around a Pale-Red-Frost hazard burst
      // (the palette's only red, reserved for collapses).
      this.particles.emitIceShatter(lcx, lcy, 40);
      this.particles.emitBurst(lcx, lcy, '#FF5C7A', 28);
    } else if (this.jellyMode) {
      // The jelly deflates: a soft wobble of droplets and bubble pops rather
      // than a hard shatter.
      this.particles.emitJellyDroplets(lcx, lcy, 30);
      this.particles.emitBubblePop(lcx, lcy, 24);
    } else {
      this.particles.emitBurst(lcx, lcy, '#ff5252', 60);
    }
    this.cfg.callbacks.onLost();
    vibrate(80);
  }

  private win() {
    if (this.isLost || this.isWon) return;
    this.isWon = true;
    playSfx('milestone');
    const wx = this.canvas.clientWidth / 2;
    const wy = this.canvas.clientHeight / 3;
    if (this.iceMode) {
      // Aurora particles with crystal snowflakes raining down through them.
      this.particles.emitAurora(wx, wy, 70);
      this.particles.emitSnowflakes(wx, wy - this.canvas.clientHeight / 12, 36);
    } else if (this.jellyMode) {
      // Candy shower — gummy bits flung upward through a haze of sugar.
      this.particles.emitCandyShower(wx, wy, 80);
    } else {
      this.particles.emitConfetti(wx, wy, 120);
    }
    this.cfg.callbacks.onWon();
    vibrate(40);
  }

  private loop = (ts: number) => {
    if (!this.running) return;
    if (this.paused) {
      this.rafId = requestAnimationFrame(this.loop);
      return;
    }
    let dt = ts - this.lastTs;
    if (dt > 60) dt = 60;
    this.lastTs = ts;

    Matter.Engine.update(this.world.engine, dt);

    if (this.wind !== 0) {
      const gust = this.wind * (1 + Math.sin(ts * 0.0014) * 0.4);
      applyWind(this.world.world, gust);
    }

    if (this.bossActive && ts - this.lastWindBlast > 5000) {
      this.lastWindBlast = ts;
      const dir = Math.random() > 0.5 ? 1 : -1;
      const blast = dir * 0.9;
      const original = this.wind;
      this.wind = blast;
      this.particles.emit({
        x: dir > 0 ? 0 : this.canvas.clientWidth,
        y: this.canvas.clientHeight / 2,
        count: 24,
        colors: ['#ffffff', getAccentColor()],
        speed: 8,
        spread: Math.PI / 6,
        life: 700,
        size: 4,
        gravity: 0,
        shape: 'circle',
      });
      setTimeout(() => {
        this.wind = original;
      }, 700);
    }

    if (this.platformType === 'magnetic') {
      applyMagneticPull(this.world, this.world.world);
    }

    this.checkForFallenBlocks();
    this.tickDisturbances(dt);
    this.tickIcePhysics(dt, ts);
    this.tickJellyPhysics(dt);

    let topY = this.platformBaseY;
    for (const b of this.placedBlocks) {
      // Skip blocks that are still falling/tumbling fast — they shouldn't
      // yank the camera while in motion.
      if (Math.abs(b.velocity.y) > 4) continue;
      if (b.position.y < topY) topY = b.position.y;
    }
    const towerHeight = this.platformBaseY - topY;
    this.cfg.callbacks.onHeight(towerHeight);

    // Camera tracking: keep tower top at ~35% from the top of the viewport
    // once the tower climbs above that line. Below it, the camera stays put.
    // Negative cameraY shifts world content DOWN on screen.
    const viewport = this.canvas.clientHeight;
    const targetTopOnScreen = viewport * 0.35;
    let desired = topY - targetTopOnScreen;
    if (desired > 0) desired = 0; // never scroll below starting position
    // Lower bound: don't scroll up so far that the platform's top edge
    // disappears past the canvas bottom (would reveal empty space below).
    const minCamera = -Math.max(0, this.bottomReserved - 20);
    if (desired < minCamera) desired = minCamera;

    // Deadband: only adopt a new target if the change is meaningful. Prevents
    // micro-jitter from constantly nudging the camera on small tower shifts.
    if (Math.abs(desired - this.targetCameraY) > 18) {
      this.targetCameraY = desired;
    }
    if (this.targetCameraY > 0) this.targetCameraY = 0;
    if (this.targetCameraY < minCamera) this.targetCameraY = minCamera;

    this.cameraY += (this.targetCameraY - this.cameraY) * 0.09;
    if (this.cameraY > 0) this.cameraY = 0;
    if (this.cameraY < minCamera) this.cameraY = minCamera;

    this.particles.step(dt);

    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    // World-space camera Y for this frame. In ice mode we apply the storm
    // shake here so platform, blocks, particles all wobble together with
    // the camera (the backdrop is drawn flat so the shake reads as the
    // viewport shaking, not the sky).
    const renderCameraY = this.iceMode ? this.applyIceShake(this.cameraY) : this.cameraY;
    clear(this.ctx, w, h);
    this.ctx.save();
    if (this.iceMode) {
      drawIceBackdrop({
        ctx: this.ctx,
        width: w,
        height: h,
        cameraY: this.cameraY,
        shake: 0,
        reduceMotion: this.cfg.reduceMotion,
      });
    } else if (this.jellyMode) {
      drawJellyBackdrop({
        ctx: this.ctx,
        width: w,
        height: h,
        cameraY: this.cameraY,
        shake: 0,
        reduceMotion: this.cfg.reduceMotion,
      });
    } else {
      drawBackdrop({
        ctx: this.ctx,
        width: w,
        height: h,
        cameraY: this.cameraY,
        shake: 0,
        reduceMotion: this.cfg.reduceMotion,
      });
    }

    if (this.goalHeight > 0) {
      drawHeightLine(
        this.ctx,
        w,
        this.platformBaseY,
        renderCameraY,
        this.goalHeight,
        `Goal: ${Math.round(this.goalHeight / 6)}m`,
      );
    }

    drawPlatform(this.ctx, this.world.platform, this.platformType, renderCameraY);

    // Two-layer continuous snowfield. Far snow is tiny and slow (almost
    // static drift, low parallax); near snow is larger with slight sway via
    // a velocity wobble. Emission cadence chosen so a few hundred flakes
    // are always on screen without overwhelming the particle list.
    if (this.iceMode && !this.cfg.reduceMotion) {
      this.snowEmitTimer += dt;
      if (this.snowEmitTimer > 60) {
        this.snowEmitTimer = 0;
        // Far layer (tiny, slow, white).
        this.particles.emit({
          x: Math.random() * w,
          y: -8,
          count: 1,
          colors: ['#F7FDFF', '#DFF6FF'],
          speed: 0.3,
          spread: Math.PI / 6,
          life: 8000,
          size: 0.8 + Math.random() * 0.8,
          gravity: 0.003,
          shape: 'circle',
        });
        // Near layer (larger, faster, slight sway).
        this.particles.emit({
          x: Math.random() * w,
          y: -8,
          count: 1,
          colors: ['#F7FDFF', '#DFF6FF', '#ffffff'],
          speed: 0.8,
          spread: Math.PI / 4,
          life: 4500,
          size: 2 + Math.random() * 1.8,
          gravity: 0.014,
          shape: 'circle',
        });
        // Sway: nudge the most-recently-added near flake with a small
        // horizontal velocity that varies with overall turbulence so snow
        // drifts along the same direction the wind is moving.
        const turbulenceNow =
          Math.sin(ts * 0.00041) +
          Math.sin(ts * 0.00133) * 0.4;
        const last = this.particles.particles[this.particles.particles.length - 1];
        if (last) last.vx += turbulenceNow * 0.15;
      }
    }

    for (const body of this.world.world.bodies) {
      if (!body.label.startsWith('block')) continue;
      const meta = (body as Matter.Body & { _meta?: BodyMeta })._meta;
      if (!meta) continue;
      drawBlock(this.ctx, body, meta.spec, renderCameraY, false, this.iceMode, this.jellyMode);
    }

    // Drop preview: silhouette at snapped landing position + ghost at raw pointer
    if (this.inflightDrop) {
      const drop = this.inflightDrop;
      if (drop.valid) {
        drawLandingSilhouette(
          this.ctx,
          drop.spec,
          drop.snappedX,
          drop.landingY,
          0,
          renderCameraY,
          this.iceMode,
          this.jellyMode,
        );
        drawDragGhost(
          this.ctx,
          drop.spec,
          drop.pointerX,
          drop.pointerY,
          0,
          this.iceMode,
          this.jellyMode,
        );
      } else {
        drawInvalidIndicator(
          this.ctx,
          drop.spec,
          drop.snappedX,
          drop.pointerY,
          0,
        );
      }
    }

    this.particles.draw(this.ctx);

    // Gust frost overlay — painted after world + particles so it covers
    // everything for the brief moment it's visible. Decays back to 0 each
    // frame inside tickIcePhysics.
    if (this.iceMode && this.iceFrostFlash > 0) {
      drawGustFrostOverlay(this.ctx, w, h, this.iceFrostFlash);
    }

    this.ctx.restore();

    this.bossTimer += dt;

    this.rafId = requestAnimationFrame(this.loop);
  };
}

function avgDelta(arr: number[]): number {
  if (arr.length < 2) return 0;
  const deltas = [];
  for (let i = 1; i < arr.length; i++) deltas.push(arr[i] - arr[i - 1]);
  return deltas.reduce((s, d) => s + d, 0) / deltas.length;
}

function hashChallenge(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) >>> 0;
  return h >>> 0;
}
