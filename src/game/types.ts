export type GameMode = 'endless' | 'daily' | 'challenge' | 'tutorial';

export type BlockShape = 'I' | 'O' | 'T' | 'S' | 'Z' | 'L' | 'J';

export type PlatformType = 'wood' | 'ice' | 'bouncy' | 'magnetic' | 'fragile';

export interface BlockSpec {
  id: string;
  shape: BlockShape;
  width: number;
  height: number;
  unit: number;
  color: string;
  accent: string;
  density: number;
  friction: number;
  restitution: number;
}

export interface PlacedBlockMeta {
  id: string;
  spec: BlockSpec;
  placedAt: number;
  contributedScore: number;
}

export interface ChallengeSpec {
  id: string;
  name: string;
  blurb: string;
  platform: PlatformType;
  shapesAllowed: BlockShape[];
  goalHeight: number;
  goalScore: number;
  wind: number;
  shake: number;
  bossTag?: string;
}

export interface DailySpec {
  date: string;
  seed: number;
  challenge: ChallengeSpec;
}

export interface GameStats {
  startedAt: number;
  blocksPlaced: number;
  blocksCollapsed: number;
  highestY: number;
  comboBest: number;
  comboCurrent: number;
  nearMisses: number;
  avgPlacementMs: number;
  lastPlacementMs: number;
  totalActiveMs: number;
  collapses: number;
  attemptsAtCurrentLevel: number;
}
