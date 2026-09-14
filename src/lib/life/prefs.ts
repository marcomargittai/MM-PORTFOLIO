export const GOO_STORAGE_KEY = "mm-life-goo";
export const GOO_KEPT_KEY = "mm-life-goo-kept";

export const GOO_MIN = 0;
export const GOO_MAX = 180;
export const DEFAULT_GOO = 22;

/** Slider units → renderer intensity. 100 is a full melt; the slider goes past it. */
export const GOO_UNIT = 100;

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
