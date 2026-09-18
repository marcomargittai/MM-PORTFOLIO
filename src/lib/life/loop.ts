import { wrapIndex, type LifeEngine } from "./engine";

export type PaintCell = { x: number; y: number; value: 0 | 1 };

export interface FrameInfo {
  dt: number;
  steps: number;
  playing: boolean;
  generation: number;
  blend: number;
  morphDuration: number;
  previous: Uint8Array;
  current: Uint8Array;
  dirty: PaintCell[];
  paintOverlay: boolean;
  rebuildField: boolean;
}

export interface LifeLoopOptions {
  engine: LifeEngine;
  speed?: number;
  maxStepsPerFrame?: number;
  maxDelta?: number;
  onFrame?: (info: FrameInfo) => void;
  /** Keep RAF alive for pointer wake / hover decay. */
  isBusy?: () => boolean;
}

const MIN_SPEED = 0.25;
const MANUAL_MORPH = 0.34;
/** Time to ease the rest of a generation after Pause. Long enough to read. */
export const SETTLE_DURATION = 0.42;
/** Time to grow or shrink a painted cell once the field is still. */
export const PAINT_MORPH = 0.36;
const MORPH_DT_CAP = 1 / 24;
const PLAY_DT_CAP = 1 / 30;

export class LifeLoop {
  readonly engine: LifeEngine;
  playing = false;
  speed: number;
  maxStepsPerFrame: number;
  maxDelta: number;
  blend = 1;
  previous: Uint8Array;
  onFrame: ((info: FrameInfo) => void) | undefined;
  isBusy: (() => boolean) | undefined;

  private rafId: number | null = null;
  private lastTime = 0;
  private running = false;
  private morphing = false;
  private settleRate = 0;
  private restStroke = false;
  private queuedStep = false;
  private idleFrames = 0;
  dirty: PaintCell[] = [];
  paintOverlay = false;
  rebuildField = false;

  constructor(options: LifeLoopOptions) {
    this.engine = options.engine;
    this.speed = options.speed ?? 12;
    this.maxStepsPerFrame = options.maxStepsPerFrame ?? 2;
    this.maxDelta = options.maxDelta ?? 0.25;
    this.onFrame = options.onFrame;
    this.isBusy = options.isBusy;
    this.previous = new Uint8Array(options.engine.cells);
  }

  get settling(): boolean {
    return this.morphing;
  }

  /** Wall-clock length of the current 0→1 blend. */
  get morphDuration(): number {
    if (this.playing) return 1 / Math.max(this.speed, MIN_SPEED);
    if (this.restStroke) return PAINT_MORPH;
    if (this.morphing && this.settleRate > 0) {
      const remaining = Math.max(1 - this.blend, 1e-4);
      return remaining / this.settleRate;
    }
    if (this.morphing) return MANUAL_MORPH;
    return 1 / Math.max(this.speed, MIN_SPEED);
  }

  setSpeed(generationsPerSecond: number): void {
    if (!Number.isFinite(generationsPerSecond)) return;
    this.speed = Math.max(MIN_SPEED, generationsPerSecond);
  }

  play(): void {
    this.playing = true;
    this.morphing = false;
    this.restStroke = false;
    this.dropPaintOverlay();
    this.start();
  }

  pause(): void {
    this.playing = false;
    this.queuedStep = false;
    this.restStroke = false;
    if (Number.isFinite(this.blend) && this.blend < 1 - 1e-4) {
      this.morphing = true;
      this.easeRemaining(SETTLE_DURATION);
      this.start();
      return;
    }
    this.ensurePrev();
    this.previous.set(this.engine.cells);
    this.blend = 1;
    this.morphing = false;
  }

  togglePlaying(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  stepOnce(): void {
    this.snapshot();
    this.engine.step();
    this.blend = 0;
    this.morphing = true;
    this.restStroke = false;
    this.queuedStep = false;
    this.settleRate = 1 / MANUAL_MORPH;
    this.dropPaintOverlay();
    this.start();
  }

  align(): void {
    this.ensurePrev();
    this.previous.set(this.engine.cells);
    this.blend = 1;
    this.morphing = false;
    this.restStroke = false;
    this.queuedStep = false;
    this.dropPaintOverlay();
  }

  beginStroke(): void {
    this.playing = false;
    this.queuedStep = false;
    this.ensurePrev();
    this.restStroke = false;
    this.dirty.length = 0;
    this.paintOverlay = false;
    if (this.blend < 1 - 1e-4 || this.morphing) {
      this.morphing = true;
      this.easeRemaining(SETTLE_DURATION);
    }
    this.start();
  }

  endStroke(): void {
    this.paintOverlay = false;
    this.dirty.length = 0;
    this.rebuildField = true;
    this.start();
  }

  stamp(x: number, y: number, value: 0 | 1): void {
    this.ensurePrev();
    this.playing = false;
    const i = this.engine.index(x, y);
    this.engine.cells[i] = value;
    this.previous[i] = value;
    const cell = {
      x: wrapIndex(x, this.engine.width),
      y: wrapIndex(y, this.engine.height),
      value,
    };

    const atRest = this.blend >= 1 - 1e-4 && !this.morphing;
    if (atRest) {
      this.blend = 1;
      this.morphing = false;
      this.restStroke = false;
      this.dirty.push(cell);
      this.paintOverlay = true;
    } else {
      this.morphing = true;
      this.paintOverlay = false;
      if (this.settleRate <= 0) this.easeRemaining(SETTLE_DURATION);
    }
    this.start();
  }

  stampLine(x0: number, y0: number, x1: number, y1: number, value: 0 | 1): void {
    x0 |= 0;
    y0 |= 0;
    x1 |= 0;
    y1 |= 0;
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.stamp(x, y, value);
      if (x === x1 && y === y1) break;
      const e2 = err << 1;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  start(): void {
    this.idleFrames = 0;
    if (this.running) return;
    if (typeof requestAnimationFrame !== "function") return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  /** Wake a sleeping loop for pointer / camera, then let it idle out. */
  nudge(): void {
    this.idleFrames = 0;
    this.start();
  }

  stop(): void {
    this.playing = false;
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** Advance without RAF. Tests use this; the live loop calls it from `frame`. */
  tick(dt: number): FrameInfo {
    const steps = this.applyTime(dt);
    return this.emit(dt, steps);
  }

  private ensurePrev(): void {
    if (this.previous.length !== this.engine.cells.length) {
      this.previous = new Uint8Array(this.engine.cells);
    }
  }

  private snapshot(): void {
    this.ensurePrev();
    this.previous.set(this.engine.cells);
  }

  private easeRemaining(duration: number): void {
    const remaining = Math.max(1 - this.blend, 1e-4);
    this.settleRate = remaining / Math.max(duration, 1e-3);
  }

  private applyTime(dt: number): number {
    let steps = 0;
    this.ensurePrev();

    if (this.playing && this.speed > 0) {
      const playDt = Math.min(dt, PLAY_DT_CAP);
      if (this.queuedStep) {
        this.snapshot();
        this.engine.step();
        this.blend = 0;
        this.queuedStep = false;
        steps = 1;
        // Stay on the handed-off frame. Adding blend here skipped the
        // first frames of the next morph and read as a snap.
        return steps;
      }
      this.blend += playDt * this.speed;
      if (this.blend >= 1) {
        this.blend = 1;
        this.queuedStep = true;
      }
    } else if (this.morphing) {
      const rate = this.settleRate > 0 ? this.settleRate : 1 / SETTLE_DURATION;
      this.blend += Math.min(dt, MORPH_DT_CAP) * rate;
      if (this.blend >= 1) {
        this.blend = 1;
        this.morphing = false;
        this.restStroke = false;
        this.previous.set(this.engine.cells);
      }
    }

    return steps;
  }

  private dropPaintOverlay(): void {
    this.paintOverlay = false;
    this.dirty.length = 0;
  }

  private emit(dt: number, steps: number): FrameInfo {
    const blend = this.blend < 0 ? 0 : this.blend > 1 ? 1 : this.blend;
    const info: FrameInfo = {
      dt,
      steps,
      playing: this.playing,
      generation: this.engine.generation,
      blend,
      morphDuration: this.morphDuration,
      previous: this.previous,
      current: this.engine.cells,
      dirty: this.dirty.slice(),
      paintOverlay: this.paintOverlay,
      rebuildField: this.rebuildField,
    };
    this.onFrame?.(info);
    if (this.paintOverlay) this.dirty.length = 0;
    this.rebuildField = false;
    return info;
  }

  private frame = (time: number): void => {
    if (!this.running) return;
    const raw = (time - this.lastTime) / 1000;
    this.lastTime = time;
    const dt = raw > this.maxDelta ? this.maxDelta : raw < 0 ? 0 : raw;
    const steps = this.applyTime(dt);
    this.emit(dt, steps);
    const busy = this.playing || this.morphing || this.queuedStep || this.isBusy?.() === true;
    if (!busy) {
      this.idleFrames += 1;
      if (this.idleFrames > 10) {
        this.running = false;
        this.rafId = null;
        return;
      }
    } else {
      this.idleFrames = 0;
    }
    this.rafId = requestAnimationFrame(this.frame);
  };
}
