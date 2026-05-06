import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DailyRecord {
  date: string;
  bestScore: number;
  completed: boolean;
}

interface ProgressState {
  highScores: Record<string, number>; // by mode
  endlessLevelReached: number;
  challengesCompleted: string[];
  dailyHistory: DailyRecord[];
  totalBlocksPlaced: number;
  totalCollapses: number;
  totalSessions: number;
  recordHighScore: (mode: string, score: number) => boolean;
  recordEndlessLevel: (level: number) => void;
  recordChallengeComplete: (id: string) => void;
  recordDaily: (date: string, score: number, completed: boolean) => void;
  bumpBlocks: (n: number) => void;
  bumpCollapses: (n: number) => void;
  bumpSessions: () => void;
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      highScores: {},
      endlessLevelReached: 1,
      challengesCompleted: [],
      dailyHistory: [],
      totalBlocksPlaced: 0,
      totalCollapses: 0,
      totalSessions: 0,
      recordHighScore: (mode, score) => {
        const cur = get().highScores[mode] ?? 0;
        if (score > cur) {
          set({ highScores: { ...get().highScores, [mode]: score } });
          return true;
        }
        return false;
      },
      recordEndlessLevel: (level) =>
        set((s) => ({
          endlessLevelReached: Math.max(s.endlessLevelReached, level),
        })),
      recordChallengeComplete: (id) =>
        set((s) =>
          s.challengesCompleted.includes(id)
            ? s
            : { challengesCompleted: [...s.challengesCompleted, id] },
        ),
      recordDaily: (date, score, completed) =>
        set((s) => {
          const idx = s.dailyHistory.findIndex((d) => d.date === date);
          const next = [...s.dailyHistory];
          if (idx >= 0) {
            next[idx] = {
              date,
              bestScore: Math.max(next[idx].bestScore, score),
              completed: next[idx].completed || completed,
            };
          } else {
            next.push({ date, bestScore: score, completed });
          }
          return { dailyHistory: next.slice(-60) };
        }),
      bumpBlocks: (n) => set((s) => ({ totalBlocksPlaced: s.totalBlocksPlaced + n })),
      bumpCollapses: (n) => set((s) => ({ totalCollapses: s.totalCollapses + n })),
      bumpSessions: () => set((s) => ({ totalSessions: s.totalSessions + 1 })),
    }),
    { name: 'tricky-blocks-progress' },
  ),
);
