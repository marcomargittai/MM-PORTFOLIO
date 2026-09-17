/**
 * Pass 4: intersection-preserving occupancy morph.
 * inside = intersection(prev,next) OR (blur(mix(i0,i1)) >= 0.5)
 * Still lifes stay put. Births grow off the parent. Mid-step is water.
 */
import { mkdirSync, writeFileSync } from "fs";
import { deflateSync } from "zlib";
import { liveField } from "../src/lib/life/magnetism.ts";
import { easeSmooth, midWeight } from "../src/lib/life/morph.ts";
import { DEFAULT_GOO, DEFAULT_PULL, GOO_MAX, PULL_UNIT } from "../src/lib/life/prefs.ts";

const pull = DEFAULT_PULL / PULL_UNIT;
const goo = DEFAULT_GOO / GOO_MAX;
const PPC = 52;
const TIMES = [0, 0.16, 0.32, 0.5, 0.68, 0.84, 1];
const PAD = 6;

type Cells = ReadonlyArray<readonly [number, number]>;
type Scenario = { id: string; pad: { x0: number; x1: number; y0: number; y1: number }; prev: Cells; next: Cells };

const S: Scenario[] = [
  { id: "ortho-birth", pad: { x0: -0.4, x1: 2.4, y0: -0.4, y1: 1.4 }, prev: [[0, 0]], next: [[0, 0], [1, 0]] },
  { id: "ortho-suck", pad: { x0: -0.4, x1: 2.4, y0: -0.4, y1: 1.4 }, prev: [[0, 0], [1, 0]], next: [[0, 0]] },
  {
    id: "blinker",
    pad: { x0: -0.5, x1: 3.5, y0: -1.5, y1: 2.5 },
    prev: [[0, 1], [1, 1], [2, 1]],
    next: [[1, 0], [1, 1], [1, 2]],
  },
  { id: "bar-dissolve", pad: { x0: -0.4, x1: 3.4, y0: -0.4, y1: 1.4 }, prev: [[0, 0], [1, 0], [2, 0]], next: [[0, 0], [2, 0]] },
  {
    id: "l-fill",
    pad: { x0: -0.4, x1: 2.4, y0: -0.4, y1: 2.4 },
    prev: [[0, 0], [1, 0], [0, 1]],
    next: [[0, 0], [1, 0], [0, 1], [1, 1]],
  },
  {
    id: "glider",
    pad: { x0: 0.4, x1: 4.6, y0: 0.4, y1: 4.6 },
    prev: [[2, 1], [3, 2], [1, 3], [2, 3], [3, 3]],
    next: [[1, 2], [3, 2], [2, 3], [3, 3], [2, 4]],
  },
  { id: "dissolve", pad: { x0: -0.5, x1: 1.5, y0: -0.5, y1: 1.5 }, prev: [[0, 0]], next: [] },
  {
    id: "block",
    pad: { x0: -0.4, x1: 2.4, y0: -0.4, y1: 2.4 },
    prev: [[0, 0], [1, 0], [0, 1], [1, 1]],
    next: [[0, 0], [1, 0], [0, 1], [1, 1]],
  },
  {
    id: "toad",
    pad: { x0: -0.6, x1: 4.6, y0: -1.6, y1: 3.6 },
    prev: [[1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1]],
    next: [[2, -1], [0, 0], [2, 0], [0, 1], [2, 1], [1, 2]],
  },
];

type ModelId = "img40" | "skel32" | "skel42" | "skel52";
const MODELS: ModelId[] = ["img40", "skel32", "skel42", "skel52"];

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

function rasterOcc(cells: Cells, pad: Scenario["pad"], fw: number, fh: number): Uint8Array {
  const { x0, x1, y0, y1 } = pad;
  const g = new Uint8Array(fw * fh);
  for (let j = 0; j < fh; j++) {
    const y = y0 + ((j + 0.5) / fh) * (y1 - y0);
    for (let i = 0; i < fw; i++) {
      const x = x0 + ((i + 0.5) / fw) * (x1 - x0);
      g[j * fw + i] = liveField(x, y, cells, pull, goo) < 0 ? 1 : 0;
    }
  }
  return g;
}

function blur(occ: Float32Array, w: number, h: number, sigma: number): Float32Array {
  const out = new Float32Array(w * h);
  if (sigma < 0.35) {
    out.set(occ);
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
      for (let k = -r; k <= r; k++) acc += occ[j * w + Math.min(w - 1, Math.max(0, i + k))] * ker[k + r];
      tmp[j * w + i] = acc;
    }
  }
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += tmp[Math.min(h - 1, Math.max(0, j + k)) * w + i] * ker[k + r];
      out[j * w + i] = acc;
    }
  }
  return out;
}

function restMismatch(bin: Uint8Array, rest: Uint8Array): number {
  let bad = 0;
  for (let i = 0; i < bin.length; i++) bad += (rest[i] ? 1 : 0) === (bin[i] >= 128 ? 1 : 0) ? 0 : 1;
  return bad / bin.length;
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

function stackRows(rows: Array<{ pix: Buffer; w: number; h: number }>) {
  const w = Math.max(...rows.map((r) => r.w));
  const h = rows.reduce((s, r) => s + r.h, 0) + PAD * (rows.length - 1);
  const pix = Buffer.alloc(w * h, 36);
  let y0 = 0;
  for (const r of rows) {
    for (let y = 0; y < r.h; y++) r.pix.copy(pix, (y0 + y) * w, y * r.w, y * r.w + r.w);
    y0 += r.h + PAD;
  }
  return { pix, w, h };
}

function paintStrip(frames: Array<{ bin: Uint8Array; fw: number; fh: number }>) {
  const fw = frames[0].fw;
  const fh = frames[0].fh;
  const w = fw * frames.length + PAD * (frames.length - 1);
  const pix = Buffer.alloc(w * fh, 0);
  for (let f = 0; f < frames.length; f++) {
    const ox = f * (fw + PAD);
    for (let j = 0; j < fh; j++) pix.set(frames[f].bin.subarray(j * fw, j * fw + fw), j * w + ox);
  }
  return { pix, w, h: fh };
}

const outDir = "/tmp/life-lab4";
mkdirSync(outDir, { recursive: true });
const metrics: string[] = ["scenario,model,rest0,rest1,maxBlobs,jump"];

for (const sc of S) {
  const { x0, x1, y0, y1 } = sc.pad;
  const fw = Math.round((x1 - x0) * PPC);
  const fh = Math.round((y1 - y0) * PPC);
  const i0 = rasterOcc(sc.prev, sc.pad, fw, fh);
  const i1 = rasterOcc(sc.next, sc.pad, fw, fh);
  const modelFrames = new Map<ModelId, Array<{ bin: Uint8Array; fw: number; fh: number }>>();
  for (const m of MODELS) modelFrames.set(m, []);

  for (const t of TIMES) {
    const e = easeSmooth(t);
    const wMid = midWeight(t);
    const mix = new Float32Array(fw * fh);
    const inter = new Uint8Array(fw * fh);
    for (let n = 0; n < mix.length; n++) {
      mix[n] = i0[n] * (1 - e) + i1[n] * e;
      inter[n] = i0[n] && i1[n] ? 1 : 0;
    }
    const mk = (sigmaCells: number, skel: boolean) => {
      const b = blur(mix, fw, fh, sigmaCells * PPC * wMid);
      const bin = new Uint8Array(fw * fh);
      for (let n = 0; n < bin.length; n++) {
        const keep = skel && inter[n];
        bin[n] = keep || b[n] >= 0.5 ? 255 : 0;
      }
      return bin;
    };
    modelFrames.get("img40")!.push({ bin: mk(0.4, false), fw, fh });
    modelFrames.get("skel32")!.push({ bin: mk(0.32, true), fw, fh });
    modelFrames.get("skel42")!.push({ bin: mk(0.42, true), fw, fh });
    modelFrames.get("skel52")!.push({ bin: mk(0.52, true), fw, fh });
  }

  const rowPix: Array<{ pix: Buffer; w: number; h: number }> = [];
  for (const m of MODELS) {
    const frames = modelFrames.get(m)!;
    const strip = paintStrip(frames);
    writePng(`${outDir}/${sc.id}-${m}.png`, strip.w, strip.h, strip.pix);
    rowPix.push(strip);
    const rest0 = restMismatch(frames[0].bin, i0);
    const rest1 = restMismatch(frames[frames.length - 1].bin, i1);
    let maxBlobs = 0;
    let jump = 0;
    for (let i = 0; i < frames.length; i++) {
      maxBlobs = Math.max(maxBlobs, components(frames[i].bin, fw, fh));
      if (i > 0) {
        let diff = 0;
        for (let p = 0; p < frames[i].bin.length; p++) diff += frames[i].bin[p] === frames[i - 1].bin[p] ? 0 : 1;
        jump = Math.max(jump, diff / frames[i].bin.length);
      }
    }
    metrics.push(`${sc.id},${m},${rest0.toFixed(4)},${rest1.toFixed(4)},${maxBlobs},${jump.toFixed(3)}`);
  }
  const stack = stackRows(rowPix);
  writePng(`${outDir}/${sc.id}-all.png`, stack.w, stack.h, stack.pix);
  console.log("wrote", sc.id);
}

writeFileSync(`${outDir}/metrics.csv`, metrics.join("\n") + "\n");
console.log(metrics.join("\n"));
console.log("wrote", outDir);
