"use client";

import { Instrument_Sans, Instrument_Serif } from "next/font/google";
import { useCallback, useEffect, useRef, useState } from "react";
import { LifeEngine } from "@/lib/life/engine";
import { LifeLoop } from "@/lib/life/loop";
import { findPattern, type LifePattern } from "@/lib/life/patterns";
import { patternCells } from "@/lib/life/patterns";
import { LifeBlobRenderer } from "@/lib/life/renderer";
import { InspirationsOverlay } from "./InspirationsOverlay";
import { LifeChrome } from "./LifeChrome";

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  display: "swap",
});

const sans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const SPEED_MIN = 1;
const SPEED_MAX = 60;
const DEFAULT_SPEED = 12;
const DEFAULT_PATTERN = "gosper-glider-gun";

function cellPx(): number {
  if (typeof window === "undefined") return 22;
  const w = window.innerWidth;
  if (w < 700) return 16;
  if (w < 1080) return 18;
  return 22;
}

function gridFor(width: number, height: number) {
  const size = cellPx();
  return {
    cols: Math.max(36, Math.round(width / size)),
    rows: Math.max(24, Math.round(height / size)),
  };
}

function isGun(pattern: LifePattern) {
  return pattern.category === "gun" || /gun/i.test(pattern.id);
}

function offsetFor(width: number, height: number, cols: number, rows: number, gun: boolean) {
  if (gun) {
    return {
      x: Math.max(2, Math.floor(cols * 0.08)),
      y: Math.max(2, Math.floor((rows - height) / 2)),
    };
  }
  return {
    x: Math.floor((cols - width) / 2),
    y: Math.floor((rows - height) / 2),
  };
}

function stampCentered(engine: LifeEngine, pattern: LifePattern) {
  const decoded = patternCells(pattern);
  const origin = offsetFor(decoded.width, decoded.height, engine.width, engine.height, isGun(pattern));
  engine.clear();
  engine.stampPattern(decoded.cells, origin.x, origin.y);
}

export default function LifeHero() {
  const hostRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<LifeEngine | null>(null);
  const loopRef = useRef<LifeLoop | null>(null);
  const rendererRef = useRef<LifeBlobRenderer | null>(null);
  const paintingRef = useRef(false);
  const paintAliveRef = useRef<0 | 1>(1);
  const lastCellRef = useRef<{ x: number; y: number } | null>(null);
  const overlayRef = useRef(false);
  const playingRef = useRef(true);

  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [population, setPopulation] = useState(1);
  const [generation, setGeneration] = useState(0);
  const [overlayOpen, setOverlayOpen] = useState(false);

  const syncHud = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    setPopulation(engine.liveCount());
    setGeneration(engine.generation);
  }, []);

  const applyPattern = useCallback(
    (pattern: LifePattern, autoplay = true) => {
      const engine = engineRef.current;
      const loop = loopRef.current;
      if (!engine || !loop) return;
      stampCentered(engine, pattern);
      if (autoplay) {
        loop.play();
        playingRef.current = true;
        setPlaying(true);
      }
      syncHud();
    },
    [syncHud],
  );

  useEffect(() => {
    overlayRef.current = overlayOpen;
  }, [overlayOpen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const { cols, rows } = gridFor(
      Math.max(1, canvas.clientWidth || host.clientWidth || window.innerWidth),
      Math.max(1, canvas.clientHeight || host.clientHeight || window.innerHeight),
    );

    const engine = new LifeEngine(cols, rows);
    const renderer = new LifeBlobRenderer();
    renderer.init(canvas, { wrap: true });

    const loop = new LifeLoop({
      engine,
      speed: DEFAULT_SPEED,
      onFrame: ({ steps }) => {
        renderer.render(engine.cells, engine.width, engine.height);
        if (steps > 0) {
          setGeneration(engine.generation);
          if (engine.generation % 4 === 0) {
            setPopulation(engine.liveCount());
          }
        }
      },
    });

    engineRef.current = engine;
    rendererRef.current = renderer;
    loopRef.current = loop;

    const pattern = findPattern(DEFAULT_PATTERN);
    if (pattern) stampCentered(engine, pattern);

    loop.start();
    loop.play();
    playingRef.current = true;
    setPlaying(true);
    setPopulation(engine.liveCount());
    setGeneration(0);

    const fit = () => {
      const w = canvas.clientWidth || host.clientWidth;
      const h = canvas.clientHeight || host.clientHeight;
      const next = gridFor(w, h);
      if (engine.width !== next.cols || engine.height !== next.rows) {
        engine.resize(next.cols, next.rows);
      }
      renderer.resize();
    };

    const ro = new ResizeObserver(fit);
    ro.observe(host);
    fit();

    return () => {
      ro.disconnect();
      loop.stop();
      renderer.dispose();
      engineRef.current = null;
      loopRef.current = null;
      rendererRef.current = null;
    };
  }, []);

  const hit = (clientX: number, clientY: number) => {
    const host = hostRef.current;
    const engine = engineRef.current;
    if (!host || !engine) return null;
    const rect = host.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (rect.width <= 0 || rect.height <= 0) return null;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
    const col = Math.min(engine.width - 1, Math.max(0, Math.floor((x / rect.width) * engine.width)));
    const row = Math.min(engine.height - 1, Math.max(0, Math.floor((y / rect.height) * engine.height)));
    return { x: col, y: row };
  };

  const pauseForPaint = () => {
    const loop = loopRef.current;
    if (!loop) return;
    loop.pause();
    playingRef.current = false;
    setPlaying(false);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button === 1) return;
    const engine = engineRef.current;
    if (!engine) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pauseForPaint();
    const cell = hit(event.clientX, event.clientY);
    if (!cell) return;
    const erase = event.button === 2 || event.shiftKey || event.altKey;
    paintAliveRef.current = erase ? 0 : 1;
    paintingRef.current = true;
    lastCellRef.current = cell;
    engine.set(cell.x, cell.y, paintAliveRef.current);
    syncHud();
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!paintingRef.current) return;
    const engine = engineRef.current;
    if (!engine) return;
    const cell = hit(event.clientX, event.clientY);
    if (!cell) return;
    const last = lastCellRef.current;
    if (last && last.x === cell.x && last.y === cell.y) return;
    if (last) engine.paintLine(last.x, last.y, cell.x, cell.y, paintAliveRef.current);
    else engine.set(cell.x, cell.y, paintAliveRef.current);
    lastCellRef.current = cell;
    syncHud();
  };

  const endPaint = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!paintingRef.current) return;
    paintingRef.current = false;
    lastCellRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  };

  const togglePlay = useCallback(() => {
    const loop = loopRef.current;
    if (!loop) return;
    loop.togglePlaying();
    playingRef.current = loop.playing;
    setPlaying(loop.playing);
  }, []);

  const step = useCallback(() => {
    const loop = loopRef.current;
    if (!loop) return;
    loop.pause();
    playingRef.current = false;
    setPlaying(false);
    loop.stepOnce();
    syncHud();
  }, [syncHud]);

  const clear = useCallback(() => {
    engineRef.current?.clear();
    loopRef.current?.pause();
    playingRef.current = false;
    setPlaying(false);
    syncHud();
  }, [syncHud]);

  const chance = useCallback(() => {
    engineRef.current?.randomize(0.11);
    syncHud();
  }, [syncHud]);

  const changeSpeed = useCallback((next: number) => {
    const clamped = Math.min(SPEED_MAX, Math.max(SPEED_MIN, next));
    loopRef.current?.setSpeed(clamped);
    setSpeed(clamped);
  }, []);

  const pickPattern = useCallback(
    (pattern: LifePattern) => {
      applyPattern(pattern, true);
      setOverlayOpen(false);
    },
    [applyPattern],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (event.key === "Escape") {
        if (overlayRef.current) {
          event.preventDefault();
          setOverlayOpen(false);
        }
        return;
      }
      if (event.key === "i" || event.key === "I") {
        event.preventDefault();
        setOverlayOpen((open) => !open);
        return;
      }
      if (overlayRef.current) return;
      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        togglePlay();
        return;
      }
      if (event.key === "c" || event.key === "C") {
        event.preventDefault();
        clear();
        return;
      }
      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        chance();
        return;
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        changeSpeed(speed + 1);
        return;
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        changeSpeed(speed - 1);
        return;
      }
      if (
        event.key === "ArrowRight" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowDown"
      ) {
        event.preventDefault();
        step();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chance, changeSpeed, clear, speed, step, togglePlay]);

  useEffect(() => {
    const loop = loopRef.current;
    if (!loop) return;
    if (overlayOpen) loop.pause();
    else if (playingRef.current) loop.play();
  }, [overlayOpen]);

  const status = population === 0 ? "Barren." : playing && !overlayOpen ? "Live." : "Still.";

  return (
    <section
      ref={hostRef}
      aria-label="Conway's Game of Life"
      className={`${sans.className} relative h-dvh w-full overflow-hidden bg-black text-white`}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      />

      <div
        className="absolute inset-0 z-10 cursor-crosshair touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPaint}
        onPointerCancel={endPaint}
        onContextMenu={(event) => event.preventDefault()}
      />

      <LifeChrome
        serifClassName={serif.className}
        playing={playing && !overlayOpen}
        status={status}
        speed={speed}
        speedMin={SPEED_MIN}
        speedMax={SPEED_MAX}
        generation={generation}
        overlayOpen={overlayOpen}
        onTogglePlay={togglePlay}
        onStep={step}
        onClear={clear}
        onChance={chance}
        onSpeed={changeSpeed}
        onInspirations={() => setOverlayOpen((open) => !open)}
      />

      <InspirationsOverlay
        open={overlayOpen}
        serifClassName={serif.className}
        onClose={() => setOverlayOpen(false)}
        onSelect={pickPattern}
      />
    </section>
  );
}
