import { CHALLENGES } from './challenges';
import { seededRng } from './blockFactory';
import type { DailySpec } from './types';

export function getTodayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function getDailyChallenge(date = new Date()): DailySpec {
  const key = getTodayKey(date);
  const seed = hashString(key);
  const rng = seededRng(seed);
  const idx = Math.floor(rng() * CHALLENGES.length);
  const baseChallenge = CHALLENGES[idx];

  // Slight randomization of goals for variety
  const goalScore = Math.round(baseChallenge.goalScore * (0.85 + rng() * 0.4));
  const goalHeight = Math.round(baseChallenge.goalHeight * (0.9 + rng() * 0.3));

  const challenge = { ...baseChallenge, goalScore, goalHeight };

  return { date: key, seed, challenge };
}
