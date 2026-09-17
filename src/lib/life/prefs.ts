export const GOO_STORAGE_KEY = "mm-life-goo";
export const GOO_KEPT_KEY = "mm-life-goo-kept";
export const PULL_STORAGE_KEY = "mm-life-pull";
export const WIGGLE_STORAGE_KEY = "mm-life-wiggle";

export const GOO_MIN = 0;
export const GOO_MAX = 300;
/** Locked look — iterate on this setting only. */
export const LOCKED_GOO = 140;
export const DEFAULT_GOO = LOCKED_GOO;
/** Nearly-disks, the Yuga Labs cell. */
export const YUGA_GOO = 220;

export const PULL_MIN = 0;
export const PULL_MAX = 200;
/** Locked look — iterate on this setting only. */
export const LOCKED_PULL = 43;
export const DEFAULT_PULL = LOCKED_PULL;
/** Neighbor weld on yuga.com — slider 100. */
export const YUGA_PULL = 100;

/** Slider units → renderer intensity. 100 is a full melt; the slider goes past it. */
export const GOO_UNIT = 100;
export const PULL_UNIT = 100;

export function clampGoo(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_GOO;
  return Math.min(GOO_MAX, Math.max(GOO_MIN, Math.round(value)));
}

export function readGoo(): number {
  if (typeof window === "undefined") return DEFAULT_GOO;
  const kept = window.localStorage.getItem(GOO_KEPT_KEY);
  if (kept != null) return clampGoo(Number(kept));
  const live = window.localStorage.getItem(GOO_STORAGE_KEY);
  if (live != null) return clampGoo(Number(live));
  return DEFAULT_GOO;
}

export function writeGoo(value: number): number {
  const next = clampGoo(value);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(GOO_STORAGE_KEY, String(next));
  }
  return next;
}

export function keepGoo(value: number): number {
  const next = clampGoo(value);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(GOO_STORAGE_KEY, String(next));
    window.localStorage.setItem(GOO_KEPT_KEY, String(next));
  }
  return next;
}

export function readKeptGoo(): number | null {
  if (typeof window === "undefined") return null;
  const kept = window.localStorage.getItem(GOO_KEPT_KEY);
  if (kept == null) return null;
  return clampGoo(Number(kept));
}

export function clampPull(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PULL;
  return Math.min(PULL_MAX, Math.max(PULL_MIN, Math.round(value)));
}

export function readPull(): number {
  if (typeof window === "undefined") return DEFAULT_PULL;
  const live = window.localStorage.getItem(PULL_STORAGE_KEY);
  if (live != null) return clampPull(Number(live));
  return DEFAULT_PULL;
}

export function writePull(value: number): number {
  const next = clampPull(value);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(PULL_STORAGE_KEY, String(next));
  }
  return next;
}

/** Growth jiggle — off until asked, so the locked morph stays bit-identical. */
export function readWiggle(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(WIGGLE_STORAGE_KEY);
  if (raw == null) return false;
  return raw === "1" || raw === "on" || raw === "true";
}

export function writeWiggle(on: boolean): boolean {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(WIGGLE_STORAGE_KEY, on ? "1" : "0");
  }
  return on;
}
