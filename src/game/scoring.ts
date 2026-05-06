import type { BlockSpec } from './types';

export interface ScoreContext {
  heightAboveBase: number; // px
  combo: number;
  difficulty: number; // 1-5
  blockSpec: BlockSpec;
  stable: boolean;
  perfectStack?: boolean;
  centeredness?: number; // 0..1
}

export function scorePlacement(ctx: ScoreContext): {
  total: number;
  breakdown: Array<[string, number]>;
} {
  const breakdown: Array<[string, number]> = [];
  const base = Math.max(5, Math.round(ctx.heightAboveBase / 6));
  breakdown.push(['height', base]);

  let combo = 0;
  if (ctx.combo > 1) {
    combo = Math.round(base * 0.15 * ctx.combo);
    breakdown.push([`combo x${ctx.combo}`, combo]);
  }

  let difficultyBonus = Math.round(base * 0.1 * (ctx.difficulty - 1));
  if (difficultyBonus > 0) breakdown.push(['difficulty bonus', difficultyBonus]);

  let perfect = 0;
  if (ctx.perfectStack) {
    perfect = 25;
    breakdown.push(['perfect stack', perfect]);
  }

  let centerBonus = 0;
  if (typeof ctx.centeredness === 'number' && ctx.centeredness > 0.85) {
    centerBonus = 10;
    breakdown.push(['centered', centerBonus]);
  }

  let stableBonus = 0;
  if (ctx.stable) {
    stableBonus = 5;
    breakdown.push(['stable drop', stableBonus]);
  }

  void ctx.blockSpec;

  const total = base + combo + difficultyBonus + perfect + centerBonus + stableBonus;
  return { total, breakdown };
}

export function levelScoreThreshold(level: number): number {
  let total = 0;
  for (let i = 1; i <= level; i++) {
    total += 80 + (i - 1) * (60 + i * 8);
  }
  return total;
}
