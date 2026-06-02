import { getAccentColor } from './themes';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  rotation: number;
  vr: number;
  shape: 'square' | 'circle' | 'star' | 'shard';
  gravity: number;
  /**
   * Optional size growth per ~16ms step. Positive grows the particle over
   * its lifetime (used for "frost breath" expanding cloud), negative shrinks.
   */
  sizeGrow?: number;
}

export class ParticleSystem {
  particles: Particle[] = [];

  emit(opts: {
    x: number;
    y: number;
    count: number;
    colors: string[];
    speed?: number;
    spread?: number;
    life?: number;
    size?: number;
    shape?: Particle['shape'];
    gravity?: number;
    sizeGrow?: number;
  }) {
    const speed = opts.speed ?? 6;
    const spread = opts.spread ?? Math.PI * 2;
    const life = opts.life ?? 600;
    const size = opts.size ?? 6;
    const shape = opts.shape ?? 'square';
    const gravity = opts.gravity ?? 0.3;
    const sizeGrow = opts.sizeGrow;
    for (let i = 0; i < opts.count; i++) {
      const angle = Math.random() * spread - spread / 2 - Math.PI / 2;
      const v = (0.5 + Math.random()) * speed;
      this.particles.push({
        x: opts.x,
        y: opts.y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life,
        maxLife: life,
        size: size * (0.6 + Math.random() * 0.8),
        color: opts.colors[Math.floor(Math.random() * opts.colors.length)],
        rotation: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.4,
        shape,
        gravity,
        sizeGrow,
      });
    }
  }

  emitConfetti(x: number, y: number, count = 60) {
    const a = getAccentColor();
    const colors = [a, '#ffffff', a, a, '#ffffff', a];
    this.emit({
      x,
      y,
      count,
      colors,
      speed: 9,
      spread: Math.PI * 1.4,
      life: 1400,
      size: 8,
      gravity: 0.18,
    });
  }

  emitBurst(x: number, y: number, color: string, count = 16) {
    this.emit({
      x,
      y,
      count,
      colors: [color, '#ffffff'],
      speed: 5,
      spread: Math.PI * 2,
      life: 500,
      size: 5,
      gravity: 0.0,
      shape: 'circle',
    });
  }

  emitImpact(x: number, y: number, count = 10) {
    this.emit({
      x,
      y,
      count,
      colors: ['#ffffff', getAccentColor()],
      speed: 4,
      spread: Math.PI,
      life: 320,
      size: 3,
      gravity: 0.1,
      shape: 'circle',
    });
  }

  /**
   * "Frost Breath" — soft expanding mist cloud for ice-mode landings. Slow
   * outward motion, mild gravity, and growing radius (via sizeGrow) so the
   * cloud reads as cold air condensing on impact, not a confetti puff.
   */
  emitFrostBreath(x: number, y: number, count = 18) {
    this.emit({
      x,
      y,
      count,
      colors: ['#F7FDFF', '#DFF6FF', '#ffffff'],
      speed: 1.8,
      spread: Math.PI * 2,
      life: 1100,
      size: 5,
      gravity: -0.01,
      shape: 'circle',
      sizeGrow: 0.08,
    });
  }

  /**
   * Tight ring of small white/cyan dots expanding outward from a point.
   * Reads as a frost shockwave on placement — flatter and more deliberate
   * than emitIceFlakes' upward spray.
   */
  emitFrostRing(x: number, y: number, count = 18) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
      const v = 3.6 + Math.random() * 1.2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v * 0.45 - 0.2,
        life: 520,
        maxLife: 520,
        size: 2.2 + Math.random() * 0.7,
        color: i % 3 === 0 ? '#DDF8FF' : '#FFFFFF',
        rotation: 0,
        vr: 0,
        shape: 'circle',
        gravity: 0.05,
      });
    }
  }

  /**
   * Small icy fragments that spray outward on impact. Lighter, faster, and
   * shorter-lived than emitIceShatter — used as the "chips fly off" puff
   * when a piece touches down in ice mode.
   */
  emitIceFlakes(x: number, y: number, count = 12) {
    this.emit({
      x,
      y,
      count,
      colors: ['#F7FDFF', '#DFF6FF', '#C8E0EC', '#ffffff'],
      speed: 4,
      spread: Math.PI * 1.4,
      life: 750,
      size: 3,
      gravity: 0.22,
      shape: 'shard',
    });
  }

  /**
   * Drifting star-shaped snowflakes. Slow downward fall with gentle drift,
   * long life so they linger after a placement like settling snow dust.
   */
  emitSnowflakes(x: number, y: number, count = 10) {
    this.emit({
      x,
      y,
      count,
      colors: ['#ffffff', '#F0FAFF', '#DCEDF8'],
      speed: 2.2,
      spread: Math.PI * 1.6,
      life: 1500,
      size: 4,
      gravity: 0.04,
      shape: 'star',
      sizeGrow: -0.005,
    });
  }

  /**
   * Aurora celebration — soft Aurora-Mint / Snowflake-Cyan motes that rise
   * and drift upward, used for ice-mode wins and level-ups. Long life and a
   * gentle negative gravity make them hang in the air like an aurora curtain
   * while crystal snowflakes (emitSnowflakes) rain down through them.
   */
  emitAurora(x: number, y: number, count = 48) {
    this.emit({
      x,
      y,
      count,
      colors: ['#CFFFEA', '#DDF8FF', '#A4F0D8', '#ffffff'],
      speed: 3.2,
      spread: Math.PI * 1.7,
      life: 1900,
      size: 6,
      gravity: -0.045,
      shape: 'circle',
      sizeGrow: -0.004,
    });
  }

  /**
   * Ice shatter — small translucent triangular shards spraying outward.
   * Used as the "ice cracking exposed core" effect inside a collapse, where
   * a frosty white cloud envelops a small Pale-Red-Frost hazard burst.
   */
  emitIceShatter(x: number, y: number, count = 14) {
    this.emit({
      x,
      y,
      count,
      colors: ['#F7FDFF', '#DFF6FF', '#C8E0EC'],
      speed: 5,
      spread: Math.PI * 2,
      life: 700,
      size: 4,
      gravity: 0.18,
      shape: 'shard',
    });
  }

  // ── Jelly Mode emitters ────────────────────────────────────────────────

  /**
   * Soft candy droplets that pop out and fall with a bit of bounce. Used as
   * the core placement spray — rounded blobs in fruit-jelly colours.
   */
  emitJellyDroplets(x: number, y: number, count = 12) {
    this.emit({
      x,
      y,
      count,
      colors: ['#FF7EB6', '#FFB68A', '#FFC857', '#7DE2B8', '#77C7FF', '#B99BFF'],
      speed: 4,
      spread: Math.PI * 1.4,
      life: 700,
      size: 5,
      gravity: 0.32,
      shape: 'circle',
    });
  }

  /**
   * Tiny cream-white / candy sparkles — twinkly sugar dust layered on top of
   * placements and combos. Star-shaped, low gravity, quick fade.
   */
  emitCandySparkle(x: number, y: number, count = 10) {
    this.emit({
      x,
      y,
      count,
      colors: ['#FFF8F1', '#FFFFFF', '#FFE6F2', '#FFF0C2'],
      speed: 2.6,
      spread: Math.PI * 2,
      life: 600,
      size: 3,
      gravity: 0.02,
      shape: 'star',
      sizeGrow: -0.004,
    });
  }

  /**
   * A flat ring of expanding bubble dots — reads as a soft bubble pop / jelly
   * shockwave at the contact point. Flatter and more deliberate than the
   * droplet spray.
   */
  emitBubblePop(x: number, y: number, count = 16) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
      const v = 3 + Math.random() * 1.1;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v * 0.5 - 0.2,
        life: 520,
        maxLife: 520,
        size: 2.4 + Math.random() * 0.9,
        color: i % 2 === 0 ? '#FFF8F1' : '#FFB0D2',
        rotation: 0,
        vr: 0,
        shape: 'circle',
        gravity: 0.04,
        sizeGrow: 0.05,
      });
    }
  }

  /**
   * Big colourful gummy burst for combos — chunky candy bits flung outward
   * with a satisfying spread, mixed with a few sparkles.
   */
  emitGummyExplosion(x: number, y: number, count = 22) {
    this.emit({
      x,
      y,
      count,
      colors: ['#FF7EB6', '#FFC857', '#7DE2B8', '#77C7FF', '#B99BFF', '#FFB68A'],
      speed: 6.5,
      spread: Math.PI * 2,
      life: 1000,
      size: 6,
      gravity: 0.16,
      shape: 'circle',
    });
    this.emitCandySparkle(x, y, 10);
  }

  /**
   * Rainbow jelly burst for a perfect placement — a full radial sweep cycling
   * through every flavour, ringed by an expanding bubble pop.
   */
  emitRainbowBurst(x: number, y: number, count = 28) {
    const rainbow = ['#FF7EB6', '#FFB68A', '#FFC857', '#7DE2B8', '#77C7FF', '#B99BFF'];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const v = 5 + Math.random() * 1.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: 950,
        maxLife: 950,
        size: 4 + Math.random() * 2,
        color: rainbow[i % rainbow.length],
        rotation: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        shape: 'circle',
        gravity: 0.05,
      });
    }
    this.emitBubblePop(x, y, 20);
  }

  /**
   * High-score candy shower — gummy bits launched upward that arc back down
   * through a haze of sugar sparkles. The celebratory "sugar storm".
   */
  emitCandyShower(x: number, y: number, count = 60) {
    this.emit({
      x,
      y,
      count,
      colors: ['#FF7EB6', '#FFC857', '#7DE2B8', '#77C7FF', '#B99BFF', '#FFB68A', '#FFF8F1'],
      speed: 9,
      spread: Math.PI * 1.5,
      life: 1500,
      size: 7,
      gravity: 0.2,
      shape: 'circle',
    });
    this.emitCandySparkle(x, y, 24);
  }

  step(dt: number) {
    const dts = dt / 16.6;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dts;
      p.y += p.vy * dts;
      p.vy += p.gravity * dts;
      p.vx *= 0.99;
      p.rotation += p.vr * dts;
      if (p.sizeGrow !== undefined) {
        p.size = Math.max(0, p.size + p.sizeGrow * dts);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      const a = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'star') {
        drawStar(ctx, 0, 0, 5, p.size, p.size / 2);
        ctx.fill();
      } else if (p.shape === 'shard') {
        // Ice shard — small irregular translucent triangle. Rotated by the
        // particle's own rotation so a burst looks like a spray of glass-
        // like fragments.
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size * 0.7, p.size * 0.5);
        ctx.lineTo(-p.size * 0.5, p.size * 0.7);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this.particles.length = 0;
  }
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  spikes: number,
  outer: number,
  inner: number,
) {
  let rot = (Math.PI / 2) * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outer);
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outer;
    y = cy + Math.sin(rot) * outer;
    ctx.lineTo(x, y);
    rot += step;
    x = cx + Math.cos(rot) * inner;
    y = cy + Math.sin(rot) * inner;
    ctx.lineTo(x, y);
    rot += step;
  }
  ctx.lineTo(cx, cy - outer);
  ctx.closePath();
}
