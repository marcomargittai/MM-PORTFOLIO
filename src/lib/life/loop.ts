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
    this.start();
  }

  pause(): void {
    this.playing = false;
    if (Number.isFinite(this.blend) && this.blend < 1 - 1e-4) {
      this.morphing = true;
      this.settleRate = this.speed;
      this.start();
      return;
    }
    this.align();
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
    this.settleRate = 1 / MANUAL_MORPH;
    this.start();
  }

  align(): void {
    this.ensurePrev();
    this.previous.set(this.engine.cells);
    this.blend = 1;
    this.morphing = false;
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

  private applyTime(dt: number): number {
    let steps = 0;
    this.ensurePrev();

    if (this.playing && this.speed > 0) {
      this.blend += dt * this.speed;
      const cap = this.maxStepsPerFrame;
      while (this.blend >= 1 && steps < cap) {
        this.snapshot();
        this.engine.step();
        this.blend -= 1;
        steps += 1;
      }
      if (steps >= cap && this.blend >= 1) {
        this.snapshot();
        this.engine.step();
        this.blend = 0;
        steps += 1;
      }
    } else if (this.morphing) {
      const rate = this.settleRate > 0 ? this.settleRate : this.speed;
      this.blend += dt * rate;
      if (this.blend >= 1) {
        this.blend = 1;
        this.morphing = false;
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
