import Matter from 'matter-js';
import type { BlockSpec, PlatformType } from './types';
import { geomFor, outlineFor, traceRoundedOutline, tracePath } from './shapes';
import { getAccentColor, getAccentRgba, getShapeColor } from './themes';

export interface RendererOpts {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  cameraY: number;
  shake: number;
  reduceMotion: boolean;
}

export function clear(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
}

export function drawBackdrop(opts: RendererOpts) {
  const { ctx, width, height, cameraY } = opts;
  const bgVar =
    typeof window !== 'undefined'
      ? getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
      : '';
  ctx.fillStyle = bgVar ? `rgb(${bgVar})` : '#0e0e10';
  ctx.fillRect(0, 0, width, height);

  const accent = getAccentColor();
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 60; i++) {
    const seed = i * 9301 + 49297;
    const sx = ((seed * 233 + 17) % 1000) / 1000 * width;
    const sy = (((seed * 977 + 113) % 1000) / 1000) * height * 1.4 - cameraY * 0.15;
    const yy = ((sy % (height * 1.4)) + height * 1.4) % (height * 1.4);
    if (yy < height) {
      ctx.fillStyle = i % 5 === 0 ? accent : '#3a3a44';
      ctx.fillRect(sx, yy, 2, 2);
    }
  }
  ctx.globalAlpha = 1;
}

export function drawPlatform(
  ctx: CanvasRenderingContext2D,
  platform: Matter.Body,
  type: PlatformType,
  cameraY: number,
) {
  const w = (platform as Matter.Body & { _platformWidth?: number })._platformWidth ?? 220;
  const h = 26;
  const x = platform.position.x;
  const y = platform.position.y - cameraY;
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, -w / 2 + 6, -h / 2 + 8, w, h, 8);
  ctx.fill();

  let fillColor = '#8d5a2b';
  let stripeColor = 'rgba(0,0,0,0.18)';
  let icon = '🪵';
  switch (type) {
    case 'ice':
      fillColor = '#9ed8e8';
      stripeColor = 'rgba(255,255,255,0.35)';
      icon = '❄';
      break;
    case 'bouncy':
      fillColor = '#ff7ab8';
      stripeColor = 'rgba(255,255,255,0.25)';
      icon = '⤴';
      break;
    case 'magnetic':
      fillColor = '#c43da3';
      stripeColor = 'rgba(255,255,255,0.22)';
      icon = '✦';
      break;
    case 'fragile':
      fillColor = '#b9b9bf';
      stripeColor = 'rgba(255,80,80,0.22)';
      icon = '✕';
      break;
  }
  ctx.fillStyle = fillColor;
  roundRect(ctx, -w / 2, -h / 2, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = stripeColor;
  for (let i = -w / 2; i < w / 2; i += 14) {
    ctx.fillRect(i, -h / 2 + 2, 6, h - 4);
  }

  ctx.fillStyle = '#1a1a1f';
  ctx.fillRect(-w / 2 + 18, h / 2, 12, 240);
  ctx.fillRect(w / 2 - 30, h / 2, 12, 240);

  ctx.font = '14px Fredoka';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(icon, 0, 0);
  ctx.restore();
}

interface BlockAnimMeta {
  landAt?: number;
  landIntensity?: number;
  glowUntil?: number;
}

export function drawBlock(
  ctx: CanvasRenderingContext2D,
  body: Matter.Body,
  spec: BlockSpec,
  cameraY: number,
  ghost = false,
) {
  const meta = (body as Matter.Body & { _meta?: BlockAnimMeta })._meta;
  const now = performance.now();

  // Squash-and-stretch on landing. Phase 0..0.4: compress; 0.4..1: rebound.
  let sx = 1;
  let sy = 1;
  if (meta && meta.landAt !== undefined && meta.landIntensity !== undefined) {
    const SQUASH_DUR = 220;
    const elapsed = now - meta.landAt;
    if (elapsed < SQUASH_DUR) {
      const t = elapsed / SQUASH_DUR;
      // Triangle envelope peaks at t = 0.4.
      const env = t < 0.4 ? t / 0.4 : Math.max(0, 1 - (t - 0.4) / 0.6);
      const k = meta.landIntensity * 0.14;
      sx = 1 + env * k;
      sy = 1 - env * k;
    } else {
      meta.landAt = undefined;
      meta.landIntensity = undefined;
    }
  }

  // Combo / perfect-placement glow pulse.
  let glow = 0;
  if (meta && meta.glowUntil !== undefined) {
    const remaining = meta.glowUntil - now;
    if (remaining > 0) {
      glow = Math.min(1, remaining / 1000);
    } else {
      meta.glowUntil = undefined;
    }
  }

  const x = body.position.x;
  const y = body.position.y - cameraY;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(body.angle);
  ctx.scale(sx, sy);

  drawPremiumSilhouette(ctx, spec, ghost, glow);

  ctx.restore();
}

function drawPremiumSilhouette(
  ctx: CanvasRenderingContext2D,
  spec: BlockSpec,
  ghost: boolean,
  glow: number,
) {
  const color = getShapeColor(spec.shape);
  const outline = outlineFor(spec.shape, spec.unit);
  // ~22% of unit cell — soft but readable.
  const radius = Math.max(4, spec.unit * 0.22);

  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of outline) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  if (ghost) ctx.globalAlpha = 0.5;

  // Drop shadow — shadowOffset is in canvas-space pixels, so it stays aimed
  // downward on screen even when the body is rotated. The shape used for the
  // shadow is the rotated silhouette, which is exactly what we want.
  if (!ghost) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.42)';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 7;
    ctx.shadowBlur = 12;
    ctx.fillStyle = shade(color, -0.45);
    traceRoundedOutline(ctx, outline, radius);
    ctx.fill();
    ctx.restore();
  }

  // Combo / perfect-placement halo.
  if (glow > 0 && !ghost) {
    ctx.save();
    ctx.shadowColor = shade(color, 0.4);
    ctx.shadowBlur = 22 * glow;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = shade(color, 0.18);
    traceRoundedOutline(ctx, outline, radius);
    ctx.fill();
    ctx.restore();
  }

  // Main gradient fill — lighter on top, mid-tone at body, darker on bottom.
  const grad = ctx.createLinearGradient(0, minY, 0, maxY);
  grad.addColorStop(0, shade(color, 0.24));
  grad.addColorStop(0.42, color);
  grad.addColorStop(1, shade(color, -0.2));
  ctx.fillStyle = grad;
  traceRoundedOutline(ctx, outline, radius);
  ctx.fill();

  // Top sheen — clip to silhouette, paint a vertical white-fade in the upper
  // ~35% so it traces the rounded top edges of whatever shape this is.
  ctx.save();
  traceRoundedOutline(ctx, outline, radius);
  ctx.clip();
  const sheenH = (maxY - minY) * 0.4;
  const sheen = ctx.createLinearGradient(0, minY, 0, minY + sheenH);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.38)');
  sheen.addColorStop(0.55, 'rgba(255, 255, 255, 0.08)');
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(-2000, minY, 4000, sheenH);
  ctx.restore();

  // Outer rim for definition. Softer than a true black outline so it doesn't
  // look stamped — just a touch of darkness at the edge.
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = shade(color, -0.5);
  ctx.globalAlpha = ghost ? 0.4 : 0.5;
  traceRoundedOutline(ctx, outline, radius);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * Translucent block at the pointer (the piece being dragged).
 */
export function drawDragGhost(
  ctx: CanvasRenderingContext2D,
  spec: BlockSpec,
  x: number,
  y: number,
  angle: number,
) {
  const color = getShapeColor(spec.shape);
  const outline = outlineFor(spec.shape, spec.unit);
  const radius = Math.max(4, spec.unit * 0.22);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = 0.6;

  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of outline) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const grad = ctx.createLinearGradient(0, minY, 0, maxY);
  grad.addColorStop(0, shade(color, 0.24));
  grad.addColorStop(1, shade(color, -0.18));
  ctx.fillStyle = grad;
  traceRoundedOutline(ctx, outline, radius);
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  traceRoundedOutline(ctx, outline, radius);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * Silhouette of where the block will land if released.
 */
export function drawLandingSilhouette(
  ctx: CanvasRenderingContext2D,
  spec: BlockSpec,
  x: number,
  y: number,
  angle: number,
  cameraY: number,
) {
  const color = getShapeColor(spec.shape);
  const outline = outlineFor(spec.shape, spec.unit);
  const radius = Math.max(4, spec.unit * 0.22);

  ctx.save();
  ctx.translate(x, y - cameraY);
  ctx.rotate(angle);

  ctx.globalAlpha = 0.22;
  ctx.fillStyle = color;
  traceRoundedOutline(ctx, outline, radius);
  ctx.fill();

  ctx.globalAlpha = 0.95;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = '#ffffff';
  traceRoundedOutline(ctx, outline, radius);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * Red "no-go" overlay rendered around the pointer when placement is invalid.
 */
export function drawInvalidIndicator(
  ctx: CanvasRenderingContext2D,
  spec: BlockSpec,
  x: number,
  y: number,
  angle: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const geom = geomFor(spec.shape, spec.unit);

  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#ff3b30';
  tracePath(ctx, geom);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.lineWidth = 3;
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = '#ffd0d0';
  tracePath(ctx, geom);
  ctx.stroke();
  ctx.setLineDash([]);

  // Slash mark
  const r = Math.max(spec.width, spec.height) / 2;
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-r, -r);
  ctx.lineTo(r, r);
  ctx.stroke();

  ctx.restore();
}

export function drawHeightLine(
  ctx: CanvasRenderingContext2D,
  width: number,
  baseY: number,
  cameraY: number,
  height: number,
  label: string,
) {
  const y = baseY - cameraY - height;
  ctx.save();
  ctx.strokeStyle = getAccentRgba(0.5);
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = getAccentColor();
  ctx.font = '14px Fredoka';
  ctx.fillText(label, 12, y - 6);
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Hex-or-rgb color tint helper. amt > 0 lightens, amt < 0 darkens.
 * Magnitude is fraction of full white/black push (0.2 = 20% toward white/black).
 */
function shade(input: string, amt: number): string {
  let r: number;
  let g: number;
  let b: number;
  if (input.startsWith('#')) {
    const c = input.slice(1);
    const num = parseInt(c.length === 3 ? c.split('').map((x) => x + x).join('') : c, 16);
    r = (num >> 16) & 0xff;
    g = (num >> 8) & 0xff;
    b = num & 0xff;
  } else {
    const m = input.match(/rgba?\(([^)]+)\)/);
    if (!m) return input;
    const [rs, gs, bs] = m[1].split(',').map((s) => parseFloat(s));
    r = rs;
    g = gs;
    b = bs;
  }
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
