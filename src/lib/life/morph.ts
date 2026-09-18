/**
 * Visual-center and pairing rules the WebGL shader must match.
 * Settled liveField is unchanged — this only describes motion mid-generation.
 */

import {
  birthOffset,
  birthScale,
  dyingDissolveScale,
  dyingSuckScale,
  dyingTravel,
  liquidEase,
  liquidFluxNorm,
  type CellPull,
} from "./death";
import {
  glueCellSd,
  innerNotchFillet,
  liveCore,
  liveField,
  pullKCells,
  sdRoundBox,
  sdRoundBox4,
  smin,
} from "./magnetism";

export type CellPoint = { x: number; y: number };
export type MorphRole = "stay" | "birth" | "death";

/** Ortho neighbors at rest sit one cell apart and share an edge. */
export const FLUSH_DIST = 1;

/** One vacant cell (or farther) — the neighbor is gone from this edge. */
export const FAR_DIST = 2;

/** Stretch weld is full below this visual distance (cell units). */
export const STRETCH_FULL = 0.92;

/** Stretch weld is gone above this — flush tiles are a hard union. */
export const STRETCH_END = 1.05;

/** A blob still sits on a lattice home / gap midpoint. */
export const SIT_IN = 0.48;
export const SIT_OUT = 0.66;

/** Mass used by the L-notch — ramps across most of a one-cell travel. */
export const OCCUPY_IN = 0.18;
export const OCCUPY_OUT = 0.72;

/** Diagonal Pull stays off while two blobs still overlap. Rest √2 is full k. */
export const DIAG_SMIN_IN = 0.78;
export const DIAG_SMIN_OUT = 1.22;

export type MorphCell = {
  x: number;
  y: number;
  role: MorphRole;
  pull: CellPull;
};

/**
 * Where the blob sits in cell units.
 * Birth uses birthOffset (starts on the parent, ends at home).
 * Death uses dyingTravel (starts at home, ends on the survivor).
 */
export function visualCenter(
  home: CellPoint,
  pull: CellPull,
  t: number,
  role: MorphRole,
): CellPoint {
  if (role === "birth") {
    const off = birthOffset(pull, t);
    return { x: home.x + off.dx, y: home.y + off.dy };
  }
  if (role === "death") {
    const u = dyingTravel(t);
    return { x: home.x + pull.dx * u, y: home.y + pull.dy * u };
  }
  return { x: home.x, y: home.y };
}

/**
 * True when visual centers share an edge: one cell apart.
 * Closer is overlap (a birth still on the parent). Farther is a gap.
 */
export function neighborFlush(distCells: number): boolean {
  return Math.abs(distCells - FLUSH_DIST) <= 1e-4;
}

/**
 * Pull-smin this pair?
 * Grid manhattan 1 is a hard union at rest so a bar stays a bar.
 * A birth still overlapping its parent is closer than flush — weld it
 * (the shader fills that weld with a swept Goo box, not a sausage smin).
 * Manhattan >= 2 is Pull's job (diagonal / gap). Solid runs still
 * skip through cellsNeedPull / the occupied-middle check.
 */
export function pairShouldSmin(manhattan: number, distCells: number): boolean {
  if (manhattan < 2 && distCells >= FLUSH_DIST - 1e-4) return false;
  return true;
}

/** Ortho pair still overlapping — one droplet stretching, not two tiles. */
export function pairShouldStretch(manhattan: number, distCells: number): boolean {
  return manhattan < 2 && distCells < FLUSH_DIST - 1e-4;
}

/**
 * Exposed-corner mix.
 * 0 = square (neighbor flush or closer). 1 = full Goo radius (gone/far).
 */
export function cornerWeight(distCells: number): number {
  if (!(distCells > FLUSH_DIST)) return 0;
  if (distCells >= FAR_DIST) return 1;
  const u = (distCells - FLUSH_DIST) / (FAR_DIST - FLUSH_DIST);
  return u * u * (3 - 2 * u);
}

export function saturate(v: number, lo = 0, hi = 1): number {
  return Math.min(hi, Math.max(lo, v));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = saturate((x - edge0) / Math.max(edge1 - edge0, 1e-8));
  return t * t * (3 - 2 * t);
}

/** 1 when a blob center still covers this lattice point. */
export function sitWeight(distCells: number): number {
  return 1 - smoothstep(SIT_IN, SIT_OUT, distCells);
}

/** 1 when a blob is treating this home as occupied (notch / mass). */
export function occupyWeight(distCells: number): number {
  return 1 - smoothstep(OCCUPY_IN, OCCUPY_OUT, distCells);
}

/** How much of the stretch weld remains (1 while overlapping, 0 at flush). */
export function stretchAmount(distCells: number): number {
  return 1 - smoothstep(STRETCH_FULL, STRETCH_END, distCells);
}

/**
 * How much a neighbor sitting at `other` covers the edge of `self` along `dir`.
 * Flush / overlapping on-axis → 1 (that corner stays square).
 * Gone, far, or off-axis → 0 (Goo radius).
 */
export function edgePresence(
  self: CellPoint,
  other: CellPoint,
  dir: CellPoint,
): number {
  const ox = other.x - self.x;
  const oy = other.y - self.y;
  const dist = Math.hypot(ox, oy);
  const along = ox * dir.x + oy * dir.y;
  const px = ox - dir.x * along;
  const py = oy - dir.y * along;
  const perp = Math.hypot(px, py);
  const align = 1 - smoothstep(0.35, 0.85, perp);
  const face = smoothstep(0.0, 0.18, along);
  return saturate((1 - cornerWeight(dist)) * align * face);
}

function blobScale(role: MorphRole, t: number, pull: CellPull): number {
  if (role === "birth") return birthScale(t);
  if (role === "death") {
    const sucked = pull.dx * pull.dx + pull.dy * pull.dy > 0.02;
    return sucked ? dyingSuckScale(t) : dyingDissolveScale(t) * (1 - saturate(t));
  }
  return 1;
}

type Blob = {
  home: CellPoint;
  vc: CellPoint;
  role: MorphRole;
  pull: CellPull;
  scale: number;
  half: number;
  rad: number;
};

function buildBlobs(cells: readonly MorphCell[], t: number, pull: number, goo01: number): Blob[] {
  const goo = saturate(goo01);
  const raw: Blob[] = [];
  for (const c of cells) {
    const home = { x: c.x, y: c.y };
    const vc = visualCenter(home, c.pull, t, c.role);
    const scale = blobScale(c.role, t, c.pull);
    if (scale < 0.02) continue;
    raw.push({
      home,
      vc,
      role: c.role,
      pull: c.pull,
      scale,
      half: 0.5 * scale,
      rad: goo * 0.5 * scale,
    });
  }

  const blobs: Blob[] = [];
  for (const self of raw) {
    let e = 0;
    let w = 0;
    let s = 0;
    let n = 0;
    for (const other of raw) {
      if (other === self) continue;
      e = Math.max(e, edgePresence(self.vc, other.vc, { x: 1, y: 0 }));
      w = Math.max(w, edgePresence(self.vc, other.vc, { x: -1, y: 0 }));
      s = Math.max(s, edgePresence(self.vc, other.vc, { x: 0, y: 1 }));
      n = Math.max(n, edgePresence(self.vc, other.vc, { x: 0, y: -1 }));
    }
    const iso = 1 - Math.max(e, w, s, n);
    let grow = self.scale;
    if (self.role === "stay") {
      grow = 1 + 0.2 * pull * iso;
    } else if (self.role === "birth") {
      grow = (1 - saturate(t)) * 0.68 + saturate(t) * (1 + 0.2 * pull * iso);
    }
    const half = 0.5 * grow;
    blobs.push({
      ...self,
      half,
      rad: Math.min(goo * half, half),
    });
  }
  return blobs;
}

function presenceRadii(self: Blob, blobs: readonly Blob[], radius: number): [number, number, number, number] {
  let e = 0;
  let w = 0;
  let s = 0;
  let n = 0;
  for (const other of blobs) {
    if (other === self) continue;
    e = Math.max(e, edgePresence(self.vc, other.vc, { x: 1, y: 0 }));
    w = Math.max(w, edgePresence(self.vc, other.vc, { x: -1, y: 0 }));
    s = Math.max(s, edgePresence(self.vc, other.vc, { x: 0, y: 1 }));
    n = Math.max(n, edgePresence(self.vc, other.vc, { x: 0, y: -1 }));
  }
  return [
    (1 - e) * (1 - s) * radius,
    (1 - e) * (1 - n) * radius,
    (1 - w) * (1 - s) * radius,
    (1 - w) * (1 - n) * radius,
  ];
}

function cellDs(x: number, y: number, blob: Blob, radii: readonly [number, number, number, number]): number {
  return sdRoundBox4(x - (blob.vc.x + 0.5), y - (blob.vc.y + 0.5), blob.half, blob.half, radii);
}

/**
 * Axis-locked Goo stretch in cell units.
 * Dist 0 = one tile. Dist 1 on-axis = the flush 2-cell bar.
 * Extra half-extent is ½ u²(3−2u) per axis — C1 in both centers, no rotation.
 */
export function stretchSd(
  x: number,
  y: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  half: number,
  rad: number,
): number {
  const ux = saturate(Math.abs(bx - ax), 0, 1);
  const uy = saturate(Math.abs(by - ay), 0, 1);
  const ex = ux * ux * (1.5 - ux);
  const ey = uy * uy * (1.5 - uy);
  return sdRoundBox(x - (ax + bx) * 0.5, y - (ay + by) * 0.5, half + ex, half + ey, rad);
}

function occupyAt(x: number, y: number, blobs: readonly Blob[]): number {
  let m = 0;
  for (const b of blobs) {
    if (b.role === "death" && b.scale < 0.02) continue;
    const d = Math.hypot(b.vc.x + 0.5 - x, b.vc.y + 0.5 - y);
    let w = occupyWeight(d);
    if (b.role === "death") w *= saturate(b.scale);
    m = Math.max(m, w);
  }
  return m;
}

function sitAt(x: number, y: number, blobs: readonly Blob[], skip: ReadonlySet<Blob>): number {
  let m = 0;
  for (const b of blobs) {
    if (skip.has(b)) continue;
    const d = Math.hypot(b.vc.x + 0.5 - x, b.vc.y + 0.5 - y);
    m = Math.max(m, sitWeight(d));
  }
  return m;
}

function morphNotch(x: number, y: number, blobs: readonly Blob[], radius: number): number {
  if (radius <= 1e-6) return 1e5;
  let best = 1e5;
  const ix0 = Math.floor(x - 0.15);
  const ix1 = Math.ceil(x + 0.15);
  const iy0 = Math.floor(y - 0.15);
  const iy1 = Math.ceil(y + 0.15);
  for (let iy = iy0; iy <= iy1; iy++) {
    for (let ix = ix0; ix <= ix1; ix++) {
      const A = occupyAt(ix - 0.5, iy - 0.5, blobs);
      const B = occupyAt(ix + 0.5, iy - 0.5, blobs);
      const C = occupyAt(ix - 0.5, iy + 0.5, blobs);
      const D = occupyAt(ix + 0.5, iy + 0.5, blobs);
      const n = A + B + C + D;
      const amt = saturate(1 - Math.abs(n - 3));
      if (amt < 0.02) continue;
      let px = x - ix;
      let py = y - iy;
      if (A <= B && A <= C && A <= D) {
        px = -px;
        py = -py;
      } else if (B <= C && B <= D) {
        py = -py;
      } else if (C <= D) {
        px = -px;
      }
      if (px < -1e-4 || py < -1e-4) continue;
      best = Math.min(best, Math.hypot(Math.max(px, 0), Math.max(py, 0)) - radius * amt);
    }
  }
  return best;
}

/**
 * Mid-generation field. Stay-only matches liveField.
 * Births and deaths are the same water — moving Goo bodies, stretch
 * necks while they overlap, Pull only on visual gaps.
 */
export function morphField(
  x: number,
  y: number,
  cells: readonly MorphCell[],
  t: number,
  pull: number,
  goo01: number,
): number {
  const stayOnly = cells.every((c) => c.role === "stay");
  if (stayOnly) {
    return liveField(
      x,
      y,
      cells.map((c) => [c.x, c.y] as const),
      pull,
      goo01,
    );
  }

  const goo = saturate(goo01);
  const blobs = buildBlobs(cells, t, pull, goo);
  if (blobs.length === 0) return 1e5;

  const k = pullKCells(pull);
  const ds: number[] = [];
  let union = 1e5;
  for (const b of blobs) {
    const radii = presenceRadii(b, blobs, b.rad);
    const d = cellDs(x, y, b, radii);
    ds.push(d);
    union = Math.min(union, d);
  }

  let field = Math.min(union, morphNotch(x, y, blobs, goo * 0.5));

  for (let i = 0; i < blobs.length; i++) {
    for (let j = i + 1; j < blobs.length; j++) {
      const a = blobs[i];
      const b = blobs[j];
      const man = Math.abs(a.home.x - b.home.x) + Math.abs(a.home.y - b.home.y);
      const dist = Math.hypot(a.vc.x - b.vc.x, a.vc.y - b.vc.y);
      if (man < 2 && dist < 1) {
        const half = Math.max(a.half, b.half);
        const rad = Math.min(Math.max(a.rad, b.rad), half);
        const d = stretchSd(
          x,
          y,
          a.vc.x + 0.5,
          a.vc.y + 0.5,
          b.vc.x + 0.5,
          b.vc.y + 0.5,
          half,
          rad,
        );
        field = Math.min(field, d);
      }
      if (k <= 0 || !pairShouldSmin(man, dist)) continue;
      if (ds[i] < -0.05 || ds[j] < -0.05) continue;
      let pairK = k;
      if (man === 2 && (a.home.x === b.home.x || a.home.y === b.home.y)) {
        const mx = (a.vc.x + b.vc.x) * 0.5 + 0.5;
        const my = (a.vc.y + b.vc.y) * 0.5 + 0.5;
        pairK = k * (1 - sitAt(mx, my, blobs, new Set([a, b])));
      } else if (man >= 2) {
        pairK = k * smoothstep(DIAG_SMIN_IN, DIAG_SMIN_OUT, dist);
      }
      if (pairK <= 1e-4) continue;
      const ga = glueCellSd(x, y, a.vc.x, a.vc.y, pull, goo);
      const gb = glueCellSd(x, y, b.vc.x, b.vc.y, pull, goo);
      field = Math.min(field, smin(ga, gb, pairK));
    }
  }

  return field;
}

/** Ease-in-out shared by every rest-to-rest morph. */
export function easeSmooth(t: number): number {
  return liquidEase(t);
}

/** Peaks at 1 with the capillary dump, 0 at both rests. */
export function midWeight(t: number): number {
  return liquidFluxNorm(t);
}

/**
 * Band for SDF mix, in cell units. Far vacuum (+1e5) would pop a dissolve
 * on the first frame; clamping keeps the 0-set and makes mass recede.
 */
export const MORPH_BAND = 0.85;

/** Finite-diff step for mid-step curvature, in cells. */
export const CURVE_H = 0.14;

/**
 * How hard mid-step surface tension rounds diamonds / teardrop tips.
 * 0 at t=0 and t=1 so the locked rest look does not move.
 */
export const CURVE_AMP = 0.024;

export function bandClamp(d: number, b = MORPH_BAND): number {
  return Math.min(b, Math.max(-b, d));
}

/**
 * Rest-to-rest SDF morph. t=0 is liveField(prev), t=1 is liveField(next).
 * The 0-isocontour interpolates — one droplet reshaping, no lattice steps.
 */
export function lerpField(
  x: number,
  y: number,
  prev: ReadonlyArray<readonly [number, number]>,
  next: ReadonlyArray<readonly [number, number]>,
  t: number,
  pull: number,
  goo01: number,
): number {
  const e = easeSmooth(t);
  const a = liveField(x, y, prev, pull, goo01);
  const b = liveField(x, y, next, pull, goo01);
  return a + (b - a) * e;
}

/** Same mix after ±band clamp — isolated deaths dissolve instead of popping. */
export function bandLerpField(
  x: number,
  y: number,
  prev: ReadonlyArray<readonly [number, number]>,
  next: ReadonlyArray<readonly [number, number]>,
  t: number,
  pull: number,
  goo01: number,
  band = MORPH_BAND,
): number {
  const e = easeSmooth(t);
  const a = bandClamp(liveField(x, y, prev, pull, goo01), band);
  const b = bandClamp(liveField(x, y, next, pull, goo01), band);
  return a + (b - a) * e;
}

/**
 * Weighted log-sum-exp of the two rest fields.
 * Small k → union (ghost plus). Large k → lerp (diamonds).
 */
export function softLerpField(
  x: number,
  y: number,
  prev: ReadonlyArray<readonly [number, number]>,
  next: ReadonlyArray<readonly [number, number]>,
  t: number,
  pull: number,
  goo01: number,
  k: number,
  band = MORPH_BAND,
): number {
  const e = easeSmooth(t);
  const a = bandClamp(liveField(x, y, prev, pull, goo01), band);
  const b = bandClamp(liveField(x, y, next, pull, goo01), band);
  const kk = Math.max(k, 1e-4);
  const ma = -a / kk + Math.log(Math.max(1 - e, 1e-12));
  const mb = -b / kk + Math.log(Math.max(e, 1e-12));
  const m = Math.max(ma, mb);
  return -kk * (m + Math.log(Math.exp(ma - m) + Math.exp(mb - m)));
}

/**
 * Band-lerp plus mid-step mean-curvature. Convex tips recede, necks fill —
 * the diamond / teardrop of a raw SDF mix relaxes toward a drop.
 */
export function curveLerpField(
  x: number,
  y: number,
  prev: ReadonlyArray<readonly [number, number]>,
  next: ReadonlyArray<readonly [number, number]>,
  t: number,
  pull: number,
  goo01: number,
  amp = CURVE_AMP,
  h = CURVE_H,
  band = MORPH_BAND,
): number {
  const sample = (px: number, py: number) =>
    bandLerpField(px, py, prev, next, t, pull, goo01, band);
  const d = sample(x, y);
  const w = midWeight(t);
  if (w < 1e-4 || amp <= 0) return d;
  const lap =
    (sample(x - h, y) + sample(x + h, y) + sample(x, y - h) + sample(x, y + h) - 4 * d) /
    (h * h);
  return d + amp * w * lap;
}

/**
 * Soft-occupancy morph. Each rest field is a linear ramp of width R around
 * its surface; the ramps mix; 0.5 is the water line.
 * R = 0 at both rests → exact liveField. A still life (d0 === d1) is
 * the rest field at every t, so a block does not breathe.
 */
export const SOFT_R = 0.4;

export function softOccField(
  x: number,
  y: number,
  prev: ReadonlyArray<readonly [number, number]>,
  next: ReadonlyArray<readonly [number, number]>,
  t: number,
  pull: number,
  goo01: number,
  r = SOFT_R,
  band = MORPH_BAND,
): number {
  const e = easeSmooth(t);
  const a = bandClamp(liveField(x, y, prev, pull, goo01), band);
  const b = bandClamp(liveField(x, y, next, pull, goo01), band);
  const R = Math.max(0, r) * midWeight(t);
  if (R < 1e-4) return a + (b - a) * e;
  const s0 = saturate(0.5 - 0.5 * a / R);
  const s1 = saturate(0.5 - 0.5 * b / R);
  const s = s0 * (1 - e) + s1 * e;
  return (0.5 - s) * 2 * R;
}

/**
 * Mid-step blur of mixed occupancy, in cell units. 0 at both rests.
 * Cells live in both frames are never lost, so a block does not
 * breathe and a parent tile does not shrink before a birth.
 */
export const SKEL_SIGMA = 0.42;

/** Occupancy-blur kernel. Locked for rest and motion so settled glue
 *  does not breathe when a generation or a paint morph is in flight.
 *  Births and deaths still appear through the occupancy mix.
 */
export const SKEL_REST_FLUX = 1 / 9;

export function skelFlux(_t?: number, identical = false): number {
  void identical;
  return SKEL_REST_FLUX;
}

/**
 * Generation water: locked rest at the ends, surface tension in between.
 * inside = stay-cell rest OR (blur(mix(i0,i1)) >= 0.5)
 * Hold is cells live in both frames, not the pixel overlap of two
 * expanded cores — a one-cell slide shares an edge, not a tile.
 */
export function waterField(
  x: number,
  y: number,
  prev: ReadonlyArray<readonly [number, number]>,
  next: ReadonlyArray<readonly [number, number]>,
  t: number,
  pull: number,
  goo01: number,
): number {
  const e = easeSmooth(t);
  const stay = stayCells(prev, next);
  const hold = liveCore(x, y, stay, pull, goo01);
  if (hold < 0) return hold;
  const identical = cellsEqual(prev, next);
  const sigma = SKEL_SIGMA * skelFlux(t, identical);
  let acc = 0;
  let w = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const wt = Math.exp(-0.5 * (dx * dx + dy * dy));
      const a = liveField(x + dx * sigma, y + dy * sigma, prev, pull, goo01) < 0 ? 1 : 0;
      const b = liveField(x + dx * sigma, y + dy * sigma, next, pull, goo01) < 0 ? 1 : 0;
      acc += (a * (1 - e) + b * e) * wt;
      w += wt;
    }
  }
  const blurred = acc / w;
  return blurred >= 0.5 ? -0.25 : 0.25;
}

function stayCells(
  prev: ReadonlyArray<readonly [number, number]>,
  next: ReadonlyArray<readonly [number, number]>,
): Array<[number, number]> {
  const stay: Array<[number, number]> = [];
  for (const [x, y] of prev) {
    for (const [nx, ny] of next) {
      if (nx === x && ny === y) {
        stay.push([x, y]);
        break;
      }
    }
  }
  return stay;
}

function cellsEqual(
  a: ReadonlyArray<readonly [number, number]>,
  b: ReadonlyArray<readonly [number, number]>,
): boolean {
  if (a.length !== b.length) return false;
  for (const [x, y] of a) {
    let found = false;
    for (const [bx, by] of b) {
      if (bx === x && by === y) {
        found = true;
        break;
      }
    }
    if (!found) return false;
  }
  return true;
}

/** Rest field of the homes — used to lock t=1 against today's look. */
export function settledField(
  x: number,
  y: number,
  cells: ReadonlyArray<readonly [number, number]>,
  pull: number,
  goo01: number,
): number {
  return liveField(x, y, cells, pull, goo01);
}

/** Fillet of the landed polyomino — same as rest. */
export function settledNotch(
  x: number,
  y: number,
  cells: ReadonlyArray<readonly [number, number]>,
  goo01: number,
): number {
  return innerNotchFillet(x, y, cells, saturate(goo01) * 0.5);
}
