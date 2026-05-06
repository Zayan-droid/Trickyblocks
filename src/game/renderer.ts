import Matter from 'matter-js';
import type { BlockSpec, PlatformType } from './types';
import { geomFor, tracePath } from './shapes';

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
  ctx.fillStyle = '#0e0e10';
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 60; i++) {
    const seed = i * 9301 + 49297;
    const sx = ((seed * 233 + 17) % 1000) / 1000 * width;
    const sy = (((seed * 977 + 113) % 1000) / 1000) * height * 1.4 - cameraY * 0.15;
    const yy = ((sy % (height * 1.4)) + height * 1.4) % (height * 1.4);
    if (yy < height) {
      ctx.fillStyle = i % 5 === 0 ? '#ffd60a' : '#3a3a44';
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

export function drawBlock(
  ctx: CanvasRenderingContext2D,
  body: Matter.Body,
  spec: BlockSpec,
  cameraY: number,
  ghost = false,
) {
  ctx.save();
  ctx.globalAlpha = ghost ? 0.45 : 1;

  const renderParts =
    body.parts.length > 1 ? body.parts.slice(1) : [body];
  for (const part of renderParts) {
    drawWorldPolygon(ctx, part.vertices, cameraY, spec, ghost);
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawWorldPolygon(
  ctx: CanvasRenderingContext2D,
  vertices: ReadonlyArray<Matter.Vector>,
  cameraY: number,
  spec: BlockSpec,
  ghost: boolean,
) {
  if (vertices.length === 0) return;

  if (!ghost) {
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath();
    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i];
      const x = v.x + 4;
      const y = v.y - cameraY + 6;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = spec.color;
  ctx.beginPath();
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i];
    const x = v.x;
    const y = v.y - cameraY;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i];
    const x = v.x;
    const y = v.y - cameraY;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
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
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = 0.55;

  const geom = geomFor(spec.shape, spec.unit);

  ctx.fillStyle = spec.color;
  tracePath(ctx, geom);
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';
  tracePath(ctx, geom);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * Silhouette of where the block will land if released. Drawn as a hollow
 * dashed outline at the projected resting position.
 */
export function drawLandingSilhouette(
  ctx: CanvasRenderingContext2D,
  spec: BlockSpec,
  x: number,
  y: number,
  angle: number,
  cameraY: number,
) {
  ctx.save();
  ctx.translate(x, y - cameraY);
  ctx.rotate(angle);

  const geom = geomFor(spec.shape, spec.unit);

  ctx.globalAlpha = 0.25;
  ctx.fillStyle = spec.color;
  tracePath(ctx, geom);
  ctx.fill();

  ctx.globalAlpha = 0.95;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = '#ffffff';
  tracePath(ctx, geom);
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
  ctx.strokeStyle = 'rgba(255, 214, 10, 0.5)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#ffd60a';
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
