import type { LifeEngine } from "./engine";

export interface FrameInfo {
  dt: number;
  steps: number;
  playing: boolean;
  generation: number;
  blend: number;
  previous: Uint8Array;
  current: Uint8Array;
}

export interface LifeLoopOptions {
  engine: LifeEngine;
  speed?: number;
  maxStepsPerFrame?: number;
  maxDelta?: number;
  onFrame?: (info: FrameInfo) => void;
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

  private rafId: number | null = null;
  private lastTime = 0;
  private running = false;
  private morphing = false;
  private settleRate = 0;
  private restStroke = false;
  private queuedStep = false;

  constructor(options: LifeLoopOptions) {
    this.engine = options.engine;
    this.speed = options.speed ?? 12;
    this.maxStepsPerFrame = options.maxStepsPerFrame ?? 2;
    this.maxDelta = options.maxDelta ?? 0.25;
    this.onFrame = options.onFrame;
    this.previous = new Uint8Array(options.engine.cells);
  }

  get settling(): boolean {
    return this.morphing;
  }

  setSpeed(generationsPerSecond: number): void {
    if (!Number.isFinite(generationsPerSecond)) return;
    this.speed = Math.max(MIN_SPEED, generationsPerSecond);
  }

  play(): void {
    this.playing = true;
    this.morphing = false;
    this.restStroke = false;
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
    this.start();
  }

  align(): void {
    this.ensurePrev();
    this.previous.set(this.engine.cells);
    this.blend = 1;
    this.morphing = false;
    this.restStroke = false;
    this.queuedStep = false;
  }

  beginStroke(): void {
    this.playing = false;
    this.queuedStep = false;
    this.ensurePrev();
    this.restStroke = this.blend >= 1 - 1e-4 && !this.morphing;
    if (!this.restStroke) {
      this.morphing = true;
      this.easeRemaining(SETTLE_DURATION);
    }
    this.start();
  }

  stamp(x: number, y: number, value: 0 | 1): void {
    this.ensurePrev();
    this.playing = false;
    const i = this.engine.index(x, y);

    if (this.restStroke || (this.blend >= 1 - 1e-4 && !this.morphing)) {
      if (!this.morphing || this.blend >= 1 - 1e-4) {
        this.previous.set(this.engine.cells);
        this.blend = 0;
        this.easeRemaining(PAINT_MORPH);
        this.restStroke = true;
      }
      this.engine.cells[i] = value;
      this.morphing = true;
      this.start();
      return;
    }

    this.engine.cells[i] = value;
    this.morphing = true;
    if (this.settleRate <= 0) this.easeRemaining(SETTLE_DURATION);
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
    if (this.running) return;
    if (typeof requestAnimationFrame !== "function") return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
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
      let inc = playDt * this.speed;
      if (this.blend > 0.78) inc *= 0.42;
      this.blend += inc;
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

  private emit(dt: number, steps: number): FrameInfo {
    const blend = this.blend < 0 ? 0 : this.blend > 1 ? 1 : this.blend;
    const info: FrameInfo = {
      dt,
      steps,
      playing: this.playing,
      generation: this.engine.generation,
      blend,
      previous: this.previous,
      current: this.engine.cells,
    };
    this.onFrame?.(info);
    return info;
  }

  private frame = (time: number): void => {
    if (!this.running) return;
    const raw = (time - this.lastTime) / 1000;
    this.lastTime = time;
    const dt = raw > this.maxDelta ? this.maxDelta : raw < 0 ? 0 : raw;
    const steps = this.applyTime(dt);
    this.emit(dt, steps);
    this.rafId = requestAnimationFrame(this.frame);
  };
}
