/** How a dying cell leaves: sucked into a survivor, or dissolved in place. */

const ORTHO: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const DIAG: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

export type CellPull = { dx: number; dy: number };

/** Average of matching ortho neighbors, else diagonals. */
export function sourcePull(
  match: (x: number, y: number) => boolean,
  x: number,
  y: number,
): CellPull | null {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const [dx, dy] of ORTHO) {
    if (match(x + dx, y + dy)) {
      sx += dx;
      sy += dy;
      n += 1;
    }
  }
  if (n > 0) return { dx: sx / n, dy: sy / n };
  for (const [dx, dy] of DIAG) {
    if (match(x + dx, y + dy)) {
      sx += dx;
      sy += dy;
      n += 1;
    }
  }
  if (n > 0) return { dx: sx / n, dy: sy / n };
  return null;
}

/**
 * Average of settled (was live, stays live) ortho neighbors, else diagonals.
 * Null means nobody survives beside this cell — it should dissolve.
 */
export function survivorPull(
  settledAt: (x: number, y: number) => boolean,
  x: number,
  y: number,
): CellPull | null {
  return sourcePull(settledAt, x, y);
}

/** Impulse after the capillary dump. Ring is wall-clock, not blend. */
export const WIGGLE_T_STAR = 0.25;
export const WIGGLE_AMP = 0.11;
export const WIGGLE_FREQ = 16;
export const WIGGLE_DECAY = 50;

/**
 * Beta(2,4) CDF — viscocapillary mix. Short neck, dump at t=1/4,
 * then a film that dies with zero snap (e''(1)=0). Not cubic.
 */
export function liquidEase(t: number): number {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return u * u * (10 + u * (-20 + u * (15 - 4 * u)));
}

/**
 * Normalized flux ê'. Peaks at 1 when mass dumps (t=1/4),
 * not at mid-morph when the mix is already mostly done.
 */
export function liquidFluxNorm(t: number): number {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  const s = 1 - u;
  return ((256 / 27) * u * s * s * s);
}

/** Generation mix — same liquid curve the shader uses. */
export function easeInOut(t: number): number {
  return liquidEase(t);
}

/**
 * Added-mass ring. Only when net population grows. Zero until the
 * dump, then a 16 Hz viscously damped pulse that is dead at rest.
 */
export function growthWiggle(t: number, growth: number, duration = 1 / 12): number {
  if (growth <= 0) return 0;
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  if (u <= WIGGLE_T_STAR || u >= 1 - 1e-6) return 0;
  const tau = (u - WIGGLE_T_STAR) * Math.max(duration, 1e-3);
  return WIGGLE_AMP * Math.exp(-WIGGLE_DECAY * tau) * Math.sin(2 * Math.PI * WIGGLE_FREQ * tau);
}

/** Smoothstep so the drop eases into the neighbor instead of skating linearly. */
export function dyingTravel(t: number): number {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return u * u * (3 - 2 * u);
}

/** Sucked cells stay fat until they arrive, then vanish into the neighbor. */
export function dyingSuckScale(t: number): number {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return 1 - 0.35 * u - 0.65 * u * u;
}

/** Isolated deaths keep most of their size and fade — they do not shrink as tiles. */
export function dyingDissolveScale(t: number): number {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return 1 - 0.18 * u;
}

export function dyingDissolveFade(t: number): number {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return 1 - u;
}

/** Born cells start on a survivor (1) and slide home (0). */
export function birthTravel(t: number): number {
  return 1 - dyingTravel(t);
}

/**
 * Offset from the born cell's home toward its parent.
 * pull is home → parent, so +offset starts on the parent and grows out.
 */
export function birthOffset(pull: CellPull, t: number): CellPull {
  const u = birthTravel(t);
  return { dx: pull.dx * u, dy: pull.dy * u };
}

/** Starts as a bulge on the parent, not a speck from nowhere. */
export function birthScale(t: number): number {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return 0.68 + 0.32 * u;
}
