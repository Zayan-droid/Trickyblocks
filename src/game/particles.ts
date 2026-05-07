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
  shape: 'square' | 'circle' | 'star';
  gravity: number;
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
  }) {
    const speed = opts.speed ?? 6;
    const spread = opts.spread ?? Math.PI * 2;
    const life = opts.life ?? 600;
    const size = opts.size ?? 6;
    const shape = opts.shape ?? 'square';
    const gravity = opts.gravity ?? 0.3;
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
