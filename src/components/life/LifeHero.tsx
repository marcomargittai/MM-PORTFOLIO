"use client";

import { Instrument_Sans, Instrument_Serif } from "next/font/google";
import { useCallback, useEffect, useRef, useState } from "react";
import { LifeEngine } from "@/lib/life/engine";
import { LifeLoop } from "@/lib/life/loop";
import { findPattern, type LifePattern } from "@/lib/life/patterns";
import { patternCells } from "@/lib/life/patterns";
import { GOO_UNIT, LOCKED_GOO, LOCKED_PULL, PULL_UNIT, readWiggle, writeWiggle } from "@/lib/life/prefs";
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
const RENDERER_REV = 62;
const CAM_MIN = 0.35;
const CAM_MAX = 8;

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

function query(): URLSearchParams | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search);
}

function bootPattern(): LifePattern | undefined {
  const q = query();
  return findPattern(q?.get("p") || DEFAULT_PATTERN) ?? findPattern(DEFAULT_PATTERN);
}

function bootPlaying(): boolean {
  const raw = query()?.get("play");
  return raw !== "0" && raw !== "off";
}

function bootBlend(): number | null {
  const raw = query()?.get("blend");
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n < 0 ? 0 : n > 1 ? 1 : n;
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
  const paintHudAtRef = useRef(0);
  const overlayRef = useRef(false);
  const playingRef = useRef(true);
  const camRef = useRef({ x: 0, y: 0, scale: 1 });

  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [population, setPopulation] = useState(1);
  const [generation, setGeneration] = useState(0);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [wiggle, setWiggle] = useState(() => readWiggle());

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
      loop.align();
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
    const host = hostRef.current;
    if (!host) return;

    const onWheel = (event: WheelEvent) => {
      if (overlayRef.current) return;
      if (!host.contains(event.target as Node)) return;
      event.preventDefault();
      const cam = camRef.current;
      const line = event.deltaMode === 1;
      const page = event.deltaMode === 2;
      const dy = event.deltaY * (line ? 16 : page ? host.clientHeight : 1);
      const dx = event.deltaX * (line ? 16 : page ? host.clientWidth : 1);
      // Trackpad pinch arrives as ctrl/meta + wheel (Figma, Chrome, Safari).
      if (event.ctrlKey || event.metaKey) {
        const rect = host.getBoundingClientRect();
        const px = event.clientX - rect.left;
        const py = event.clientY - rect.top;
        const next = Math.min(
          CAM_MAX,
          Math.max(CAM_MIN, cam.scale * Math.exp(-(line ? event.deltaY * 0.05 : dy * 0.002))),
        );
        if (next === cam.scale) return;
        const k = next / cam.scale;
        cam.x = px - (px - cam.x) * k;
        cam.y = py - (py - cam.y) * k;
        cam.scale = next;
      } else {
        cam.x -= dx;
        cam.y -= dy;
      }
      rendererRef.current?.setCamera(cam.x, cam.y, cam.scale);
      loopRef.current?.nudge();
    };

    const blockGesture = (event: Event) => event.preventDefault();
    const opts: AddEventListenerOptions = { passive: false, capture: true };
    host.addEventListener("wheel", onWheel, opts);
    host.addEventListener("gesturestart", blockGesture, opts);
    host.addEventListener("gesturechange", blockGesture, opts);
    host.addEventListener("gestureend", blockGesture, opts);
    return () => {
      host.removeEventListener("wheel", onWheel, opts);
      host.removeEventListener("gesturestart", blockGesture, opts);
      host.removeEventListener("gesturechange", blockGesture, opts);
      host.removeEventListener("gestureend", blockGesture, opts);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const { cols, rows } = gridFor(
      Math.max(1, canvas.clientWidth || host.clientWidth || window.innerWidth),
      Math.max(1, canvas.clientHeight || host.clientHeight || window.innerHeight),
    );

    const shouldPlay = bootPlaying();

    const engine = new LifeEngine(cols, rows);
    const renderer = new LifeBlobRenderer();
    renderer.init(canvas, {
      wrap: true,
      goo: LOCKED_GOO / GOO_UNIT,
      pull: LOCKED_PULL / PULL_UNIT,
    });
    renderer.setWiggleEnabled(readWiggle());
    renderer.setCamera(camRef.current.x, camRef.current.y, camRef.current.scale);

    let hudAt = 0;
    const loop = new LifeLoop({
      engine,
      speed: DEFAULT_SPEED,
      onFrame: ({ steps, blend, morphDuration, previous, current }) => {
        renderer.setMorphDuration(morphDuration);
        renderer.render(previous, current, engine.width, engine.height, blend);
        if (steps > 0) {
          const now = performance.now();
          if (now - hudAt > 140) {
            hudAt = now;
            setGeneration(engine.generation);
            setPopulation(engine.liveCount());
          }
        }
      },
    });

    engineRef.current = engine;
    rendererRef.current = renderer;
    loopRef.current = loop;

    const pattern = bootPattern();
    if (pattern) stampCentered(engine, pattern);
    const forcedBlend = bootBlend();
    if (forcedBlend != null) {
      loop.align();
      loop.previous.set(engine.cells);
      engine.step();
      loop.blend = forcedBlend;
    } else {
      loop.align();
    }

    loop.start();
    if (forcedBlend != null) {
      playingRef.current = false;
      setPlaying(false);
    } else if (shouldPlay) {
      loop.play();
      playingRef.current = true;
      setPlaying(true);
    } else {
      loop.pause();
      playingRef.current = false;
      setPlaying(false);
    }
    setPopulation(engine.liveCount());
    setGeneration(0);

    const fit = () => {
      const w = canvas.clientWidth || host.clientWidth;
      const h = canvas.clientHeight || host.clientHeight;
      const next = gridFor(w, h);
      if (engine.width !== next.cols || engine.height !== next.rows) {
        engine.resize(next.cols, next.rows);
        loop.align();
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
  }, [RENDERER_REV]);

  const hit = (clientX: number, clientY: number) => {
    const host = hostRef.current;
    if (!host) return null;
    const rect = host.getBoundingClientRect();
    return rendererRef.current?.cellAtCss(clientX - rect.left, clientY - rect.top) ?? null;
  };

  const pauseForPaint = () => {
    const loop = loopRef.current;
    if (!loop) return;
    loop.beginStroke();
    playingRef.current = false;
    setPlaying(false);
  };

  const feedPointer = (clientX: number, clientY: number) => {
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    rendererRef.current?.setPointer(clientX - rect.left, clientY - rect.top);
    loopRef.current?.nudge();
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button === 1) return;
    const engine = engineRef.current;
    if (!engine) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    feedPointer(event.clientX, event.clientY);
    pauseForPaint();
    const cell = hit(event.clientX, event.clientY);
    if (!cell) return;
    const erase = event.button === 2 || event.shiftKey || event.altKey || engine.get(cell.x, cell.y) === 1;
    paintAliveRef.current = erase ? 0 : 1;
    paintingRef.current = true;
    lastCellRef.current = cell;
    loopRef.current?.stamp(cell.x, cell.y, paintAliveRef.current);
    paintHudAtRef.current = performance.now();
    syncHud();
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    feedPointer(event.clientX, event.clientY);
    if (!paintingRef.current) return;
    const engine = engineRef.current;
    if (!engine) return;
    const cell = hit(event.clientX, event.clientY);
    if (!cell) return;
    const last = lastCellRef.current;
    if (last && last.x === cell.x && last.y === cell.y) return;
    if (last) loopRef.current?.stampLine(last.x, last.y, cell.x, cell.y, paintAliveRef.current);
    else loopRef.current?.stamp(cell.x, cell.y, paintAliveRef.current);
    lastCellRef.current = cell;
    const now = performance.now();
    if (now - paintHudAtRef.current > 80) {
      paintHudAtRef.current = now;
      syncHud();
    }
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
    loopRef.current?.align();
    playingRef.current = false;
    setPlaying(false);
    syncHud();
  }, [syncHud]);

  const chance = useCallback(() => {
    engineRef.current?.randomize(0.11);
    loopRef.current?.align();
    syncHud();
  }, [syncHud]);

  const changeSpeed = useCallback((next: number) => {
    const clamped = Math.min(SPEED_MAX, Math.max(SPEED_MIN, next));
    loopRef.current?.setSpeed(clamped);
    setSpeed(clamped);
  }, []);

  const toggleWiggle = useCallback(() => {
    setWiggle((on) => {
      const next = writeWiggle(!on);
      rendererRef.current?.setWiggleEnabled(next);
      return next;
    });
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
      className={`${sans.className} relative h-dvh w-full overflow-hidden bg-black text-white [overscroll-behavior:none]`}
    >
      <canvas
        key={RENDERER_REV}
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 block h-full w-full outline-none"
        aria-hidden
      />

      <div
        className="absolute inset-0 z-10 cursor-crosshair touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPaint}
        onPointerCancel={endPaint}
        onPointerLeave={() => {
          rendererRef.current?.clearPointer();
          loopRef.current?.nudge();
        }}
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
        wiggle={wiggle}
        onTogglePlay={togglePlay}
        onStep={step}
        onClear={clear}
        onChance={chance}
        onSpeed={changeSpeed}
        onToggleWiggle={toggleWiggle}
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
