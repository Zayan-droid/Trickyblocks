import type { BlockShape } from './types';

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

/**
 * Per-theme block palettes. Each palette uses 7 hand-picked shades from the
 * theme's color family so blocks stay visually coherent yet readable.
 */
export const SHAPE_PALETTES: Record<ThemeId, Record<BlockShape, string>> = {
  // Theme 1 — Yellow & Black: golds, ambers, with one cream highlight.
  classic: {
    I: '#FFD60A',
    O: '#FFE26B',
    T: '#FFB300',
    S: '#FFEE58',
    Z: '#FF8F00',
    L: '#FFF59D',
    J: '#FFA000',
  },
  // Theme 2 — Neon Purple & Black: violets and lavenders, slight cyberpunk lean.
  neon: {
    I: '#7B2FF7',
    O: '#B388FF',
    T: '#9D4EDD',
    S: '#5E2BD1',
    Z: '#4527A0',
    L: '#CE93D8',
    J: '#7C4DFF',
  },
  // Theme 3 — Warm Orange & Navy: coral / tangerine / peach family.
  sunset: {
    I: '#FF8C42',
    O: '#FFB074',
    T: '#FF7043',
    S: '#FF6E40',
    Z: '#E64A19',
    L: '#FFCC80',
    J: '#F4511E',
  },
  // Theme 4 — Mint & Slate: greens / teals / aquamarine.
  mint: {
    I: '#3DDC97',
    O: '#A5F0D1',
    T: '#10B981',
    S: '#14B8A6',
    Z: '#059669',
    L: '#7FE5C8',
    J: '#2CB67D',
  },
  // Theme 5 — Pink & Light Purple: pinks, roses, lavenders.
  arcade: {
    I: '#FF4D8D',
    O: '#FF85A1',
    T: '#C77DFF',
    S: '#FFB7C5',
    Z: '#E91E63',
    L: '#FFCAD4',
    J: '#A66DFF',
  },
};

function readActiveTheme(): ThemeId {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  const v = document.documentElement.getAttribute('data-theme') as ThemeId | null;
  return v && SHAPE_PALETTES[v] ? v : DEFAULT_THEME;
}

export function getShapeColor(shape: BlockShape): string {
  return SHAPE_PALETTES[readActiveTheme()][shape];
}

/**
 * "Arctic Lightworld" palette — dominant white / pale-blue with glacier
 * blue as structural accent. Roughly 80% white & ice-blue, 15% soft blue,
 * 5% rare bright-aqua highlight. Pale red is reserved for hazard cues
 * (collapses) and never used elsewhere.
 */
export const ICE_PALETTE = {
  iceWhite: '#F7FDFF', // primary light-source feel
  frostMist: '#DFF6FF', // ambient glow / fog
  glacierBlue: '#4FD1FF', // structural accent
  softGlacier: '#A4D4E8', // muted block / edge tone
  deepIceShadow: '#0B1A2A', // background depth
  frozenIndigo: '#0A1B3D', // desaturated sky base
  brightAqua: '#00FFD1', // rare highlight (5-10% of visuals)
  paleRedFrost: '#FF5C7A', // hazard accent (collapses only)
} as const;

/**
 * Per-shape colour used in Ice Mode. All shapes sit in a near-white / pale
 * ice-blue range so the tower reads as carved frozen objects against the
 * dark sky. Per-shape variation keeps the pieces distinguishable, with
 * gradient shading on the block doing the heavy lifting for identity.
 * Shared between the canvas renderer and the React BlockPreview so the
 * tray matches placed blocks exactly.
 */
export const ICE_SHAPE_PALETTE: Record<BlockShape, string> = {
  I: '#E5F4FB', // anchor — palest
  O: '#F0F8FC',
  T: '#C8E0EC',
  S: '#DCEFF8',
  Z: '#A8C8DC', // deepest tint
  L: '#E8F3F9',
  J: '#BAD5E5',
};

/**
 * "Jelly Mode" palette — soft, candy-like dessert colours. Everything reads
 * as molded gelatin and gummy candy: bright translucent fruit flavours over
 * a cream-white highlight, with desaturated berry/candy purples reserved for
 * soft diffuse shadows (never harsh black). Shared between the canvas
 * renderer, particles, and the React UI so the whole mode stays cohesive.
 */
export const JELLY_PALETTE = {
  strawberry: '#FF7EB6',
  peach: '#FFB68A',
  mango: '#FFC857',
  mint: '#7DE2B8',
  blueRaspberry: '#77C7FF',
  lavender: '#B99BFF',
  candyShadow: '#6E5AA5', // soft candy purple shadow
  berryShadow: '#755B8A', // soft berry shadow
  cream: '#FFF8F1', // highlight / sheen
} as const;

/**
 * Per-shape jelly flavour. Each tetromino gets its own candy colour so the
 * tower reads as a stack of different gummy sweets. Gradient shading + the
 * glossy highlight blob in the renderer give them their gelatin identity.
 */
export const JELLY_SHAPE_PALETTE: Record<BlockShape, string> = {
  I: '#77C7FF', // blue raspberry
  O: '#FFC857', // mango
  T: '#B99BFF', // lavender
  S: '#7DE2B8', // mint
  Z: '#FF7EB6', // strawberry
  L: '#FFB68A', // peach
  J: '#C9A7FF', // grape jelly
};
