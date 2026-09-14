"use client";

import { useEffect, useRef } from "react";
import type { LifePattern } from "@/lib/life/patterns";
import { patternCells } from "@/lib/life/patterns";

type PatternThumbProps = {
  pattern: LifePattern;
  active?: boolean;
};

export function PatternThumb({ pattern, active }: PatternThumbProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const { width, height, cells } = patternCells(pattern);
    const pad = 2;
    const cols = Math.max(width + pad * 2, 8);
    const rows = Math.max(height + pad * 2, 8);
    const css = 88;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(css * dpr);
    canvas.height = Math.round(css * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, css, css);

    const cell = Math.min(css / cols, css / rows);
    const ox = (css - cols * cell) / 2;
    const oy = (css - rows * cell) / 2;
    const r = cell * 0.48;
    ctx.fillStyle = "#fff";
    for (const [x, y] of cells) {
      const cx = ox + (x + pad + 0.5) * cell;
      const cy = oy + (y + pad + 0.5) * cell;
      ctx.beginPath();
      ctx.roundRect(cx - r, cy - r, r * 2, r * 2, r);
      ctx.fill();
    }
  }, [pattern]);

  return (
    <canvas
      ref={ref}
      className={`h-[72px] w-[72px] shrink-0 bg-black transition-opacity duration-300 ${
        active ? "opacity-100" : "opacity-40"
      }`}
      aria-hidden
    />
  );
}
