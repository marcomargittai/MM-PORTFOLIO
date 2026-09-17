/** Pull glues diagonal and gapped cells. Adjacent tiles stay a straight union. */

export function smin(a: number, b: number, k: number): number {
  const kk = Math.max(k, 1e-5);
  const h = Math.min(1, Math.max(0, 0.5 + 0.5 * (b - a) / kk));
  return b * (1 - h) + a * h - kk * h * (1 - h);
}

export function sdRoundBox(px: number, py: number, hx: number, hy: number, r: number): number {
  const rad = Math.min(Math.max(r, 0), Math.min(hx, hy));
  const qx = Math.abs(px) - hx + rad;
  const qy = Math.abs(py) - hy + rad;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
}

/**
 * Round-box with one radius per quadrant.
 * r = (+x+y, +x-y, -x+y, -x-y) — east-south, east-north, west-south, west-north.
 */
export function sdRoundBox4(
  px: number,
  py: number,
  hx: number,
  hy: number,
  r: readonly [number, number, number, number],
): number {
  let rx = px > 0 ? r[0] : r[2];
  let ry = px > 0 ? r[1] : r[3];
  const rad = Math.max(0, py > 0 ? rx : ry);
  const qx = Math.abs(px) - hx + rad;
  const qy = Math.abs(py) - hy + rad;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
}

/** Smooth-min radius in cell units. Linear: 0 off, 1.0 (slider 100) Yuga weld. */
export function pullKCells(pull: number): number {
  return Math.max(0, pull) * 1.05;
}

/**
 * Isolated drops may grow toward a gap. Adjacent tiles stay 0.5 so a bar
 * is a rounded rectangle, not a chain of disks.
 */
export function pullBlobScale(pull: number): number {
  return 0.5 + Math.max(0, pull) * 0.1;
}

/** Any 8-neighbor keeps a 0.5 tile. Only a lone drop uses Pull swell. */
export function cellBodyHalf(pull: number, ortho: boolean, diag: boolean): number {
  return ortho || diag ? 0.5 : pullBlobScale(pull);
}

/** Diagonal of an L — the fillet owns this corner, glue would bead it. */
export function pairIsLNotch(
  a: readonly [number, number],
  b: readonly [number, number],
  occupied: (x: number, y: number) => boolean,
): boolean {
  if (Math.abs(a[0] - b[0]) !== 1 || Math.abs(a[1] - b[1]) !== 1) return false;
  const o0 = occupied(a[0], b[1]) ? 1 : 0;
  const o1 = occupied(b[0], a[1]) ? 1 : 0;
  return o0 + o1 === 1;
}

/** Glue is always a 0.5 tile. Gap reach is k, not a fatter box. */
export function glueBodyHalf(
  _pull?: number,
  _a?: readonly [number, number],
  _b?: readonly [number, number],
): number {
  return 0.5;
}

export function cellsShareEdge(
  a: readonly [number, number],
  b: readonly [number, number],
): boolean {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
}

/** Diagonal or a vacant gap — this is where Pull is allowed to weld. */
export function cellsNeedPull(
  a: readonly [number, number],
  b: readonly [number, number],
  occupied?: (x: number, y: number) => boolean,
): boolean {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx + ady < 2) return false;
  if (adx > 0 && ady > 0) return true;
  if (!occupied) return true;
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  const steps = Math.max(adx, ady);
  for (let s = 1; s < steps; s++) {
    if (!occupied(a[0] + sx * s, a[1] + sy * s)) return true;
  }
  return false;
}

function hasCell(
  cells: ReadonlyArray<readonly [number, number]>,
  x: number,
  y: number,
): boolean {
  for (const [cx, cy] of cells) {
    if (cx === x && cy === y) return true;
  }
  return false;
}

/** Exposed-corner radii. A shared edge stays square so adjacent tiles stay flat. */
export function exposedCornerRadii(
  cx: number,
  cy: number,
  cells: ReadonlyArray<readonly [number, number]>,
  radius: number,
): [number, number, number, number] {
  const e = hasCell(cells, cx + 1, cy);
  const w = hasCell(cells, cx - 1, cy);
  const s = hasCell(cells, cx, cy + 1);
  const n = hasCell(cells, cx, cy - 1);
  return [
    e || s ? 0 : radius,
    e || n ? 0 : radius,
    w || s ? 0 : radius,
    w || n ? 0 : radius,
  ];
}

function cellSd(
  x: number,
  y: number,
  cx: number,
  cy: number,
  half: number,
  radii: readonly [number, number, number, number],
): number {
  return sdRoundBox4(x - (cx + 0.5), y - (cy + 0.5), half, half, radii);
}

/**
 * Pull pairing ignores the rest of the blob. Every cell is the same
 * Goo-rounded body, so a lone diagonal and a fat L-notch weld equally.
 */
export function glueCellSd(
  x: number,
  y: number,
  cx: number,
  cy: number,
  pull: number,
  goo01: number,
  half = pullBlobScale(pull),
): number {
  const rad = Math.min(1, Math.max(0, goo01)) * half;
  return sdRoundBox(x - (cx + 0.5), y - (cy + 0.5), half, half, rad);
}

/**
 * Concave Goo-radius fillet in a 3-of-4 2×2 — the inner corner of an L.
 * A vertex pie (length(q)-r) is the C-cap nub; this is the CAD arc
 * centered at (r,r). A 3-bar is 2-of-4 along the side, so it stays straight.
 */
export function innerNotchFillet(
  x: number,
  y: number,
  cells: ReadonlyArray<readonly [number, number]>,
  radius: number,
): number {
  if (radius <= 1e-6) return 1e5;
  let best = 1e5;
  const ix0 = Math.floor(x - 0.15);
  const ix1 = Math.ceil(x + 0.15);
  const iy0 = Math.floor(y - 0.15);
  const iy1 = Math.ceil(y + 0.15);
  for (let iy = iy0; iy <= iy1; iy++) {
    for (let ix = ix0; ix <= ix1; ix++) {
      const a = hasCell(cells, ix - 1, iy - 1);
      const b = hasCell(cells, ix, iy - 1);
      const c = hasCell(cells, ix - 1, iy);
      const d = hasCell(cells, ix, iy);
      const n = (a ? 1 : 0) + (b ? 1 : 0) + (c ? 1 : 0) + (d ? 1 : 0);
      if (n !== 3) continue;
      let px = x - ix;
      let py = y - iy;
      if (!a) {
        px = -px;
        py = -py;
      } else if (!b) {
        py = -py;
      } else if (!c) {
        px = -px;
      }
      if (px < 0 || py < 0 || px > radius || py > radius) continue;
      best = Math.min(best, radius - Math.hypot(radius - px, radius - py));
    }
  }
  return best;
}

/**
 * Tiles + CAD inner fillet — the squares, not the glue.
 * Compose holds this so occupancy-blur can own the connecting tissue.
 */
export function liveCore(
  x: number,
  y: number,
  cells: ReadonlyArray<readonly [number, number]>,
  pull: number,
  goo01: number,
): number {
  const goo = Math.min(1, Math.max(0, goo01));
  let union = 1e5;
  for (const [cx, cy] of cells) {
    const ortho =
      hasCell(cells, cx + 1, cy) ||
      hasCell(cells, cx - 1, cy) ||
      hasCell(cells, cx, cy + 1) ||
      hasCell(cells, cx, cy - 1);
    const diag =
      hasCell(cells, cx + 1, cy + 1) ||
      hasCell(cells, cx + 1, cy - 1) ||
      hasCell(cells, cx - 1, cy + 1) ||
      hasCell(cells, cx - 1, cy - 1);
    const half = cellBodyHalf(pull, ortho, diag);
    const radii = exposedCornerRadii(cx, cy, cells, goo * half);
    union = Math.min(union, cellSd(x, y, cx, cy, half, radii));
  }
  return Math.min(union, innerNotchFillet(x, y, cells, goo * 0.5));
}

/**
 * Live field: hard-union of the polyomino, then smin only pairs that
 * do not share an edge. Adjacent bars keep a straight side.
 */
export function liveField(
  x: number,
  y: number,
  cells: ReadonlyArray<readonly [number, number]>,
  pull: number,
  goo01: number,
): number {
  const k = pullKCells(pull);
  const goo = Math.min(1, Math.max(0, goo01));
  let union = 1e5;
  const ds: number[] = [];
  for (const [cx, cy] of cells) {
    const ortho =
      hasCell(cells, cx + 1, cy) ||
      hasCell(cells, cx - 1, cy) ||
      hasCell(cells, cx, cy + 1) ||
      hasCell(cells, cx, cy - 1);
    const diag =
      hasCell(cells, cx + 1, cy + 1) ||
      hasCell(cells, cx + 1, cy - 1) ||
      hasCell(cells, cx - 1, cy + 1) ||
      hasCell(cells, cx - 1, cy - 1);
    const half = cellBodyHalf(pull, ortho, diag);
    const radii = exposedCornerRadii(cx, cy, cells, goo * half);
    const d = cellSd(x, y, cx, cy, half, radii);
    ds.push(d);
    union = Math.min(union, d);
  }
  const fillet = innerNotchFillet(x, y, cells, goo * 0.5);
  let field = Math.min(union, fillet);
  if (k <= 0) return field;
  const occupied = (ox: number, oy: number) => hasCell(cells, ox, oy);
  let glue = 1e5;
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      if (!cellsNeedPull(cells[i], cells[j], occupied)) continue;
      if (pairIsLNotch(cells[i], cells[j], occupied)) continue;
      const cheb = Math.max(
        Math.abs(cells[i][0] - cells[j][0]),
        Math.abs(cells[i][1] - cells[j][1]),
      );
      if (cheb > 2) continue;
      // Only fill the gap. Inside the 0-set the union already owns
      // the solid — a fatter glue box would scallop 2-of-4 sides.
      if (ds[i] < 0 || ds[j] < 0) continue;
      const gh = glueBodyHalf(pull, cells[i], cells[j]);
      const a = glueCellSd(x, y, cells[i][0], cells[i][1], pull, goo, gh);
      const b = glueCellSd(x, y, cells[j][0], cells[j][1], pull, goo, gh);
      glue = Math.min(glue, smin(a, b, k));
    }
  }
  return Math.min(field, glue);
}

/** Dying drop smin'd into a survivor — a small drop being swallowed. */
export function coalesceField(
  x: number,
  y: number,
  survivors: ReadonlyArray<readonly [number, number]>,
  dying: { cx: number; cy: number; scale: number; ox?: number; oy?: number },
  pull: number,
  goo01: number,
): number {
  const body = liveField(x, y, survivors, pull, goo01);
  const half = 0.5 * Math.max(dying.scale, 0);
  const px = x - (dying.cx + 0.5 + (dying.ox ?? 0));
  const py = y - (dying.cy + 0.5 + (dying.oy ?? 0));
  const drop = sdRoundBox(px, py, half, half, half);
  const k = Math.max(pullKCells(pull), 0.45);
  return smin(body, drop, k);
}
