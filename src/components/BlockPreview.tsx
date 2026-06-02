import { useMemo } from 'react';
import type { BlockSpec } from '@/game/types';
import { geomFor, svgPath } from '@/game/shapes';
import { useSettingsStore } from '@/store/settingsStore';
import { useGameStore } from '@/store/gameStore';
import { ICE_PALETTE, ICE_SHAPE_PALETTE, SHAPE_PALETTES } from '@/game/themes';

interface Props {
  spec: BlockSpec;
  size?: number;
}

export default function BlockPreview({ spec, size = 64 }: Props) {
  const themeId = useSettingsStore((s) => s.theme);
  const iceMode = useGameStore((s) => s.platform === 'ice');
  const path = useMemo(
    () => svgPath(geomFor(spec.shape, spec.unit)),
    [spec.shape, spec.unit],
  );
  const w = spec.width;
  const h = spec.height;
  const scale = Math.min(size / w, size / h, 1.0);
  const dispW = w * scale;
  const dispH = h * scale;

  const color = iceMode
    ? ICE_SHAPE_PALETTE[spec.shape]
    : SHAPE_PALETTES[themeId][spec.shape];
  const fillId = `g-${spec.id}`;
  const sheenId = `s-${spec.id}`;
  const shadowId = `d-${spec.id}`;
  const clipId = `clip-${spec.id}`;

  // Internal frost texture for ice mode — two thin fracture lines and a
  // scattering of tiny speckles. Mirrors the canvas renderer's natural,
  // calm interior (no high-contrast cracks).
  const iceInterior = useMemo(() => {
    if (!iceMode) return { cracks: [] as Array<{ x1: number; y1: number; x2: number; y2: number; bx: number; by: number }>, flakes: [] as Array<{ x: number; y: number; s: number }> };
    const seedBase = spec.shape.charCodeAt(0);
    const cracks: Array<{ x1: number; y1: number; x2: number; y2: number; bx: number; by: number }> = [];
    for (let i = 0; i < 2; i++) {
      const seed = (seedBase + i * 37) * 9301 + 49297;
      const sx = -w / 2 + (((seed * 233) % 1000) / 1000) * w;
      const sy = -h / 2 + (((seed * 977) % 1000) / 1000) * h;
      const len = (12 + ((seed * 17) % 16)) * (spec.unit / 32);
      const ang = ((seed * 311) % 1000) / 1000 * Math.PI * 2;
      const ex = sx + Math.cos(ang) * len;
      const ey = sy + Math.sin(ang) * len;
      const bAng = ang + (i % 2 === 0 ? 0.5 : -0.5);
      const bLen = len * 0.45;
      cracks.push({
        x1: sx,
        y1: sy,
        x2: ex,
        y2: ey,
        bx: sx + Math.cos(bAng) * bLen,
        by: sy + Math.sin(bAng) * bLen,
      });
    }
    const flakes: Array<{ x: number; y: number; s: number }> = [];
    const count = Math.round((w * h) / 320);
    for (let i = 0; i < count; i++) {
      const seed = (seedBase + i * 53) * 9301 + 49297;
      const x = -w / 2 + (((seed * 67) % 1000) / 1000) * w;
      const y = -h / 2 + (((seed * 113) % 1000) / 1000) * h;
      const s = 0.8 + ((seed * 7) % 100) / 110;
      flakes.push({ x, y, s });
    }
    return { cracks, flakes };
  }, [iceMode, spec.shape, spec.unit, w, h]);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox={`${-w / 2 - 6} ${-h / 2 - 8} ${w + 12} ${h + 16}`}
        width={dispW + 14}
        height={dispH + 18}
      >
        <defs>
          <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={shade(color, 0.24)} />
            <stop offset="0.45" stopColor={color} />
            <stop offset="1" stopColor={shade(color, -0.2)} />
          </linearGradient>
          <linearGradient id={sheenId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="rgba(255,255,255,0.40)" />
            <stop offset="0.55" stopColor="rgba(255,255,255,0.08)" />
            <stop offset="1" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <filter id={shadowId} x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow
              dx="0"
              dy="3"
              stdDeviation="2.5"
              floodColor="rgba(0,0,0,0.5)"
            />
          </filter>
          <clipPath id={clipId}>
            <path d={path} fillRule="evenodd" />
          </clipPath>
        </defs>
        <g filter={`url(#${shadowId})`}>
          <path
            d={path}
            fill={`url(#${fillId})`}
            stroke={shade(color, -0.5)}
            strokeOpacity="0.5"
            strokeWidth={1.4}
            strokeLinejoin="round"
            fillRule="evenodd"
          />
          <rect
            x={-w / 2}
            y={-h / 2}
            width={w}
            height={h * 0.4}
            fill={`url(#${sheenId})`}
            clipPath={`url(#${clipId})`}
          />
          {iceMode && (
            <>
              <g clipPath={`url(#${clipId})`}>
                {iceInterior.flakes.map((f, idx) => (
                  <rect
                    key={`f-${idx}`}
                    x={f.x}
                    y={f.y}
                    width={f.s}
                    height={f.s}
                    fill="rgba(247,253,255,0.55)"
                  />
                ))}
                {iceInterior.cracks.map((c, idx) => (
                  <g key={`c-${idx}`} stroke="rgba(247,253,255,0.22)" strokeWidth={0.8} fill="none">
                    <line x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} />
                    <line x1={c.x1} y1={c.y1} x2={c.bx} y2={c.by} />
                  </g>
                ))}
              </g>
              {/* Soft outer white bloom — same global-illumination feel as the canvas. */}
              <path
                d={path}
                fill="none"
                stroke={ICE_PALETTE.iceWhite}
                strokeWidth={1.2}
                strokeOpacity={0.5}
                fillRule="evenodd"
                style={{ filter: 'drop-shadow(0 0 4px rgba(247,253,255,0.7))' }}
              />
            </>
          )}
        </g>
      </svg>
    </div>
  );
}

function shade(input: string, amt: number): string {
  if (input.startsWith('rgb')) return input;
  const c = input.replace('#', '');
  const num = parseInt(
    c.length === 3 ? c.split('').map((x) => x + x).join('') : c,
    16,
  );
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  if (amt >= 0) {
    r = Math.round(r + (255 - r) * amt);
    g = Math.round(g + (255 - g) * amt);
    b = Math.round(b + (255 - b) * amt);
  } else {
    const a = -amt;
    r = Math.round(r * (1 - a));
    g = Math.round(g * (1 - a));
    b = Math.round(b * (1 - a));
  }
  return `rgb(${r}, ${g}, ${b})`;
}
