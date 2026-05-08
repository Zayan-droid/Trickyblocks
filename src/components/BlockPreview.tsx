import { useMemo } from 'react';
import type { BlockSpec } from '@/game/types';
import { geomFor, svgPath } from '@/game/shapes';
import { useSettingsStore } from '@/store/settingsStore';
import { SHAPE_PALETTES } from '@/game/themes';

interface Props {
  spec: BlockSpec;
  size?: number;
}

export default function BlockPreview({ spec, size = 64 }: Props) {
  const themeId = useSettingsStore((s) => s.theme);
  const path = useMemo(
    () => svgPath(geomFor(spec.shape, spec.unit)),
    [spec.shape, spec.unit],
  );
  const w = spec.width;
  const h = spec.height;
  const scale = Math.min(size / w, size / h, 1.0);
  const dispW = w * scale;
  const dispH = h * scale;

  const color = SHAPE_PALETTES[themeId][spec.shape];
  const fillId = `g-${spec.id}`;
  const sheenId = `s-${spec.id}`;
  const shadowId = `d-${spec.id}`;

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
          <clipPath id={`clip-${spec.id}`}>
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
            clipPath={`url(#clip-${spec.id})`}
          />
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
