import Matter from 'matter-js';
import type { BlockSpec, PlatformType } from './types';
import {
  centroidOffsetFor,
  geomFor,
  outlineFor,
  traceRoundedOutline,
  tracePath,
} from './shapes';
import {
  getAccentColor,
  getAccentRgba,
  getShapeColor,
  ICE_PALETTE,
  ICE_SHAPE_PALETTE,
} from './themes';

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

/**
 * "Arctic Lightworld" backdrop for Ice Mode. Dominant white & pale-blue,
 * calm but unstable. Built deepest-first:
 *   1. Soft arctic sky gradient (icy-white top → pale-cyan mid → faint
 *      deep-blue horizon).
 *   2. Camera-parallaxed stars in white / pale glacier (no aqua highlights).
 *   3. Three layered glacier silhouettes with soft white bloom edges
 *      (replaces the old neon-rimmed cliffs).
 *   4. Two faint refracted light waves at the screen edges, sliding on
 *      very slow cycles (20-30s).
 *   5. Rising ice-fog band at the bottom 30-40% that gently breathes.
 *   6. Soft uniform white glow vignette ("luminous cavern" feel).
 */
export function drawIceBackdrop(opts: RendererOpts) {
  const { ctx, width, height, cameraY, reduceMotion } = opts;
  const t = reduceMotion ? 0 : performance.now();

  // ── 1. Matte snowy sky. Soft, opaque, no glow — top is Snow White
  // fading to Ice Blue at the horizon. Feels like an overcast winter
  // morning rather than a luminous screen.
  const sky = ctx.createLinearGradient(0, 0, 0, height * 0.74);
  sky.addColorStop(0, '#F8FBFF');
  sky.addColorStop(0.45, '#EAF6FF');
  sky.addColorStop(1, '#BEE8FF');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height * 0.74);

  // ── 2. Snow ground. Solid pale snow fills the bottom of the canvas so
  // the world reads as snow-covered terrain, not a blue sky all the way
  // down. Slight gradient cools it toward the platform.
  const ground = ctx.createLinearGradient(0, height * 0.74, 0, height);
  ground.addColorStop(0, '#F8FBFF');
  ground.addColorStop(1, '#E2EEF8');
  ctx.fillStyle = ground;
  ctx.fillRect(0, height * 0.74, width, height * 0.26);

  // ── 3. Layered ice mountains. Matte fills, no vertical gradient — just
  // a soft white highlight along each ridge to suggest snow catching pale
  // morning light. Distance is sold by paler colour, not by glow.
  drawMatteMountain(ctx, width, height, cameraY, {
    yBase: height * 0.52,
    amplitude: 32,
    color: '#C8DDEC',
    highlight: '#FFFFFF',
    parallax: 0.04,
    teeth: 7,
    seedOffset: 13,
  });
  drawMatteMountain(ctx, width, height, cameraY, {
    yBase: height * 0.60,
    amplitude: 55,
    color: '#9FBED6',
    highlight: '#EAF6FF',
    parallax: 0.12,
    teeth: 5,
    seedOffset: 41,
  });
  drawMatteMountain(ctx, width, height, cameraY, {
    yBase: height * 0.70,
    amplitude: 78,
    color: '#6E9CC0',
    highlight: '#DDEFFA',
    parallax: 0.28,
    teeth: 4,
    seedOffset: 89,
  });

  // ── 4. Atmospheric fog band at the horizon. Sells depth and softens
  // the seam where the mountains meet the snow ground.
  const fog = ctx.createLinearGradient(0, height * 0.55, 0, height * 0.80);
  fog.addColorStop(0, 'rgba(248, 251, 255, 0)');
  fog.addColorStop(0.55, 'rgba(248, 251, 255, 0.55)');
  fog.addColorStop(1, 'rgba(248, 251, 255, 0.92)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, height * 0.55, width, height * 0.25);

  // ── 5. Tiny sparkling snow crystals in the sky. Pseudo-random twinkle
  // via a sine on each crystal's seed so the field gently glitters.
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < 38; i++) {
    const seed = i * 9301 + 49297;
    const sx = ((seed * 233 + 17) % 1000) / 1000 * width;
    const sy = (((seed * 977 + 113) % 1000) / 1000) * height * 0.68;
    const twinkle = (Math.sin(t * 0.0018 + i * 0.7) + 1) * 0.5;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.35 + twinkle * 0.5})`;
    ctx.fillRect(sx, sy, 1.4, 1.4);
  }
  ctx.globalAlpha = 1;
}

/**
 * Optional screen-edge frost flash, painted on top of everything by the
 * engine when a cold gust hits. `intensity` runs 0..1 and fades out in the
 * engine; this function just shapes the vignette into white-ice tones.
 */
export function drawGustFrostOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
) {
  if (intensity <= 0.01) return;
  ctx.save();
  // White edge bloom — feels like cold air pressing on the screen.
  const vig = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.35,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.85,
  );
  vig.addColorStop(0, 'rgba(247, 253, 255, 0)');
  vig.addColorStop(1, `rgba(247, 253, 255, ${0.55 * intensity})`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);

  // Subtle frost stippling on the outer 12% of the canvas.
  const margin = Math.min(width, height) * 0.12;
  ctx.globalAlpha = 0.25 * intensity;
  ctx.fillStyle = ICE_PALETTE.iceWhite;
  for (let i = 0; i < 80; i++) {
    const onLeft = Math.random() < 0.5;
    const x = onLeft
      ? Math.random() * margin
      : width - Math.random() * margin;
    const y = Math.random() * height;
    ctx.fillRect(x, y, 1.2, 1.2);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * Draw one parallax layer of jagged snow-capped mountains. Matte fill, no
 * gradient — just a soft white highlight along the ridge to suggest snow
 * on the upper face. Distance is sold by paler body colour, not by glow.
 */
function drawMatteMountain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cameraY: number,
  opts: {
    yBase: number;
    amplitude: number;
    color: string;
    highlight: string;
    parallax: number;
    teeth: number;
    seedOffset: number;
  },
) {
  const { yBase, amplitude, color, highlight, parallax, teeth, seedOffset } = opts;
  const offsetY = -cameraY * parallax;

  const peaks: Array<{ x: number; y: number }> = [];
  const segments = teeth * 2;
  for (let i = 0; i <= segments; i++) {
    const tt = i / segments;
    const x = tt * width;
    const seed = (i + seedOffset) * 9301 + 49297;
    const jitterX = (((seed * 233) % 1000) / 1000 - 0.5) * (width / segments) * 0.3;
    const jitterA = ((seed * 977) % 1000) / 1000;
    const peak = i % 2 === 0
      ? yBase + offsetY
      : yBase + offsetY - amplitude * (0.6 + jitterA * 0.4);
    peaks.push({ x: x + jitterX, y: peak });
  }

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, yBase + offsetY);
  for (const p of peaks) ctx.lineTo(p.x, p.y);
  ctx.lineTo(width, yBase + offsetY);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();

  // Soft white snow highlight along the ridge.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, yBase + offsetY);
  for (const p of peaks) ctx.lineTo(p.x, p.y);
  ctx.lineTo(width, yBase + offsetY);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = highlight;
  ctx.globalAlpha = 0.85;
  ctx.stroke();
  ctx.restore();
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

  if (type === 'ice') {
    drawIcePlatform(ctx, w, h);
    ctx.restore();
    return;
  }

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, -w / 2 + 6, -h / 2 + 8, w, h, 8);
  ctx.fill();

  let fillColor = '#8d5a2b';
  let stripeColor = 'rgba(0,0,0,0.18)';
  let icon = '🪵';
  switch (type) {
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

/**
 * Glacier-slab platform used in Ice Mode: translucent blue body, glossy
 * top, snow drift over the surface, jagged icicle teeth hanging off the
 * underside, frosty crystal speckles, and the same dark "legs" that all
 * platforms use to anchor visually into the void below.
 */
function drawIcePlatform(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
) {
  const t = performance.now();

  // Soft drop shadow — deep ice shadow, not pure black.
  ctx.fillStyle = 'rgba(11, 26, 42, 0.55)';
  roundRect(ctx, -w / 2 + 5, -h / 2 + 7, w, h, 12);
  ctx.fill();

  // Body — translucent glacier slab, paler top, deep-ice-shadow underbelly.
  // The mid tone is deeper than the new sky so the platform stays grounded
  // as something solid the player is stacking on.
  const body = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  body.addColorStop(0, ICE_PALETTE.iceWhite);
  body.addColorStop(0.4, ICE_PALETTE.frostMist);
  body.addColorStop(0.75, ICE_PALETTE.softGlacier);
  body.addColorStop(1, '#2a4868');
  ctx.fillStyle = body;
  roundRect(ctx, -w / 2, -h / 2, w, h, 12);
  ctx.fill();

  // Soft white bloom edge — replaces the old violet neon rim.
  ctx.save();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = ICE_PALETTE.iceWhite;
  ctx.shadowColor = ICE_PALETTE.iceWhite;
  ctx.shadowBlur = 10;
  ctx.globalAlpha = 0.65;
  roundRect(ctx, -w / 2, -h / 2, w, h, 12);
  ctx.stroke();
  ctx.restore();

  // Everything else is clipped to the platform shape.
  ctx.save();
  roundRect(ctx, -w / 2, -h / 2, w, h, 12);
  ctx.clip();

  // Top sheen.
  const sheen = ctx.createLinearGradient(0, -h / 2, 0, -h / 2 + 12);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(-w / 2, -h / 2, w, 12);

  // Moving refraction highlight — a soft diagonal white bar that slides
  // across the surface on a long cycle. Suggests light catching on a
  // glassy face.
  const refractCycle = (t / 6500) % 1; // 6.5s full pass
  const refractX = -w / 2 - 40 + refractCycle * (w + 80);
  const refract = ctx.createLinearGradient(refractX - 30, 0, refractX + 30, 0);
  refract.addColorStop(0, 'rgba(255,255,255,0)');
  refract.addColorStop(0.5, 'rgba(255,255,255,0.22)');
  refract.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = refract;
  ctx.fillRect(-w / 2, -h / 2, w, h);

  // Subsurface frozen bubbles — tiny translucent ellipses that drift
  // slowly. Deterministic seed so the same bubbles persist between frames,
  // but each one moves on its own slow vertical sine.
  for (let i = 0; i < 6; i++) {
    const seed = (i + 11) * 9301 + 49297;
    const bx = -w / 2 + 10 + (((seed * 233) % 1000) / 1000) * (w - 20);
    const baseY = -h / 2 + 5 + (((seed * 977) % 1000) / 1000) * (h - 10);
    const wobble = Math.sin(t / (4000 + (seed % 1000)) + i) * 1.2;
    const by = baseY + wobble;
    const rx = 2 + ((seed * 17) % 100) / 60;
    const ry = rx * 0.55;
    ctx.fillStyle = 'rgba(247, 253, 255, 0.55)';
    ctx.beginPath();
    ctx.ellipse(bx, by, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // Snow drift along the top — soft white ridge.
  ctx.save();
  ctx.fillStyle = ICE_PALETTE.iceWhite;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 2, -h / 2 + 2);
  const bumps = Math.max(6, Math.round(w / 18));
  for (let i = 0; i <= bumps; i++) {
    const tt = i / bumps;
    const px = -w / 2 + 2 + tt * (w - 4);
    const seed = (i + 7) * 9301 + 49297;
    const jitter = (((seed * 233) % 1000) / 1000 - 0.5) * 3;
    const py = -h / 2 - 4 + jitter;
    if (i === 0) ctx.lineTo(px, py);
    else ctx.quadraticCurveTo(px - (w / bumps) / 2, py - 3, px, py);
  }
  ctx.lineTo(w / 2 - 2, -h / 2 + 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(168, 200, 220, 0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // Icicles — thinner, translucent, with a slow shimmer on each tip.
  const icicles = Math.max(3, Math.round(w / 60));
  for (let i = 0; i < icicles; i++) {
    const seed = (i + 19) * 9301 + 49297;
    const cx = -w / 2 + (i + 0.5) * (w / icicles) + (((seed * 41) % 100) / 100 - 0.5) * 8;
    const len = 7 + ((seed * 13) % 6);
    const halfWidth = 2 + ((seed * 23) % 2);
    // Per-icicle shimmer phase so they twinkle at different times.
    const shimmer = 0.6 + 0.4 * Math.sin(t / 1800 + i * 1.3);
    const grad = ctx.createLinearGradient(cx, h / 2 - 1, cx, h / 2 - 1 + len);
    grad.addColorStop(0, `rgba(247, 253, 255, ${0.7 * shimmer})`);
    grad.addColorStop(1, 'rgba(168, 200, 220, 0.25)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx - halfWidth, h / 2 - 1);
    ctx.lineTo(cx + halfWidth, h / 2 - 1);
    ctx.lineTo(cx, h / 2 - 1 + len);
    ctx.closePath();
    ctx.fill();
  }

  // Dark legs anchoring the platform into the void below.
  ctx.fillStyle = '#070d1f';
  ctx.fillRect(-w / 2 + 18, h / 2, 12, 240);
  ctx.fillRect(w / 2 - 30, h / 2, 12, 240);

  // Snowflake glyph — soft white, not aqua.
  ctx.font = '14px Fredoka';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(247, 253, 255, 0.85)';
  ctx.fillText('❄', 0, 1);
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
  iceMode = false,
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

  // body.position is the centroid; the outline is anchored at the geometric
  // center. Translate by (geomCenter - centroid) so visual aligns with physics.
  const off = centroidOffsetFor(spec.shape, spec.unit);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(body.angle);
  ctx.scale(sx, sy);
  ctx.translate(-off.x, -off.y);

  drawPremiumSilhouette(ctx, spec, ghost, glow, iceMode);

  ctx.restore();
}

function drawPremiumSilhouette(
  ctx: CanvasRenderingContext2D,
  spec: BlockSpec,
  ghost: boolean,
  glow: number,
  iceMode = false,
) {
  // In ice mode every block reads as carved ice: a cool blue tint instead of
  // the per-shape palette. The shape still varies in hue slightly so the
  // pieces remain distinguishable at a glance.
  const color = iceMode ? iceTintFor(spec.shape) : getShapeColor(spec.shape);
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

  // Drop shadow — softer & cooler in ice mode so blocks feel translucent
  // rather than weighing down a lit world.
  if (!ghost) {
    ctx.save();
    ctx.shadowColor = iceMode ? 'rgba(11, 26, 42, 0.45)' : 'rgba(0, 0, 0, 0.42)';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = iceMode ? 5 : 7;
    ctx.shadowBlur = iceMode ? 14 : 12;
    ctx.fillStyle = iceMode ? '#1c3556' : shade(color, -0.45);
    traceRoundedOutline(ctx, outline, radius);
    ctx.fill();
    ctx.restore();
  }

  // Combo / perfect-placement halo. In ice mode the halo uses a soft
  // Ice-White bloom (perfect) or muted Glacier-Blue (combo) — natural
  // light, not arcade neon.
  if (glow > 0 && !ghost) {
    const haloColor = iceMode
      ? glow > 0.85
        ? ICE_PALETTE.iceWhite
        : ICE_PALETTE.glacierBlue
      : shade(color, 0.4);
    ctx.save();
    ctx.shadowColor = haloColor;
    ctx.shadowBlur = (iceMode ? 26 : 22) * glow;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = iceMode ? haloColor : shade(color, 0.18);
    ctx.globalAlpha = iceMode ? 0.4 : 1;
    traceRoundedOutline(ctx, outline, radius);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Main gradient fill — lighter on top, mid-tone at body, darker on bottom.
  // In ice mode the bottom is only slightly darker so the block reads as a
  // translucent crystal, not an opaque painted shape.
  const grad = ctx.createLinearGradient(0, minY, 0, maxY);
  if (iceMode) {
    grad.addColorStop(0, ICE_PALETTE.iceWhite);
    grad.addColorStop(0.4, color);
    grad.addColorStop(1, shade(color, -0.1));
  } else {
    grad.addColorStop(0, shade(color, 0.24));
    grad.addColorStop(0.42, color);
    grad.addColorStop(1, shade(color, -0.2));
  }
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

  if (!iceMode) {
    // Default mode: dark outer rim for definition.
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = shade(color, -0.5);
    ctx.globalAlpha = ghost ? 0.4 : 0.5;
    traceRoundedOutline(ctx, outline, radius);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Ice mode: replace the hard rim with internal frost texture, faint
  // shimmering fracture lines, and a soft outer white glow that suggests
  // global illumination instead of a stamped edge.
  if (iceMode && !ghost) {
    const t = performance.now();

    ctx.save();
    traceRoundedOutline(ctx, outline, radius);
    ctx.clip();

    // Internal frost speckles — gives the body a crystalline interior
    // without high-contrast cracks. Deterministic per shape so the texture
    // doesn't shimmer between frames.
    let xMin = Infinity;
    let xMax = -Infinity;
    for (const p of outline) {
      if (p.x < xMin) xMin = p.x;
      if (p.x > xMax) xMax = p.x;
    }
    const innerW = xMax - xMin;
    const innerH = maxY - minY;
    const shapeSeed = spec.shape.charCodeAt(0);
    ctx.fillStyle = 'rgba(247, 253, 255, 0.55)';
    const flakes = Math.round((innerW * innerH) / 320);
    for (let i = 0; i < flakes; i++) {
      const seed = (shapeSeed + i * 53) * 9301 + 49297;
      const fx = xMin + (((seed * 67) % 1000) / 1000) * innerW;
      const fy = minY + (((seed * 113) % 1000) / 1000) * innerH;
      const fs = 0.8 + ((seed * 7) % 100) / 110;
      ctx.fillRect(fx, fy, fs, fs);
    }

    // Faint internal fracture lines — barely visible, shimmer slowly on a
    // long sine so they breathe rather than stay static. Reads as natural
    // ice fracture, not stamped-on cracks.
    const fractureAlpha = 0.18 + 0.07 * Math.sin(t / 1800 + shapeSeed);
    ctx.strokeStyle = `rgba(247, 253, 255, ${fractureAlpha})`;
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 2; i++) {
      const seed = (shapeSeed + i * 37) * 9301 + 49297;
      const sx = xMin + (((seed * 233) % 1000) / 1000) * innerW;
      const sy = minY + (((seed * 977) % 1000) / 1000) * innerH;
      const len = (12 + ((seed * 17) % 16)) * (spec.unit / 32);
      const ang = ((seed * 311) % 1000) / 1000 * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
      const bAng = ang + (i % 2 === 0 ? 0.5 : -0.5);
      const bLen = len * 0.45;
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(bAng) * bLen, sy + Math.sin(bAng) * bLen);
      ctx.stroke();
    }

    ctx.restore();

    // Soft outer white bloom — a glow around the silhouette, NOT a hard
    // rim. Two stacked strokes with falling alpha so it feathers naturally.
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = ICE_PALETTE.iceWhite;
    ctx.shadowBlur = 6;
    ctx.strokeStyle = ICE_PALETTE.iceWhite;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.2;
    traceRoundedOutline(ctx, outline, radius);
    ctx.stroke();
    ctx.restore();
  }
}

function iceTintFor(shape: BlockSpec['shape']): string {
  return ICE_SHAPE_PALETTE[shape] ?? '#a8d4ea';
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
  iceMode = false,
) {
  const color = iceMode ? iceTintFor(spec.shape) : getShapeColor(spec.shape);
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
  iceMode = false,
) {
  const color = iceMode ? iceTintFor(spec.shape) : getShapeColor(spec.shape);
  const outline = outlineFor(spec.shape, spec.unit);
  const radius = Math.max(4, spec.unit * 0.22);

  ctx.save();
  ctx.translate(x, y - cameraY);
  ctx.rotate(angle);

  ctx.globalAlpha = iceMode ? 0.32 : 0.22;
  ctx.fillStyle = color;
  traceRoundedOutline(ctx, outline, radius);
  ctx.fill();

  ctx.globalAlpha = 0.95;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = iceMode ? '#d6ecf7' : '#ffffff';
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
