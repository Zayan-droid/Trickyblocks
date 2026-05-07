export type ThemeId = 'classic' | 'neon' | 'sunset' | 'mint' | 'arcade';

export interface Theme {
  id: ThemeId;
  name: string;
  vibe: string;
  accent: string;
  bg: string;
  surface: string;
  surface2: string;
}

export const THEMES: Theme[] = [
  {
    id: 'classic',
    name: 'Classic',
    vibe: 'Bold, punchy, original',
    accent: '#FFD60A',
    bg: '#0E0E10',
    surface: '#17171A',
    surface2: '#22222A',
  },
  {
    id: 'neon',
    name: 'Neon',
    vibe: 'Futuristic, energetic',
    accent: '#7B2FF7',
    bg: '#0A0A14',
    surface: '#14142A',
    surface2: '#1F1F3A',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    vibe: 'Premium, modern',
    accent: '#FF8C42',
    bg: '#1B1F3B',
    surface: '#262B4F',
    surface2: '#323873',
  },
  {
    id: 'mint',
    name: 'Mint',
    vibe: 'Minimal, relaxing',
    accent: '#3DDC97',
    bg: '#222831',
    surface: '#2D343F',
    surface2: '#3A4252',
  },
  {
    id: 'arcade',
    name: 'Arcade',
    vibe: 'Vibrant, addictive',
    accent: '#FF4D8D',
    bg: '#3A0CA3',
    surface: '#4A1CB6',
    surface2: '#5E2BD1',
  },
];

export const DEFAULT_THEME: ThemeId = 'classic';

export function getTheme(id: ThemeId): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function applyTheme(id: ThemeId) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', id);
  cachedAccent = null;
}

let cachedAccent: string | null = null;

function readAccent(): string {
  if (typeof window === 'undefined') return '255 214 10';
  const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  return v || '255 214 10';
}

export function getAccentColor(): string {
  if (cachedAccent === null) cachedAccent = readAccent();
  return `rgb(${cachedAccent})`;
}

export function getAccentRgba(alpha: number): string {
  if (cachedAccent === null) cachedAccent = readAccent();
  return `rgb(${cachedAccent} / ${alpha})`;
}
