"use client";

import { useCallback, useRef } from "react";

type HairlineSliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display: string;
  onChange: (value: number) => void;
};

export function HairlineSlider({
  label,
  value,
  min,
  max,
  step = 1,
  display,
  onChange,
}: HairlineSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const setFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const t = rect.width <= 0 ? 0 : (clientX - rect.left) / rect.width;
      const raw = min + t * (max - min);
      const snapped = Math.round(raw / step) * step;
      onChange(Math.min(max, Math.max(min, snapped)));
    },
    [max, min, onChange, step],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setFromClientX(event.clientX);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    setFromClientX(event.clientX);
  };

  const span = max - min || 1;
  const pct = ((value - min) / span) * 100;

  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between text-[10px] uppercase tracking-[0.22em]">
        <span>{label}</span>
        <span className="tabular-nums">{display}</span>
      </span>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        className="relative flex h-7 cursor-ew-resize items-center touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => {
          try {
            event.currentTarget.releasePointerCapture(event.pointerId);
          } catch {
            /* already released */
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            onChange(Math.max(min, value - step));
          }
          if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            onChange(Math.min(max, value + step));
          }
        }}
      >
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/80" />
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 bg-white"
          style={{ left: `${pct}%` }}
        />
      </div>
    </label>
  );
}
