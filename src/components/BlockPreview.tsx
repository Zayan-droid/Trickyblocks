import { useMemo } from 'react';
import type { BlockSpec } from '@/game/types';
import { geomFor, svgPath } from '@/game/shapes';

interface Props {
  spec: BlockSpec;
  size?: number;
}

export default function BlockPreview({ spec, size = 64 }: Props) {
  const path = useMemo(
    () => svgPath(geomFor(spec.shape, spec.unit)),
    [spec.shape, spec.unit],
  );
  const w = spec.width;
  const h = spec.height;
  const scale = Math.min(size / w, size / h, 1.0);
  const dispW = w * scale;
  const dispH = h * scale;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox={`${-w / 2 - 4} ${-h / 2 - 4} ${w + 8} ${h + 8}`}
        width={dispW + 12}
        height={dispH + 12}
      >
        <defs>
          <linearGradient id={`g-${spec.id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={lighten(spec.color, 0.18)} />
            <stop offset="1" stopColor={darken(spec.color, 0.18)} />
          </linearGradient>
        </defs>
        <path
          d={path}
          fill={`url(#g-${spec.id})`}
          stroke="rgba(0,0,0,0.35)"
          strokeWidth={2}
          strokeLinejoin="round"
          fillRule="evenodd"
        />
      </svg>
    </div>
  );
}

function lighten(hex: string, amt: number): string {
  return shade(hex, amt);
}
function darken(hex: string, amt: number): string {
  return shade(hex, -amt);
}
function shade(input: string, amt: number): string {
  if (input.startsWith('rgb')) return input;
  const c = input.replace('#', '');
  const num = parseInt(c.length === 3 ? c.split('').map((x) => x + x).join('') : c, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.round(Math.max(0, Math.min(255, r + amt * 255)));
  g = Math.round(Math.max(0, Math.min(255, g + amt * 255)));
  b = Math.round(Math.max(0, Math.min(255, b + amt * 255)));
  return `rgb(${r}, ${g}, ${b})`;
}
