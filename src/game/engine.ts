import Matter from 'matter-js';
import {
  applyMagneticPull,
  applyShake,
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
import {
  clear,
  drawBackdrop,
  drawBlock,
  drawDragGhost,
  drawHeightLine,
  drawInvalidIndicator,
  drawLandingSilhouette,
  drawPlatform,
} from './renderer';
import { cellsFor } from './shapes';
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
  private shake = 0;
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
  private shakePhase = 0;
  private rng: () => number;
  private isLost = false;
  private isWon = false;
  private goalScore: number;
  private goalHeight: number;
  private bossActive = false;
  private bossTimer = 0;
  private screenShake = 0;
  private lastWindBlast = 0;
  private disturbanceTimer = 0;

  constructor(cfg: EngineConfig) {
    this.cfg = cfg;
    this.canvas = cfg.canvas;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('No 2D context');
    this.ctx = ctx;
    this.mode = cfg.mode;
    this.challenge = cfg.challenge ?? null;
    this.platformType = cfg.platform;
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
    this.platformBaseY = this.canvas.clientHeight - this.bottomReserved;
    recreatePlatform(
      this.world,
      this.canvas.clientWidth / 2,
      this.platformBaseY,
      this.platformType,
      220,
    );
    (this.world.platform as Matter.Body & { _baseY?: number })._baseY =
      this.platformBaseY;

    if (this.challenge) {
      this.wind = this.challenge.wind;
      this.shake = this.challenge.shake;
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
      (this.world.platform as Matter.Body & { _baseY?: number })._baseY = newBaseY;

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

    const projected = this.projectLanding(spec, snappedX);
    if (!Number.isFinite(projected.y) || projected.cellsSupported === 0) {
      this.inflightDrop.valid = false;
      this.inflightDrop.landingY = pointerY + this.cameraY;
      return;
    }

    // Placement is decided by horizontal position alone — the piece always
    // falls to its projected rest. Don't reject just because the cursor is
    // below the projected landing: when slotting a piece into a narrow gap
    // beside a tall neighbour, the projection lands on top of that neighbour
    // (where the cell overhangs) but the player's cursor is naturally down in
    // the gap. Rejecting that case is what made tight placements feel blocked.
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
   * The projection picks the DEEPEST rest position the piece can occupy without
   * overlapping any obstacle. That lets a piece slot down into a pocket between
   * existing blocks (e.g. an L's column dropping past a Z's top row to land on
   * the platform with the foot tucked into the Z's bottom-left notch) instead
   * of always resting on the topmost obstacle that shares a column with one of
   * its cells.
   */
  private projectLanding(
    spec: BlockSpec,
    pointerX: number,
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
      return { y, cellsSupported: supported };
    }

    return {
      y: candidates[candidates.length - 1],
      cellsSupported: 0,
    };
  }

  private snapPlace() {
    if (!this.inflightDrop || !this.inflightDrop.valid) return;
    const { spec, snappedX, landingY } = this.inflightDrop;
    const pinned = this.pinArmed;
    this.inflightDrop = null;

    // Remove from tray
    this.trayBlocks = this.trayBlocks.filter((b) => b.id !== spec.id);
    this.cfg.callbacks.onTray([...this.trayBlocks]);

    const body = spawnBlock(this.world.world, {
      x: snappedX,
      y: landingY,
      spec,
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

    // Less angular damping at higher difficulty → blocks tip more easily
    const angDamp = Math.max(0.002, 0.012 - (this.difficulty - 1) * 0.0025);
    (body as Matter.Body & { angularDamping: number }).angularDamping = angDamp;

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

    playSfx('place');
    vibrate(10);
    this.particles.emitImpact(
      body.position.x,
      body.position.y - this.cameraY,
      8,
    );

    setTimeout(() => this.scoreAfterSettle(body), 700);

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

  private scoreAfterSettle(body: Matter.Body) {
    if (!this.placedBlocks.includes(body)) return;
    const meta = (body as Matter.Body & { _meta?: BodyMeta })._meta;
    if (!meta || meta.scored) return;
    if (meta.shattered) return;
    if (body.position.y > this.platformBaseY) return;

    const sleeping = body.isSleeping;
    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    const stable = sleeping || speed < 0.4;

    const heightAboveBase = Math.max(0, this.platformBaseY - body.position.y);
    const platformX = this.world.platform.position.x;
    const platformWidth =
      (this.world.platform as Matter.Body & { _platformWidth?: number })._platformWidth ??
      220;
    const horizontalOffset = Math.abs(body.position.x - platformX);
    const centeredness = Math.max(0, 1 - horizontalOffset / (platformWidth / 2));

    if (stable) {
      this.combo += 1;
      this.bestComboThisGame = Math.max(this.bestComboThisGame, this.combo);
    } else {
      this.combo = 0;
    }
    this.cfg.callbacks.onCombo(this.combo);

    const { total, breakdown } = scorePlacement({
      heightAboveBase,
      combo: this.combo,
      difficulty: this.difficulty,
      blockSpec: meta.spec,
      stable,
      perfectStack: stable && centeredness > 0.92 && this.combo >= 3,
      centeredness,
    });
    meta.scored = true;
    this.score += total;
    this.cfg.callbacks.onScore(total, breakdown);

    if (stable && this.combo >= 3) {
      playSfx('placeGood', 0.9);
      this.particles.emitBurst(
        body.position.x,
        body.position.y - this.cameraY,
        meta.spec.color,
        12,
      );
    }

    if (this.blocksPlacedCount % 3 === 0) {
      this.maybeAdjustDifficulty();
    }

    if (this.mode === 'endless') {
      const threshold = levelScoreThreshold(this.level);
      if (this.score >= threshold) {
        this.level++;
        playSfx('levelup');
        this.particles.emitConfetti(
          this.canvas.clientWidth / 2,
          this.canvas.clientHeight / 3,
          80,
        );
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
      const eff = effectsFor(next);
      if (!this.challenge) {
        this.wind = eff.windSpeed * (Math.random() > 0.5 ? 1 : -1);
        // Platform stays still during adaptive progression — no shake.
        this.shake = 0;
      }
      this.applyDifficultyPhysics();
    }
  }

  /**
   * Crank up gravity (and slip) at higher difficulty so the tower feels more
   * sensitive to imperfect placements. Existing blocks are left alone — the
   * change only affects the gravity field and newly-spawned pieces.
   */
  private applyDifficultyPhysics() {
    const d = this.difficulty;
    // d=1 → 0.0014 (default). d=5 → ~0.0024 (~70% heavier feel).
    const scale = 0.0014 + (d - 1) * 0.00025;
    this.world.engine.gravity.scale = scale;
  }

  /**
   * At difficulty ≥ 3 apply periodic micro-impulses to the upper tower so it
   * sways and requires more careful placement. The higher the difficulty the
   * more frequent and stronger the disturbances.
   */
  private tickDisturbances(dt: number) {
    const d = this.difficulty;
    if (d < 3 || this.placedBlocks.length < 3) return;
    this.disturbanceTimer += dt;
    // d=3 → every 2400 ms, d=5 → every 1200 ms
    const interval = 3600 - d * 600;
    if (this.disturbanceTimer < interval) return;
    this.disturbanceTimer = 0;

    // Target the top third of the tower (most likely to tip)
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
        this.particles.emitBurst(
          px,
          Math.min(this.canvas.clientHeight - 20, py - this.cameraY),
          meta.spec.color,
          14,
        );
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
      if (groundHit) {
        const meta = (groundHit as Matter.Body & { _meta?: BodyMeta })._meta;
        if (meta && !meta.shattered) {
          this.blocksCollapsedCount++;
          this.collapses++;
          this.combo = 0;
          this.cfg.callbacks.onCombo(0);
          this.cfg.callbacks.onCollapse(1);
          playSfx('wobble', 0.6);
          this.particles.emitBurst(
            groundHit.position.x,
            this.canvas.clientHeight - 40,
            meta.spec.color,
            14,
          );
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
    this.particles.emitBurst(
      this.canvas.clientWidth / 2,
      this.canvas.clientHeight / 2,
      '#ff5252',
      60,
    );
    this.screenShake = 28;
    this.cfg.callbacks.onLost();
    vibrate(80);
  }

  private win() {
    if (this.isLost || this.isWon) return;
    this.isWon = true;
    playSfx('milestone');
    this.particles.emitConfetti(
      this.canvas.clientWidth / 2,
      this.canvas.clientHeight / 3,
      120,
    );
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
        colors: ['#ffffff', '#ffd60a'],
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

    if (this.shake > 0) {
      applyShake(this.world, this.shake, ts);
      this.shakePhase = ts;
    }

    if (this.platformType === 'magnetic') {
      applyMagneticPull(this.world, this.world.world);
    }

    this.checkForFallenBlocks();
    this.tickDisturbances(dt);

    let topY = this.platformBaseY;
    for (const b of this.placedBlocks) {
      if (b.position.y < topY) topY = b.position.y;
    }
    const towerHeight = this.platformBaseY - topY;
    this.cfg.callbacks.onHeight(towerHeight);
    // Negative camera shifts world content DOWN on screen, so as the tower
    // grows past ~50% of the viewport the platform drifts toward the bottom
    // edge (and eventually off it) while the tower top stays in upper view.
    // The 1.25 multiplier pushes the platform a bit further than the raw
    // tower-height delta would suggest.
    this.targetCameraY = -1.25 * Math.max(
      0,
      this.platformBaseY - topY - this.canvas.clientHeight * 0.5,
    );
    this.cameraY += (this.targetCameraY - this.cameraY) * 0.06;

    this.particles.step(dt);

    if (this.screenShake > 0.1) this.screenShake *= 0.9;
    else this.screenShake = 0;
    const sx = (Math.random() - 0.5) * this.screenShake;
    const sy = (Math.random() - 0.5) * this.screenShake;

    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    clear(this.ctx, w, h);
    this.ctx.save();
    this.ctx.translate(sx, sy);
    drawBackdrop({
      ctx: this.ctx,
      width: w,
      height: h,
      cameraY: this.cameraY,
      shake: this.screenShake,
      reduceMotion: this.cfg.reduceMotion,
    });

    if (this.goalHeight > 0) {
      drawHeightLine(
        this.ctx,
        w,
        this.platformBaseY,
        this.cameraY,
        this.goalHeight,
        `Goal: ${Math.round(this.goalHeight / 6)}m`,
      );
    }

    drawPlatform(this.ctx, this.world.platform, this.platformType, this.cameraY);

    for (const body of this.world.world.bodies) {
      if (!body.label.startsWith('block')) continue;
      const meta = (body as Matter.Body & { _meta?: BodyMeta })._meta;
      if (!meta) continue;
      drawBlock(this.ctx, body, meta.spec, this.cameraY, false);
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
          this.cameraY,
        );
        drawDragGhost(
          this.ctx,
          drop.spec,
          drop.pointerX,
          drop.pointerY,
          0,
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
