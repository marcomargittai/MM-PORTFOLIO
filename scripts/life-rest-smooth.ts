/**
 * Rest silhouette at locked Goo 140 / Pull 43.
 * Compare a 3-bar, L, staircase, diagonal, and a gosper-like chunk.
 */
import { mkdirSync, writeFileSync } from "fs";
import { deflateSync } from "zlib";
import { liveField } from "../src/lib/life/magnetism.ts";
import { DEFAULT_GOO, DEFAULT_PULL, GOO_MAX, PULL_UNIT } from "../src/lib/life/prefs.ts";

const pull = DEFAULT_PULL / PULL_UNIT;
const goo = DEFAULT_GOO / GOO_MAX;
const PPC = 64;

type Cells = ReadonlyArray<readonly [number, number]>;

const SHAPES: { id: string; cells: Cells; pad: { x0: number; x1: number; y0: number; y1: number } }[] = [
  { id: "bar", cells: [[0, 0], [1, 0], [2, 0]], pad: { x0: -0.6, x1: 3.6, y0: -0.8, y1: 1.8 } },
  { id: "l", cells: [[0, 0], [1, 0], [0, 1]], pad: { x0: -0.6, x1: 2.6, y0: -0.6, y1: 2.6 } },
  {
    id: "stair",
    cells: [[0, 2], [1, 2], [1, 1], [2, 1], [2, 0], [3, 0]],
    pad: { x0: -0.6, x1: 4.6, y0: -0.6, y1: 3.6 },
  },
  { id: "diag", cells: [[0, 0], [1, 1]], pad: { x0: -0.6, x1: 2.6, y0: -0.6, y1: 2.6 } },
  { id: "lone", cells: [[0, 0]], pad: { x0: -0.8, x1: 1.8, y0: -0.8, y1: 1.8 } },
  {
    id: "chunk",
    cells: [
      [0, 2], [1, 2], [2, 2], [3, 2], [4, 2],
      [0, 3], [0, 4],
      [3, 1], [4, 1], [5, 1], [5, 0],
      [2, 3], [2, 4], [3, 4], [4, 4], [5, 4], [5, 3],
    ],
    pad: { x0: -0.7, x1: 6.7, y0: -0.7, y1: 5.7 },
  },
];

function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function writePng(path: string, w: number, h: number, gray: Buffer) {
  const rows = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) {
    rows[y * (w + 1)] = 0;
    gray.copy(rows, y * (w + 1) + 1, y * w, y * w + w);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  const chunk = (name: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(name), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    return Buffer.concat([len, body, crc]);
  };
  writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(rows)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

function raster(cells: Cells, pad: { x0: number; x1: number; y0: number; y1: number }) {
  const w = Math.round((pad.x1 - pad.x0) * PPC);
  const h = Math.round((pad.y1 - pad.y0) * PPC);
  const gray = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = pad.x0 + (x + 0.5) / PPC;
      const py = pad.y0 + (y + 0.5) / PPC;
      gray[y * w + x] = liveField(px, py, cells, pull, goo) <= 0 ? 255 : 0;
    }
  }
  return { w, h, gray };
}

function sideVariance(cells: Cells) {
  const samples: number[] = [];
  for (let i = 0; i <= 20; i++) {
    const x = 0.6 + (i / 20) * 1.8;
    samples.push(liveField(x, 1.0, cells, pull, goo));
  }
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const v = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length;
  return { mean, rms: Math.sqrt(v) };
}

const outDir = "/tmp/life-rest";
mkdirSync(outDir, { recursive: true });

for (const shape of SHAPES) {
  const { w, h, gray } = raster(shape.cells, shape.pad);
  writePng(`${outDir}/${shape.id}.png`, w, h, gray);
  console.log(`wrote ${shape.id} ${w}x${h}`);
}

const bar = sideVariance([[0, 0], [1, 0], [2, 0]]);
console.log(`bar side mean=${bar.mean.toFixed(4)} rms=${bar.rms.toFixed(4)}`);
