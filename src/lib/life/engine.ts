export type CellValue = 0 | 1;
export type PatternCell = readonly [x: number, y: number];

export function wrapIndex(i: number, n: number): number {
  i %= n;
  return i < 0 ? i + n : i;
}

export function buffersEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export const PATTERN_BLINKER: readonly PatternCell[] = [
  [0, 1],
  [1, 1],
  [2, 1],
];

export const PATTERN_GLIDER: readonly PatternCell[] = [
  [1, 0],
  [2, 1],
  [0, 2],
  [1, 2],
  [2, 2],
];

export class LifeEngine {
  width: number;
  height: number;
  cells: Uint8Array;
  generation = 0;

  private next: Uint8Array;

  constructor(width: number, height: number) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
      throw new RangeError("LifeEngine width/height must be positive integers");
    }
    this.width = width;
    this.height = height;
    this.cells = new Uint8Array(width * height);
    this.next = new Uint8Array(width * height);
  }

  index(x: number, y: number): number {
    return wrapIndex(y, this.height) * this.width + wrapIndex(x, this.width);
  }

  get(x: number, y: number): CellValue {
    return this.cells[this.index(x, y)] as CellValue;
  }

  set(x: number, y: number, value: CellValue): void {
    this.cells[this.index(x, y)] = value;
  }

  toggle(x: number, y: number): CellValue {
    const i = this.index(x, y);
    const next = (this.cells[i] ^ 1) as CellValue;
    this.cells[i] = next;
    return next;
  }

  stampPattern(cells: ArrayLike<PatternCell>, ox = 0, oy = 0): void {
    const w = this.width;
    const h = this.height;
    const grid = this.cells;
    const n = cells.length;
    for (let i = 0; i < n; i++) {
      const [px, py] = cells[i];
      const x = wrapIndex(ox + px, w);
      const y = wrapIndex(oy + py, h);
      grid[y * w + x] = 1;
    }
  }

  liveCount(): number {
    let n = 0;
    const grid = this.cells;
    for (let i = 0; i < grid.length; i++) n += grid[i]!;
    return n;
  }

  clear(): void {
    this.cells.fill(0);
    this.next.fill(0);
    this.generation = 0;
  }

  randomize(density = 0.12): void {
    const p = density < 0 ? 0 : density > 1 ? 1 : density;
    const grid = this.cells;
    grid.fill(0);

    const clusters = 16 + Math.floor(Math.random() * 10);
    for (let c = 0; c < clusters; c++) {
      const cx = Math.floor(Math.random() * this.width);
      const cy = Math.floor(Math.random() * this.height);
      const span = 3 + Math.floor(Math.random() * 4);
      for (let y = 0; y < span; y++) {
        for (let x = 0; x < span; x++) {
          if (Math.random() < p * 3) {
            this.set(cx + x, cy + y, 1);
          }
        }
      }
    }

    const extras = 8 + Math.floor(Math.random() * 8);
    for (let i = 0; i < extras; i++) {
      this.set(Math.floor(Math.random() * this.width), Math.floor(Math.random() * this.height), 1);
    }

    this.next.fill(0);
    this.generation = 0;
  }

  paintLine(x0: number, y0: number, x1: number, y1: number, value: CellValue = 1): void {
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
      this.set(x, y, value);
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

  step(): void {
    const w = this.width;
    const h = this.height;
    const cur = this.cells;
    const nxt = this.next;

    for (let y = 0; y < h; y++) {
      const row = y * w;
      const north = y === 0 ? (h - 1) * w : row - w;
      const south = y === h - 1 ? 0 : row + w;

      for (let x = 0; x < w; x++) {
        const west = x === 0 ? w - 1 : x - 1;
        const east = x === w - 1 ? 0 : x + 1;

        const neighbors =
          cur[north + west]! +
          cur[north + x]! +
          cur[north + east]! +
          cur[row + west]! +
          cur[row + east]! +
          cur[south + west]! +
          cur[south + x]! +
          cur[south + east]!;

        const alive = cur[row + x]!;
        nxt[row + x] = neighbors === 3 || (alive !== 0 && neighbors === 2) ? 1 : 0;
      }
    }

    this.cells = nxt;
    this.next = cur;
    this.generation += 1;
  }

  resize(width: number, height: number): void {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
      throw new RangeError("LifeEngine width/height must be positive integers");
    }
    if (width === this.width && height === this.height) return;

    const nextCells = new Uint8Array(width * height);
    const copyW = Math.min(this.width, width);
    const copyH = Math.min(this.height, height);
    const srcX = Math.max(0, (this.width - width) >> 1);
    const srcY = Math.max(0, (this.height - height) >> 1);
    const dstX = Math.max(0, (width - this.width) >> 1);
    const dstY = Math.max(0, (height - this.height) >> 1);
    const src = this.cells;
    const oldW = this.width;

    for (let y = 0; y < copyH; y++) {
      const s = (srcY + y) * oldW + srcX;
      nextCells.set(src.subarray(s, s + copyW), (dstY + y) * width + dstX);
    }

    this.width = width;
    this.height = height;
    this.cells = nextCells;
    this.next = new Uint8Array(width * height);
  }
}

export function testBlinkerPeriod2(): boolean {
  const life = new LifeEngine(8, 8);
  life.stampPattern(PATTERN_BLINKER, 2, 2);
  const g0 = life.cells.slice();
  life.step();
  const g1 = life.cells.slice();
  life.step();
  const g2 = life.cells.slice();
  return buffersEqual(g0, g2) && !buffersEqual(g0, g1) && life.generation === 2;
}

export function testGliderTranslation(): boolean {
  const size = 32;
  const ox = 4;
  const oy = 4;
  const life = new LifeEngine(size, size);
  life.stampPattern(PATTERN_GLIDER, ox, oy);
  for (let i = 0; i < 4; i++) life.step();
  const expected = new LifeEngine(size, size);
  expected.stampPattern(PATTERN_GLIDER, ox + 1, oy + 1);
  return buffersEqual(life.cells, expected.cells);
}

export function runLifeInvariantTests(): { name: string; passed: boolean }[] {
  return [
    { name: "blinker period 2", passed: testBlinkerPeriod2() },
    { name: "glider +1,+1 after 4 steps", passed: testGliderTranslation() },
  ];
}
