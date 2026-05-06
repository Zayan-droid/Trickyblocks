import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  musicVolume: number;
  sfxVolume: number;
  hapticsEnabled: boolean;
  colorBlindMode: boolean;
  reduceMotion: boolean;
  physicsSensitivity: number; // 0.5 .. 1.5
  setMusicVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  setHaptics: (v: boolean) => void;
  setColorBlind: (v: boolean) => void;
  setReduceMotion: (v: boolean) => void;
  setPhysicsSensitivity: (v: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      musicVolume: 0.5,
      sfxVolume: 0.7,
      hapticsEnabled: true,
      colorBlindMode: false,
      reduceMotion: false,
      physicsSensitivity: 1.0,
      setMusicVolume: (v) => set({ musicVolume: v }),
      setSfxVolume: (v) => set({ sfxVolume: v }),
      setHaptics: (v) => set({ hapticsEnabled: v }),
      setColorBlind: (v) => set({ colorBlindMode: v }),
      setReduceMotion: (v) => set({ reduceMotion: v }),
      setPhysicsSensitivity: (v) => set({ physicsSensitivity: v }),
    }),
    { name: 'tricky-blocks-settings' },
  ),
);
