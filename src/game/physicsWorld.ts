import Matter from 'matter-js';
import type { BlockSpec, PlatformType } from './types';
import { geomFor } from './shapes';

export interface BodyMeta {
  blockId: string;
  spec: BlockSpec;
  placedAt: number;
  scored: boolean;
  shattered?: boolean;
}

export interface PlatformOptions {
  type: PlatformType;
  width: number;
  height: number;
  cx: number;
  cy: number;
}

export interface WorldHandles {
  engine: Matter.Engine;
  world: Matter.World;
  ground: Matter.Body;
  platform: Matter.Body;
  walls: Matter.Body[];
}

export const PHYSICS = {
  gravity: 1.0,
  timeStep: 1000 / 60,
};

export function createWorld(width: number, height: number): WorldHandles {
  const engine = Matter.Engine.create({
    gravity: { x: 0, y: 1, scale: 0.0018 },
    enableSleeping: true,
    constraintIterations: 4,
    positionIterations: 8,
    velocityIterations: 8,
  });
  const world = engine.world;

  const ground = Matter.Bodies.rectangle(width / 2, height + 200, width * 4, 400, {
    isStatic: true,
    label: 'ground',
    friction: 1,
    render: { visible: false },
  });

  const platform = Matter.Bodies.rectangle(width / 2, height - 80, 200, 24, {
    isStatic: true,
    label: 'platform',
    friction: 0.5,
    restitution: 0.0,
  });

  const wallL = Matter.Bodies.rectangle(-200, height / 2, 400, height * 4, {
    isStatic: true,
    label: 'wall',
    render: { visible: false },
  });
  const wallR = Matter.Bodies.rectangle(width + 200, height / 2, 400, height * 4, {
    isStatic: true,
    label: 'wall',
    render: { visible: false },
  });

  Matter.Composite.add(world, [ground, platform, wallL, wallR]);

  return { engine, world, ground, platform, walls: [wallL, wallR] };
}

export function disposeWorld(handles: WorldHandles) {
  Matter.World.clear(handles.world, false);
  Matter.Engine.clear(handles.engine);
}

function platformProps(type: PlatformType) {
  switch (type) {
    case 'ice':
      return { friction: 0.02, restitution: 0.0 };
    case 'bouncy':
      return { friction: 0.4, restitution: 0.85 };
    case 'magnetic':
      return { friction: 0.55, restitution: 0.0 };
    case 'fragile':
      return { friction: 0.45, restitution: 0.0 };
    case 'wood':
    default:
      return { friction: 0.5, restitution: 0.0 };
  }
}

export function recreatePlatform(
  handles: WorldHandles,
  cx: number,
  cy: number,
  type: PlatformType,
  width = 220,
): Matter.Body {
  Matter.World.remove(handles.world, handles.platform);
  const props = platformProps(type);
  const platform = Matter.Bodies.rectangle(cx, cy, width, 26, {
    isStatic: true,
    label: 'platform',
    friction: props.friction,
    restitution: props.restitution,
  });
  (platform as { _platformType?: PlatformType })._platformType = type;
  (platform as { _platformWidth?: number })._platformWidth = width;
  Matter.World.add(handles.world, platform);
  handles.platform = platform;
  return platform;
}

export interface SpawnOpts {
  x: number;
  y: number;
  angle?: number;
  spec: BlockSpec;
  isStatic?: boolean;
}

export function spawnBlock(world: Matter.World, opts: SpawnOpts): Matter.Body {
  const { spec, x, y, angle = 0, isStatic = false } = opts;
  const body = makeBody(spec, x, y, angle);
  body.isStatic = isStatic;
  Matter.Body.setStatic(body, isStatic);
  const meta: BodyMeta = {
    blockId: spec.id,
    spec,
    placedAt: 0,
    scored: false,
  };
  (body as Matter.Body & { _meta: BodyMeta })._meta = meta;
  body.label = `block:${spec.shape}`;
  Matter.World.add(world, body);
  return body;
}

function makeBody(
  spec: BlockSpec,
  x: number,
  y: number,
  angle: number,
): Matter.Body {
  const { unit, density, friction, restitution, shape } = spec;
  const opts: Matter.IChamferableBodyDefinition = {
    density,
    friction,
    // Match static to kinetic so off-center stacks start sliding immediately
    // instead of getting glued in place by an artificial extra-grip threshold.
    frictionStatic: friction,
    restitution,
    angle,
    chamfer: { radius: 3 },
    sleepThreshold: 30,
  };
  const geom = geomFor(shape, unit);

  if (geom.parts.length === 1) {
    const verts = geom.parts[0];
    const xs = verts.map((v) => v.x);
    const ys = verts.map((v) => v.y);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);
    return Matter.Bodies.rectangle(x, y, w, h, opts);
  }

  const partOpts: Matter.IBodyDefinition = {
    density,
    friction,
    frictionStatic: friction,
    restitution,
  };
  const parts = geom.parts.map((verts) => {
    const xs = verts.map((v) => v.x);
    const ys = verts.map((v) => v.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return Matter.Bodies.rectangle(
      x + cx,
      y + cy,
      maxX - minX,
      maxY - minY,
      partOpts,
    );
  });
  const compound = Matter.Body.create({ parts, ...opts });
  Matter.Body.setPosition(compound, { x, y });
  Matter.Body.setAngle(compound, angle);
  return compound;
}

export function applyWind(world: Matter.World, wind: number) {
  if (wind === 0) return;
  for (const body of world.bodies) {
    if (body.isStatic) continue;
    if (body.label === 'ground' || body.label === 'wall' || body.label === 'platform') continue;
    Matter.Body.applyForce(body, body.position, {
      x: wind * 0.00005 * body.mass,
      y: 0,
    });
  }
}

export function applyShake(handles: WorldHandles, intensity: number, t: number) {
  if (intensity <= 0) return;
  const a = Math.sin(t * 0.012) * intensity * 6;
  Matter.Body.setPosition(handles.platform, {
    x: handles.platform.position.x,
    y: (handles.platform as Matter.Body & { _baseY?: number })._baseY ?? handles.platform.position.y,
  });
  Matter.Body.translate(handles.platform, { x: a, y: 0 });
}

export function applyMagneticPull(handles: WorldHandles, world: Matter.World) {
  const center = handles.platform.position;
  for (const body of world.bodies) {
    if (body.isStatic) continue;
    if (!body.label.startsWith('block')) continue;
    const dx = body.position.x - center.x;
    const dist = Math.max(40, Math.abs(dx));
    const dir = dx > 0 ? 1 : -1;
    Matter.Body.applyForce(body, body.position, {
      x: dir * (1 / dist) * 0.0008 * body.mass,
      y: 0,
    });
  }
}

export function freezeAll(world: Matter.World, sleep: boolean) {
  for (const body of world.bodies) {
    if (body.isStatic) continue;
    if (!body.label.startsWith('block')) continue;
    Matter.Body.setVelocity(body, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(body, 0);
    if (sleep) Matter.Sleeping.set(body, true);
  }
}

export function towerHeightFromPlatform(world: Matter.World, platformY: number): number {
  let topY = platformY;
  for (const body of world.bodies) {
    if (body.isStatic) continue;
    if (!body.label.startsWith('block')) continue;
    if (body.position.y < topY) topY = body.position.y;
  }
  return Math.max(0, platformY - topY);
}
