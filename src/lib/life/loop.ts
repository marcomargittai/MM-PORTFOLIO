import type { LifeEngine } from "./engine";

export interface FrameInfo {
  dt: number;
  steps: number;
  playing: boolean;
  generation: number;
}

export interface LifeLoopOptions {
  engine: LifeEngine;
  speed?: number;
  maxStepsPerFrame?: number;
  maxDelta?: number;
  onFrame?: (info: FrameInfo) => void;
}

const MIN_SPEED = 0.25;

export class LifeLoop {
  readonly engine: LifeEngine;
  playing = false;
  speed: number;
  maxStepsPerFrame: number;
  maxDelta: number;
  accumulator = 0;
  onFrame: ((info: FrameInfo) => void) | undefined;

  private rafId: number | null = null;
  private lastTime = 0;
  private running = false;

  constructor(options: LifeLoopOptions) {
    this.engine = options.engine;
    this.speed = options.speed ?? 12;
    this.maxStepsPerFrame = options.maxStepsPerFrame ?? 8;
    this.maxDelta = options.maxDelta ?? 0.25;
    this.onFrame = options.onFrame;
  }

  setSpeed(generationsPerSecond: number): void {
    if (!Number.isFinite(generationsPerSecond)) return;
    this.speed = Math.max(MIN_SPEED, generationsPerSecond);
  }

  play(): void {
    this.playing = true;
    this.start();
  }

  pause(): void {
    this.playing = false;
  }

  togglePlaying(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  stepOnce(): void {
    this.engine.step();
    this.accumulator = 0;
  }

  start(): void {
    if (this.running) return;
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

  private frame = (time: number): void => {
    if (!this.running) return;
    const raw = (time - this.lastTime) / 1000;
    this.lastTime = time;
    const dt = raw > this.maxDelta ? this.maxDelta : raw < 0 ? 0 : raw;
    let steps = 0;

    if (this.playing && this.speed > 0) {
      this.accumulator += dt * this.speed;
      const cap = this.maxStepsPerFrame;
      while (this.accumulator >= 1 && steps < cap) {
        this.engine.step();
        this.accumulator -= 1;
        steps += 1;
      }
      if (steps >= cap) this.accumulator = 0;
    }

    this.onFrame?.({
      dt,
      steps,
      playing: this.playing,
      generation: this.engine.generation,
    });
    this.rafId = requestAnimationFrame(this.frame);
  };
}
