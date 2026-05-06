import type { BlockShape, BlockSpec } from './types';
import { dimsFor } from './shapes';

/** Standard tetromino colors. */
export const SHAPE_COLORS: Record<BlockShape, { color: string; accent: string }> = {
  I: { color: '#3ee5ff', accent: '#c2f4ff' },
  O: { color: '#ffe23e', accent: '#fff8c2' },
  T: { color: '#a23eff', accent: '#dcc2ff' },
  S: { color: '#62ffb1', accent: '#cfffe0' },
  Z: { color: '#ff5252', accent: '#ffd0d0' },
  L: { color: '#ffb13e', accent: '#fff0c2' },
  J: { color: '#5a8bff', accent: '#c2d4ff' },
};

export const ALL_SHAPES: BlockShape[] = ['I', 'O', 'T', 'S', 'Z', 'L', 'J'];

/**
 * Per-difficulty weights. Higher difficulty biases toward awkward pieces
 * (S, Z, T) and away from the easy I/O. d=5 is mostly zigzags.
 */
const SHAPE_WEIGHTS: Record<number, Array<[BlockShape, number]>> = {
  1: [['I', 4], ['O', 4], ['L', 2], ['J', 2]],
  2: [['I', 3], ['O', 3], ['L', 3], ['J', 3], ['T', 2]],
  3: [['I', 2], ['O', 2], ['L', 3], ['J', 3], ['T', 3], ['S', 2], ['Z', 2]],
  4: [['I', 1], ['O', 1], ['L', 2], ['J', 2], ['T', 3], ['S', 4], ['Z', 4]],
  5: [['L', 1], ['J', 1], ['T', 3], ['S', 5], ['Z', 5]],
};

function pickWeighted(
  weights: Array<[BlockShape, number]>,
  rng: () => number,
): BlockShape {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [shape, w] of weights) {
    r -= w;
    if (r <= 0) return shape;
  }
  return weights[weights.length - 1][0];
}

/** Default cell size (pixels). */
export const DEFAULT_UNIT = 32;

let blockId = 0;
export const newBlockId = () => `b_${Date.now().toString(36)}_${(blockId++).toString(36)}`;

interface FactoryOpts {
  difficulty: number; // 1..5
  rng?: () => number;
  forceShape?: BlockShape;
  shapesAllowed?: BlockShape[];
  unitSize?: number;
}

export function pick<T>(arr: T[], rng = Math.random): T {
  return arr[Math.floor(rng() * arr.length)];
}

function selectShape(
  difficulty: number,
  rng: () => number,
  allowed?: BlockShape[],
): BlockShape {
  if (allowed && allowed.length > 0) return pick(allowed, rng);
  const d = Math.max(1, Math.min(5, Math.round(difficulty)));
  const weights = SHAPE_WEIGHTS[d] ?? SHAPE_WEIGHTS[3];
  return pickWeighted(weights, rng);
}

export function generateBlock(opts: FactoryOpts): BlockSpec {
  const rng = opts.rng ?? Math.random;
  const shape =
    opts.forceShape ?? selectShape(opts.difficulty, rng, opts.shapesAllowed);
  const unit = opts.unitSize ?? DEFAULT_UNIT;
  const { w, h } = dimsFor(shape, unit);
  const palette = SHAPE_COLORS[shape];

  // Slipperier blocks at higher difficulty so the tower wobbles more easily.
  // Coefficients tuned toward real wood-on-wood (~0.4) — high enough to stack
  // a clean tower, low enough that an overhang or off-center placement slips.
  const d = Math.max(1, Math.min(5, opts.difficulty));
  const friction = 0.55 - (d - 1) * 0.08; // d=1 → 0.55, d=5 → 0.23

  return {
    id: newBlockId(),
    shape,
    width: w,
    height: h,
    unit,
    color: palette.color,
    accent: palette.accent,
    density: 0.0016,
    friction,
    restitution: 0.02,
  };
}

export function generateTray(
  count: number,
  difficulty: number,
  opts?: Partial<FactoryOpts>,
): BlockSpec[] {
  return Array.from({ length: count }, () =>
    generateBlock({ difficulty, ...(opts ?? {}) }),
  );
}

// Mulberry32 PRNG for daily seeded generation.
export function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
