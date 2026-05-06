import type { GameStats } from './types';

export interface AdaptiveSnapshot {
  successRate: number;
  avgPlacementMs: number;
  collapseRate: number;
  comboBest: number;
  attemptsAtCurrentLevel: number;
}

/**
 * Adaptive difficulty engine.
 *
 * Rule-based heuristic: combines several signals into a "performance score" in [0, 1].
 * - High success rate, fast placement, high combos -> increase difficulty.
 * - Frequent collapses, slow play, repeated retries -> decrease difficulty.
 *
 * Output: target difficulty 1..5, smoothed (we never jump more than 1 step at a time).
 */
export function analyze(stats: GameStats): AdaptiveSnapshot {
  const totalDrops = Math.max(1, stats.blocksPlaced + stats.blocksCollapsed);
  const successRate = stats.blocksPlaced / totalDrops;
  const collapseRate = stats.collapses / Math.max(1, stats.blocksPlaced);
  return {
    successRate,
    avgPlacementMs: stats.avgPlacementMs || 0,
    collapseRate,
    comboBest: stats.comboBest,
    attemptsAtCurrentLevel: stats.attemptsAtCurrentLevel,
  };
}

export function performanceScore(s: AdaptiveSnapshot): number {
  // success: 0 -> 0, 1 -> 1
  const success = clamp(s.successRate, 0, 1);

  // speed: sub-1.5s great, > 4s slow. Map to [0..1]
  const ms = s.avgPlacementMs || 0;
  let speed = 1;
  if (ms > 0) {
    speed = clamp(1 - (ms - 1500) / 2500, 0, 1);
  } else {
    speed = 0.5; // unknown -> neutral
  }

  // combo: 5+ great
  const combo = clamp(s.comboBest / 6, 0, 1);

  // collapse penalty: 0 collapses good
  const collapsePenalty = clamp(1 - s.collapseRate * 1.5, 0, 1);

  // attempts: many retries -> player frustrated
  const attemptPenalty = clamp(1 - (s.attemptsAtCurrentLevel - 1) * 0.18, 0, 1);

  return (
    success * 0.32 +
    speed * 0.16 +
    combo * 0.18 +
    collapsePenalty * 0.22 +
    attemptPenalty * 0.12
  );
}

export function targetDifficulty(perf: number): number {
  // Map [0..1] to [1..5]
  if (perf < 0.18) return 1;
  if (perf < 0.36) return 2;
  if (perf < 0.55) return 3;
  if (perf < 0.78) return 4;
  return 5;
}

export function smoothDifficulty(current: number, target: number): number {
  if (target > current) return current + 1;
  if (target < current) return current - 1;
  return current;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export interface DifficultyEffects {
  trayCapacity: number;
  shapesHardening: number;
  windSpeed: number;
  shakeIntensity: number;
  modifierProb: number;
}

export function effectsFor(d: number): DifficultyEffects {
  return {
    trayCapacity: 3 + (d >= 4 ? 1 : 0),
    shapesHardening: d,
    windSpeed: d <= 2 ? 0 : ((d - 2) / 3) * 0.6,
    shakeIntensity: d <= 3 ? 0 : ((d - 3) / 2) * 0.6,
    modifierProb: 0.1 + d * 0.1,
  };
}
