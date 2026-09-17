/**
 * Visual lab: compare generation-morph models on Life scenarios.
 *
 * Rest fields are rasterized once per generation. Models that only mix
 * those fields (lerp / band / soft / curve / image / opening) reuse them.
 * morphField is evaluated on its own — it is the rejected lattice walker.
 */
import { mkdirSync, writeFileSync } from "fs";
import { deflateSync } from "zlib";
import { liveField } from "../src/lib/life/magnetism.ts";
import {
  CURVE_AMP,
  CURVE_H,
  MORPH_BAND,
  easeSmooth,
  midWeight,
  morphField,
  type MorphCell,
} from "../src/lib/life/morph.ts";
import { DEFAULT_GOO, DEFAULT_PULL, GOO_MAX, PULL_UNIT } from "../src/lib/life/prefs.ts";

const pull = DEFAULT_PULL / PULL_UNIT;
const goo = DEFAULT_GOO / GOO_MAX;
const PPC = 48;
const TIMES = [0, 0.18, 0.36, 0.54, 0.72, 0.9, 1];
const PAD = 6;

type Cells = ReadonlyArray<readonly [number, number]>;

type Scenario = {
  id: string;
  pad: { x0: number; x1: number; y0: number; y1: number };
  prev: Cells;
  next: Cells;
  morph: MorphCell[];
};

const S: Scenario[] = [
  {
    id: "ortho-birth",
    pad: { x0: -0.4, x1: 2.4, y0: -0.4, y1: 1.4 },
    prev: [[0, 0]],
    next: [
      [0, 0],
      [1, 0],
    ],
    morph: [
      { x: 0, y: 0, role: "stay", pull: { dx: 0, dy: 0 } },
      { x: 1, y: 0, role: "birth", pull: { dx: -1, dy: 0 } },
    ],
  },
  {
    id: "ortho-suck",
    pad: { x0: -0.4, x1: 2.4, y0: -0.4, y1: 1.4 },
    prev: [
      [0, 0],
      [1, 0],
    ],
    next: [[0, 0]],
    morph: [
      { x: 0, y: 0, role: "stay", pull: { dx: 0, dy: 0 } },
      { x: 1, y: 0, role: "death", pull: { dx: -1, dy: 0 } },
    ],
  },
  {
    id: "blinker",
    pad: { x0: -0.5, x1: 3.5, y0: -1.5, y1: 2.5 },
    prev: [
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    next: [
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    morph: [
      { x: 1, y: 1, role: "stay", pull: { dx: 0, dy: 0 } },
      { x: 0, y: 1, role: "death", pull: { dx: 1, dy: 0 } },
      { x: 2, y: 1, role: "death", pull: { dx: -1, dy: 0 } },
      { x: 1, y: 0, role: "birth", pull: { dx: 0, dy: 1 } },
      { x: 1, y: 2, role: "birth", pull: { dx: 0, dy: -1 } },
    ],
  },
  {
    id: "bar-dissolve",
    pad: { x0: -0.4, x1: 3.4, y0: -0.4, y1: 1.4 },
    prev: [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    next: [
      [0, 0],
      [2, 0],
    ],
    morph: [
      { x: 0, y: 0, role: "stay", pull: { dx: 0, dy: 0 } },
      { x: 1, y: 0, role: "death", pull: { dx: 0, dy: 0 } },
      { x: 2, y: 0, role: "stay", pull: { dx: 0, dy: 0 } },
    ],
  },
  {
    id: "l-fill",
    pad: { x0: -0.4, x1: 2.4, y0: -0.4, y1: 2.4 },
    prev: [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    next: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    morph: [
      { x: 0, y: 0, role: "stay", pull: { dx: 0, dy: 0 } },
      { x: 1, y: 0, role: "stay", pull: { dx: 0, dy: 0 } },
      { x: 0, y: 1, role: "stay", pull: { dx: 0, dy: 0 } },
      { x: 1, y: 1, role: "birth", pull: { dx: -0.5, dy: -0.5 } },
    ],
  },
  {
    id: "glider",
    pad: { x0: 0.4, x1: 4.6, y0: 0.4, y1: 4.6 },
    prev: [
      [2, 1],
      [3, 2],
      [1, 3],
      [2, 3],
      [3, 3],
    ],
    next: [
      [1, 2],
      [3, 2],
      [2, 3],
      [3, 3],
      [2, 4],
    ],
    morph: [
      { x: 3, y: 2, role: "stay", pull: { dx: 0, dy: 0 } },
      { x: 2, y: 3, role: "stay", pull: { dx: 0, dy: 0 } },
      { x: 3, y: 3, role: "stay", pull: { dx: 0, dy: 0 } },
      { x: 2, y: 1, role: "death", pull: { dx: 1, dy: 1 } },
      { x: 1, y: 3, role: "death", pull: { dx: 1, dy: 0 } },
      { x: 1, y: 2, role: "birth", pull: { dx: 1, dy: 1 } },
      { x: 2, y: 4, role: "birth", pull: { dx: 0, dy: -1 } },
    ],
  },
  {
    id: "dissolve",
    pad: { x0: -0.5, x1: 1.5, y0: -0.5, y1: 1.5 },
    prev: [[0, 0]],
    next: [],
    morph: [{ x: 0, y: 0, role: "death", pull: { dx: 0, dy: 0 } }],
  },
  {
    id: "block",
    pad: { x0: -0.4, x1: 2.4, y0: -0.4, y1: 2.4 },
    prev: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    next: [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
    morph: [
      { x: 0, y: 0, role: "stay", pull: { dx: 0, dy: 0 } },
      { x: 1, y: 0, role: "stay", pull: { dx: 0, dy: 0 } },
      { x: 0, y: 1, role: "stay", pull: { dx: 0, dy: 0 } },
      { x: 1, y: 1, role: "stay", pull: { dx: 0, dy: 0 } },
    ],
  },
  {
    id: "toad",
    pad: { x0: -0.6, x1: 4.6, y0: -1.6, y1: 3.6 },
    prev: [
      [1, 0],
      [2, 0],
      [3, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    next: [
      [2, -1],
      [0, 0],
      [2, 0],
      [0, 1],
      [2, 1],
      [1, 2],
    ],
    morph: [
      { x: 1, y: 0, role: "death", pull: { dx: 0, dy: 0 } },
      { x: 3, y: 0, role: "death", pull: { dx: 0, dy: 0 } },
      { x: 1, y: 1, role: "death", pull: { dx: 0, dy: 0 } },
      { x: 2, y: 0, role: "stay", pull: { dx: 0, dy: 0 } },
      { x: 0, y: 1, role: "stay", pull: { dx: 0, dy: 0 } },
      { x: 2, y: 1, role: "stay", pull: { dx: 0, dy: 0 } },
      { x: 2, y: -1, role: "birth", pull: { dx: 0, dy: 1 } },
      { x: 0, y: 0, role: "birth", pull: { dx: 0, dy: 1 } },
      { x: 1, y: 2, role: "birth", pull: { dx: 0, dy: -1 } },
    ],
  },
];

type ModelId =
  | "morph"
  | "lerp"
  | "band"
  | "soft"
  | "curve"
  | "curveHi"
  | "open"
  | "image";

const MODELS: ModelId[] = ["morph", "lerp", "band", "soft", "curve", "curveHi", "open", "image"];

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
    const tag = Buffer.from(name);
    const body = Buffer.concat([tag, data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(rows, { level: 9 })),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

function rasterRest(
  cells: Cells,
  pad: Scenario["pad"],
  fw: number,
  fh: number,
): Float32Array {
  const { x0, x1, y0, y1 } = pad;
  const g = new Float32Array(fw * fh);
  for (let j = 0; j < fh; j++) {
    const y = y0 + ((j + 0.5) / fh) * (y1 - y0);
    for (let i = 0; i < fw; i++) {
      const x = x0 + ((i + 0.5) / fw) * (x1 - x0);
      g[j * fw + i] = liveField(x, y, cells, pull, goo);
    }
  }
  return g;
}

function clamp(v: number, b = MORPH_BAND) {
  return Math.min(b, Math.max(-b, v));
}

function laplacian(grid: Float32Array, i: number, j: number, fw: number, fh: number, hPx: number) {
  const at = (x: number, y: number) => {
    const xx = Math.min(fw - 1, Math.max(0, x));
    const yy = Math.min(fh - 1, Math.max(0, y));
    return grid[yy * fw + xx];
  };
  const d = at(i, j);
  const lap = at(i - 1, j) + at(i + 1, j) + at(i, j - 1) + at(i, j + 1) - 4 * d;
  const h = Math.max(hPx, 1);
  return lap / (h * h);
}

function morphOpen(bin: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r < 0.6) return bin;
  const rr = Math.ceil(r);
  const r2 = r * r;
  const erode = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  const disk: Array<[number, number]> = [];
  for (let y = -rr; y <= rr; y++) {
    for (let x = -rr; x <= rr; x++) {
      if (x * x + y * y <= r2 + 0.25) disk.push([x, y]);
    }
  }
  const hit = (src: Uint8Array, i: number, j: number, want: number) => {
    for (const [dx, dy] of disk) {
      const x = i + dx;
      const y = j + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) {
        if (want === 255) return true;
        continue;
      }
      if (src[y * w + x] === want) return true;
    }
    return false;
  };
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      erode[j * w + i] = hit(bin, i, j, 0) ? 0 : 255;
    }
  }
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      out[j * w + i] = hit(erode, i, j, 255) ? 255 : 0;
    }
  }
  return out;
}

function blurThresh(occ: Float32Array, w: number, h: number, sigma: number): Uint8Array {
  const out = new Uint8Array(w * h);
  if (sigma < 0.35) {
    for (let n = 0; n < occ.length; n++) out[n] = occ[n] >= 0.5 ? 255 : 0;
    return out;
  }
  const r = Math.max(1, Math.ceil(sigma * 2.4));
  const ker: number[] = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp((-0.5 * i * i) / (sigma * sigma));
    ker.push(v);
    sum += v;
  }
  for (let i = 0; i < ker.length; i++) ker[i] /= sum;
  const tmp = new Float32Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) {
        const x = Math.min(w - 1, Math.max(0, i + k));
        acc += occ[j * w + x] * ker[k + r];
      }
      tmp[j * w + i] = acc;
    }
  }
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) {
        const y = Math.min(h - 1, Math.max(0, j + k));
        acc += tmp[y * w + i] * ker[k + r];
      }
      out[j * w + i] = acc >= 0.5 ? 255 : 0;
    }
  }
  return out;
}

function components(bin: Uint8Array, w: number, h: number): number {
  const seen = new Uint8Array(w * h);
  let n = 0;
  const stack: number[] = [];
  for (let i = 0; i < bin.length; i++) {
    if (bin[i] < 128 || seen[i]) continue;
    n += 1;
    stack.push(i);
    seen[i] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % w;
      const y = (p - x) / w;
      const nb = [p + 1, p - 1, p + w, p - w];
      const ok = [x + 1 < w, x > 0, y + 1 < h, y > 0];
      for (let k = 0; k < 4; k++) {
        if (!ok[k]) continue;
        const q = nb[k];
        if (seen[q] || bin[q] < 128) continue;
        seen[q] = 1;
        stack.push(q);
      }
    }
  }
  return n;
}

function circularity(bin: Uint8Array, w: number, h: number): number {
  let area = 0;
  let peri = 0;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (bin[j * w + i] < 128) continue;
      area += 1;
      if (i === 0 || bin[j * w + i - 1] < 128) peri += 1;
      if (i === w - 1 || bin[j * w + i + 1] < 128) peri += 1;
      if (j === 0 || bin[(j - 1) * w + i] < 128) peri += 1;
      if (j === h - 1 || bin[(j + 1) * w + i] < 128) peri += 1;
    }
  }
  if (area < 8 || peri < 4) return 0;
  return (4 * Math.PI * area) / (peri * peri);
}

function restMismatch(bin: Uint8Array, rest: Float32Array): number {
  let bad = 0;
  for (let i = 0; i < bin.length; i++) {
    const want = rest[i] < 0 ? 1 : 0;
    const got = bin[i] >= 128 ? 1 : 0;
    bad += want === got ? 0 : 1;
  }
  return bad / bin.length;
}

function stackRows(rows: Array<{ pix: Buffer; w: number; h: number }>) {
  const w = Math.max(...rows.map((r) => r.w));
  const h = rows.reduce((s, r) => s + r.h, 0) + PAD * (rows.length - 1);
  const pix = Buffer.alloc(w * h, 36);
  let y0 = 0;
  for (const r of rows) {
    for (let y = 0; y < r.h; y++) {
      r.pix.copy(pix, (y0 + y) * w, y * r.w, y * r.w + r.w);
    }
    y0 += r.h + PAD;
  }
  return { pix, w, h };
}

const outDir = "/tmp/life-lab2";
mkdirSync(outDir, { recursive: true });

type FrameBin = { bin: Uint8Array; fw: number; fh: number };

function paintStrip(frames: FrameBin[]): { pix: Buffer; w: number; h: number } {
  const fw = frames[0].fw;
  const fh = frames[0].fh;
  const w = fw * frames.length + PAD * (frames.length - 1);
  const pix = Buffer.alloc(w * fh, 0);
  for (let f = 0; f < frames.length; f++) {
    const ox = f * (fw + PAD);
    for (let j = 0; j < fh; j++) {
      pix.set(frames[f].bin.subarray(j * fw, j * fw + fw), j * w + ox);
    }
  }
  return { pix, w, h: fh };
}

const metrics: string[] = [
  "scenario,model,rest0,rest1,maxBlobs,minCirc,jump",
];

for (const sc of S) {
  const { x0, x1, y0, y1 } = sc.pad;
  const fw = Math.round((x1 - x0) * PPC);
  const fh = Math.round((y1 - y0) * PPC);
  const d0 = rasterRest(sc.prev, sc.pad, fw, fh);
  const d1 = rasterRest(sc.next, sc.pad, fw, fh);
  const hPx = CURVE_H * PPC;
  const modelFrames = new Map<ModelId, FrameBin[]>();
  for (const m of MODELS) modelFrames.set(m, []);

  for (let f = 0; f < TIMES.length; f++) {
    const t = TIMES[f];
    const e = easeSmooth(t);
    const wMid = midWeight(t);
    const bandG = new Float32Array(fw * fh);
    const lerpG = new Float32Array(fw * fh);
    const softG = new Float32Array(fw * fh);
    const occG = new Float32Array(fw * fh);
    const morphB = new Uint8Array(fw * fh);

    for (let j = 0; j < fh; j++) {
      const y = y0 + ((j + 0.5) / fh) * (y1 - y0);
      for (let i = 0; i < fw; i++) {
        const n = j * fw + i;
        const a = d0[n];
        const b = d1[n];
        lerpG[n] = a + (b - a) * e;
        bandG[n] = clamp(a) + (clamp(b) - clamp(a)) * e;
        const kk = 0.55;
        const ma = -clamp(a) / kk + Math.log(Math.max(1 - e, 1e-12));
        const mb = -clamp(b) / kk + Math.log(Math.max(e, 1e-12));
        const m = Math.max(ma, mb);
        softG[n] = -kk * (m + Math.log(Math.exp(ma - m) + Math.exp(mb - m)));
        occG[n] = (a < 0 ? 1 : 0) * (1 - e) + (b < 0 ? 1 : 0) * e;
        const x = x0 + ((i + 0.5) / fw) * (x1 - x0);
        morphB[n] = morphField(x, y, sc.morph, t, pull, goo) < 0 ? 255 : 0;
      }
    }

    const curveG = new Float32Array(fw * fh);
    const curveHiG = new Float32Array(fw * fh);
    for (let j = 0; j < fh; j++) {
      for (let i = 0; i < fw; i++) {
        const n = j * fw + i;
        const d = bandG[n];
        const lap = wMid > 1e-4 ? laplacian(bandG, i, j, fw, fh, hPx) : 0;
        curveG[n] = d + CURVE_AMP * wMid * lap;
        curveHiG[n] = d + 0.045 * wMid * lap;
      }
    }

    const toBin = (g: Float32Array) => {
      const b = new Uint8Array(fw * fh);
      for (let n = 0; n < g.length; n++) b[n] = g[n] < 0 ? 255 : 0;
      return b;
    };

    const openR = 0.16 * PPC * wMid;
    const imgSig = 0.22 * PPC * wMid;

    modelFrames.get("morph")!.push({ bin: morphB, fw, fh });
    modelFrames.get("lerp")!.push({ bin: toBin(lerpG), fw, fh });
    modelFrames.get("band")!.push({ bin: toBin(bandG), fw, fh });
    modelFrames.get("soft")!.push({ bin: toBin(softG), fw, fh });
    modelFrames.get("curve")!.push({ bin: toBin(curveG), fw, fh });
    modelFrames.get("curveHi")!.push({ bin: toBin(curveHiG), fw, fh });
    modelFrames.get("open")!.push({ bin: morphOpen(toBin(bandG), fw, fh, openR), fw, fh });
    modelFrames.get("image")!.push({ bin: blurThresh(occG, fw, fh, imgSig), fw, fh });
  }

  const rowPix: Array<{ pix: Buffer; w: number; h: number }> = [];
  for (const m of MODELS) {
    const frames = modelFrames.get(m)!;
    const strip = paintStrip(frames);
    writePng(`${outDir}/${sc.id}-${m}.png`, strip.w, strip.h, strip.pix);
    rowPix.push(strip);

    const rest0 = restMismatch(frames[0].bin, d0);
    const rest1 = restMismatch(frames[frames.length - 1].bin, d1);
    let maxBlobs = 0;
    let minCirc = 99;
    let jump = 0;
    for (let i = 0; i < frames.length; i++) {
      const blobs = components(frames[i].bin, fw, fh);
      maxBlobs = Math.max(maxBlobs, blobs);
      const circ = circularity(frames[i].bin, fw, fh);
      if (circ > 0) minCirc = Math.min(minCirc, circ);
      if (i > 0) {
        let diff = 0;
        for (let p = 0; p < frames[i].bin.length; p++) {
          diff += frames[i].bin[p] === frames[i - 1].bin[p] ? 0 : 1;
        }
        jump = Math.max(jump, diff / frames[i].bin.length);
      }
    }
    metrics.push(
      `${sc.id},${m},${rest0.toFixed(4)},${rest1.toFixed(4)},${maxBlobs},${minCirc === 99 ? 0 : minCirc.toFixed(3)},${jump.toFixed(3)}`,
    );
  }

  const stack = stackRows(rowPix);
  writePng(`${outDir}/${sc.id}-all.png`, stack.w, stack.h, stack.pix);
  console.log("wrote", sc.id);
}

writeFileSync(`${outDir}/metrics.csv`, metrics.join("\n") + "\n");
console.log(metrics.join("\n"));
console.log("wrote", outDir);
console.log("band", MORPH_BAND, "curveAmp", CURVE_AMP, "curveH", CURVE_H);
