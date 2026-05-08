import type { BlockShape } from './types';

export interface ShapeGeom {
  /**
   * One or more axis-aligned rectangle parts (each is a list of local-space vertices).
   * Tetrominoes I, O = 1 part; T, S, Z, L, J = 2 parts.
   *
   * Vertices are CLOCKWISE in screen space (y grows downward) and centered around
   * the piece's geometric center.
   */
  parts: Array<Array<{ x: number; y: number }>>;
}

/** Cells per piece, in unit-cell coords (each cell is 1×1, centered at integer offsets). */
export interface CellLayout {
  cells: Array<{ cx: number; cy: number }>;
  width: number; // in cells
  height: number; // in cells
}

export function rectVerts(w: number, h: number, cx = 0, cy = 0) {
  return [
    { x: cx - w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy + h / 2 },
    { x: cx - w / 2, y: cy + h / 2 },
  ];
}

/**
 * Cell layouts for each tetromino, centered around origin.
 * Units are "cells" (multiply by `unit` for pixels). Y grows downward.
 */
export function cellsFor(shape: BlockShape): CellLayout {
  switch (shape) {
    case 'I':
      // ####
      return {
        cells: [
          { cx: -1.5, cy: 0 },
          { cx: -0.5, cy: 0 },
          { cx: 0.5, cy: 0 },
          { cx: 1.5, cy: 0 },
        ],
        width: 4,
        height: 1,
      };
    case 'O':
      // ##
      // ##
      return {
        cells: [
          { cx: -0.5, cy: -0.5 },
          { cx: 0.5, cy: -0.5 },
          { cx: -0.5, cy: 0.5 },
          { cx: 0.5, cy: 0.5 },
        ],
        width: 2,
        height: 2,
      };
    case 'T':
      // ###
      // .#.
      return {
        cells: [
          { cx: -1, cy: -0.5 },
          { cx: 0, cy: -0.5 },
          { cx: 1, cy: -0.5 },
          { cx: 0, cy: 0.5 },
        ],
        width: 3,
        height: 2,
      };
    case 'S':
      // .##
      // ##.
      return {
        cells: [
          { cx: 0, cy: -0.5 },
          { cx: 1, cy: -0.5 },
          { cx: -1, cy: 0.5 },
          { cx: 0, cy: 0.5 },
        ],
        width: 3,
        height: 2,
      };
    case 'Z':
      // ##.
      // .##
      return {
        cells: [
          { cx: -1, cy: -0.5 },
          { cx: 0, cy: -0.5 },
          { cx: 0, cy: 0.5 },
          { cx: 1, cy: 0.5 },
        ],
        width: 3,
        height: 2,
      };
    case 'L':
      // #.
      // #.
      // ##
      return {
        cells: [
          { cx: -0.5, cy: -1 },
          { cx: -0.5, cy: 0 },
          { cx: -0.5, cy: 1 },
          { cx: 0.5, cy: 1 },
        ],
        width: 2,
        height: 3,
      };
    case 'J':
      // .#
      // .#
      // ##
      return {
        cells: [
          { cx: 0.5, cy: -1 },
          { cx: 0.5, cy: 0 },
          { cx: 0.5, cy: 1 },
          { cx: -0.5, cy: 1 },
        ],
        width: 2,
        height: 3,
      };
  }
}

export function dimsFor(shape: BlockShape, unit: number): { w: number; h: number } {
  const layout = cellsFor(shape);
  return { w: layout.width * unit, h: layout.height * unit };
}

/**
 * Build collision/render geometry as one or two axis-aligned rectangles per piece.
 * Pieces are merged horizontally where possible to keep the physics body simple.
 */
export function geomFor(shape: BlockShape, unit: number): ShapeGeom {
  const u = unit;
  switch (shape) {
    case 'I':
      return { parts: [rectVerts(4 * u, u)] };
    case 'O':
      return { parts: [rectVerts(2 * u, 2 * u)] };
    case 'T':
      return {
        parts: [
          rectVerts(3 * u, u, 0, -0.5 * u),
          rectVerts(u, u, 0, 0.5 * u),
        ],
      };
    case 'S':
      return {
        parts: [
          rectVerts(2 * u, u, 0.5 * u, -0.5 * u),
          rectVerts(2 * u, u, -0.5 * u, 0.5 * u),
        ],
      };
    case 'Z':
      return {
        parts: [
          rectVerts(2 * u, u, -0.5 * u, -0.5 * u),
          rectVerts(2 * u, u, 0.5 * u, 0.5 * u),
        ],
      };
    case 'L':
      return {
        parts: [
          rectVerts(u, 3 * u, -0.5 * u, 0),
          rectVerts(u, u, 0.5 * u, u),
        ],
      };
    case 'J':
      return {
        parts: [
          rectVerts(u, 3 * u, 0.5 * u, 0),
          rectVerts(u, u, -0.5 * u, u),
        ],
      };
  }
}

/** Trace a Path2D from a ShapeGeom, ready to fill/stroke at the body's local origin. */
export function tracePath(ctx: CanvasRenderingContext2D, geom: ShapeGeom): void {
  ctx.beginPath();
  for (const verts of geom.parts) {
    if (verts.length === 0) continue;
    ctx.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < verts.length; i++) {
      ctx.lineTo(verts[i].x, verts[i].y);
    }
    ctx.closePath();
  }
}

/**
 * Closed clockwise outline of a tetromino's silhouette in local coordinates,
 * centered at origin. Each point is flagged convex (90° outer turn — round
 * with a soft corner) or concave (270° inner turn — keep sharp). Used by the
 * premium block renderer to draw a single unified shape with rounded outer
 * corners only.
 */
export interface OutlinePoint {
  x: number;
  y: number;
  convex: boolean;
}

export function outlineFor(shape: BlockShape, unit: number): OutlinePoint[] {
  const u = unit;
  switch (shape) {
    case 'I':
      return [
        { x: -2 * u, y: -0.5 * u, convex: true },
        { x: 2 * u, y: -0.5 * u, convex: true },
        { x: 2 * u, y: 0.5 * u, convex: true },
        { x: -2 * u, y: 0.5 * u, convex: true },
      ];
    case 'O':
      return [
        { x: -u, y: -u, convex: true },
        { x: u, y: -u, convex: true },
        { x: u, y: u, convex: true },
        { x: -u, y: u, convex: true },
      ];
    case 'T':
      return [
        { x: -1.5 * u, y: -u, convex: true },
        { x: 1.5 * u, y: -u, convex: true },
        { x: 1.5 * u, y: 0, convex: true },
        { x: 0.5 * u, y: 0, convex: false },
        { x: 0.5 * u, y: u, convex: true },
        { x: -0.5 * u, y: u, convex: true },
        { x: -0.5 * u, y: 0, convex: false },
        { x: -1.5 * u, y: 0, convex: true },
      ];
    case 'S':
      return [
        { x: -0.5 * u, y: -u, convex: true },
        { x: 1.5 * u, y: -u, convex: true },
        { x: 1.5 * u, y: 0, convex: true },
        { x: 0.5 * u, y: 0, convex: false },
        { x: 0.5 * u, y: u, convex: true },
        { x: -1.5 * u, y: u, convex: true },
        { x: -1.5 * u, y: 0, convex: true },
        { x: -0.5 * u, y: 0, convex: false },
      ];
    case 'Z':
      return [
        { x: -1.5 * u, y: -u, convex: true },
        { x: 0.5 * u, y: -u, convex: true },
        { x: 0.5 * u, y: 0, convex: false },
        { x: 1.5 * u, y: 0, convex: true },
        { x: 1.5 * u, y: u, convex: true },
        { x: -0.5 * u, y: u, convex: true },
        { x: -0.5 * u, y: 0, convex: false },
        { x: -1.5 * u, y: 0, convex: true },
      ];
    case 'L':
      return [
        { x: -u, y: -1.5 * u, convex: true },
        { x: 0, y: -1.5 * u, convex: true },
        { x: 0, y: 0.5 * u, convex: false },
        { x: u, y: 0.5 * u, convex: true },
        { x: u, y: 1.5 * u, convex: true },
        { x: -u, y: 1.5 * u, convex: true },
      ];
    case 'J':
      return [
        { x: 0, y: -1.5 * u, convex: true },
        { x: u, y: -1.5 * u, convex: true },
        { x: u, y: 1.5 * u, convex: true },
        { x: -u, y: 1.5 * u, convex: true },
        { x: -u, y: 0.5 * u, convex: true },
        { x: 0, y: 0.5 * u, convex: false },
      ];
  }
}

/**
 * Trace a closed path with rounded outer corners (convex) and sharp inner
 * corners (concave). Path is drawn at the current ctx origin.
 */
export function traceRoundedOutline(
  ctx: CanvasRenderingContext2D,
  pts: OutlinePoint[],
  radius: number,
): void {
  const n = pts.length;
  type Seg = {
    convex: boolean;
    pre: { x: number; y: number };
    post: { x: number; y: number };
    corner: { x: number; y: number };
  };
  const segs: Seg[] = pts.map((p, i) => {
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    if (!p.convex) {
      return { convex: false, pre: p, post: p, corner: p };
    }
    const dxi = p.x - prev.x;
    const dyi = p.y - prev.y;
    const li = Math.hypot(dxi, dyi) || 1;
    const ux = dxi / li;
    const uy = dyi / li;
    const dxo = next.x - p.x;
    const dyo = next.y - p.y;
    const lo = Math.hypot(dxo, dyo) || 1;
    const vx = dxo / lo;
    const vy = dyo / lo;
    const r = Math.min(radius, li / 2, lo / 2);
    return {
      convex: true,
      pre: { x: p.x - ux * r, y: p.y - uy * r },
      post: { x: p.x + vx * r, y: p.y + vy * r },
      corner: { x: p.x, y: p.y },
    };
  });

  ctx.beginPath();
  ctx.moveTo(segs[0].pre.x, segs[0].pre.y);
  for (let i = 0; i < n; i++) {
    const s = segs[i];
    if (s.convex) {
      ctx.quadraticCurveTo(s.corner.x, s.corner.y, s.post.x, s.post.y);
    }
    const next = segs[(i + 1) % n];
    ctx.lineTo(next.pre.x, next.pre.y);
  }
  ctx.closePath();
}

/** Build an SVG path string for a ShapeGeom (used by BlockPreview). */
export function svgPath(geom: ShapeGeom): string {
  return geom.parts
    .map((verts) => {
      if (verts.length === 0) return '';
      const head = `M ${verts[0].x} ${verts[0].y}`;
      const tail = verts
        .slice(1)
        .map((v) => `L ${v.x} ${v.y}`)
        .join(' ');
      return `${head} ${tail} Z`;
    })
    .join(' ');
}
