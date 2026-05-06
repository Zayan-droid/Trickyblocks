import { create } from 'zustand';
import type {
  BlockSpec,
  ChallengeSpec,
  GameMode,
  GameStats,
  PlatformType,
} from '@/game/types';

export type GamePhase = 'idle' | 'playing' | 'paused' | 'won' | 'lost';

interface GameState {
  mode: GameMode;
  phase: GamePhase;
  level: number;
  score: number;
  highestScore: number;
  difficulty: number; // 1-5 stars
  stars: number;
  combo: number;
  goalScore: number;
  goalHeight: number;
  platform: PlatformType;
  challenge: ChallengeSpec | null;
  tray: BlockSpec[];
  trayCapacity: number;
  stats: GameStats;
  windSpeed: number;
  shakeIntensity: number;
  toast: string | null;
  setMode: (m: GameMode) => void;
  setPhase: (p: GamePhase) => void;
  setLevel: (n: number) => void;
  setScore: (s: number) => void;
  addScore: (n: number) => void;
  setDifficulty: (d: number) => void;
  setCombo: (c: number) => void;
  setTray: (t: BlockSpec[]) => void;
  removeFromTray: (id: string) => void;
  setTrayCapacity: (n: number) => void;
  setPlatform: (p: PlatformType) => void;
  setChallenge: (c: ChallengeSpec | null) => void;
  setGoals: (score: number, height: number) => void;
  setWind: (w: number) => void;
  setShake: (s: number) => void;
  setToast: (t: string | null) => void;
  patchStats: (p: Partial<GameStats>) => void;
  resetGame: (mode: GameMode) => void;
  setHighestScore: (n: number) => void;
}

const emptyStats = (): GameStats => ({
  startedAt: Date.now(),
  blocksPlaced: 0,
  blocksCollapsed: 0,
  highestY: 0,
  comboBest: 0,
  comboCurrent: 0,
  nearMisses: 0,
  avgPlacementMs: 0,
  lastPlacementMs: 0,
  totalActiveMs: 0,
  collapses: 0,
  attemptsAtCurrentLevel: 0,
});

export const useGameStore = create<GameState>((set) => ({
  mode: 'endless',
  phase: 'idle',
  level: 1,
  score: 0,
  highestScore: 0,
  difficulty: 1,
  stars: 0,
  combo: 0,
  goalScore: 100,
  goalHeight: 0,
  platform: 'wood',
  challenge: null,
  tray: [],
  trayCapacity: 3,
  stats: emptyStats(),
  windSpeed: 0,
  shakeIntensity: 0,
  toast: null,
  setMode: (m) => set({ mode: m }),
  setPhase: (p) => set({ phase: p }),
  setLevel: (n) => set({ level: n }),
  setScore: (s) => set({ score: s }),
  addScore: (n) =>
    set((s) => {
      const next = Math.max(0, s.score + n);
      return {
        score: next,
        highestScore: Math.max(s.highestScore, next),
      };
    }),
  setDifficulty: (d) => set({ difficulty: Math.max(1, Math.min(5, d)) }),
  setCombo: (c) => set({ combo: c }),
  setTray: (t) => set({ tray: t }),
  removeFromTray: (id) => set((s) => ({ tray: s.tray.filter((b) => b.id !== id) })),
  setTrayCapacity: (n) => set({ trayCapacity: n }),
  setPlatform: (p) => set({ platform: p }),
  setChallenge: (c) => set({ challenge: c }),
  setGoals: (score, height) => set({ goalScore: score, goalHeight: height }),
  setWind: (w) => set({ windSpeed: w }),
  setShake: (s) => set({ shakeIntensity: s }),
  setToast: (t) => set({ toast: t }),
  patchStats: (p) => set((s) => ({ stats: { ...s.stats, ...p } })),
  resetGame: (mode) =>
    set({
      mode,
      phase: 'idle',
      level: 1,
      score: 0,
      difficulty: 1,
      combo: 0,
      tray: [],
      trayCapacity: 3,
      stats: emptyStats(),
      windSpeed: 0,
      shakeIntensity: 0,
      toast: null,
    }),
  setHighestScore: (n) => set({ highestScore: n }),
}));
