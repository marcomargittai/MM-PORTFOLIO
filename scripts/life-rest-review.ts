/**
 * Visual review: vertex pie vs CAD inner fillet vs no fillet.
 * Raster at typical display (22 px/cell) — that is where the C-caps show.
 */
import { mkdirSync, writeFileSync } from "fs";
import { deflateSync } from "zlib";
import { DEFAULT_GOO, DEFAULT_PULL, GOO_MAX, PULL_UNIT } from "../src/lib/life/prefs.ts";
import { pullKCells } from "../src/lib/life/magnetism.ts";

const PPC = 22;
const SEAM = 1.25;
const pull = DEFAULT_PULL / PULL_UNIT;
const goo = DEFAULT_GOO / GOO_MAX;
const uCorner = goo * 0.5 * PPC;
const uGooey = pullKCells(pull) * PPC;
const blobScale = 0.5 + 0.1 * pull;

type Cells = ReadonlyArray<readonly [number, number]>;
type Mode = "pie" | "cad" | "none";

const SHAPES: { id: string; cells: Cells; pad: { x0: number; x1: number; y0: number; y1: number } }[] = [
  { id: "l", cells: [[0, 0], [1, 0], [0, 1]], pad: { x0: -0.4, x1: 2.4, y0: -0.4, y1: 2.4 } },
  { id: "j", cells: [[0, 0], [0, 1], [0, 2], [1, 2]], pad: { x0: -0.4, x1: 2.4, y0: -0.4, y1: 3.4 } },
  { id: "ltet", cells: [[0, 2], [1, 2], [2, 2], [2, 1], [2, 0]], pad: { x0: -0.4, x1: 3.4, y0: -0.4, y1: 3.4 } },
  { id: "bar", cells: [[0, 0], [1, 0], [2, 0]], pad: { x0: -0.4, x1: 3.4, y0: -0.8, y1: 1.8 } },
  { id: "tbar", cells: [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [0, 2]], pad: { x0: -0.5, x1: 2.5, y0: -0.4, y1: 5.4 } },
  { id: "diag", cells: [[0, 0], [1, 1]], pad: { x0: -0.4, x1: 2.4, y0: -0.4, y1: 2.4 } },
  { id: "lone", cells: [[0, 0]], pad: { x0: -0.6, x1: 1.6, y0: -0.6, y1: 1.6 } },
  { id: "hook", cells: [[0, 0], [1, 0], [1, 2]], pad: { x0: -0.4, x1: 2.4, y0: -0.4, y1: 3.4 } },
  {
    id: "glider",
    cells: [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]],
    pad: { x0: -0.4, x1: 3.4, y0: -0.4, y1: 3.4 },
  },
  {
    id: "flower",
    cells: [
      [1, 0], [2, 0], [3, 0],
      [0, 1], [4, 1],
      [0, 2], [4, 2],
      [0, 3], [4, 3],
      [1, 4], [2, 4], [3, 4],
      [2, 1], [1, 2], [3, 2], [2, 3],
    ],
    pad: { x0: -0.5, x1: 5.5, y0: -0.5, y1: 5.5 },
  },
  {
    id: "pond",
    cells: [[1, 0], [2, 0], [0, 1], [3, 1], [0, 2], [3, 2], [1, 3], [2, 3]],
    pad: { x0: -0.6, x1: 4.6, y0: -0.6, y1: 4.6 },
  },
  {
    id: "blockhole",
    cells: [
      [0, 0], [1, 0], [2, 0],
      [0, 1], [2, 1],
      [0, 2], [1, 2], [2, 2],
    ],
    pad: { x0: -0.5, x1: 3.5, y0: -0.5, y1: 3.5 },
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

function writePng(path: string, w: number, h: number, rgb: Buffer) {
  const bpp = 3;
  const rows = Buffer.alloc((w * bpp + 1) * h);
  for (let y = 0; y < h; y++) {
    rows[y * (w * bpp + 1)] = 0;
    rgb.copy(rows, y * (w * bpp + 1) + 1, y * w * bpp, y * w * bpp + w * bpp);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
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

function liveAt(cells: Cells, gx: number, gy: number) {
  const x = Math.round(gx);
  const y = Math.round(gy);
  for (const [cx, cy] of cells) if (cx === x && cy === y) return 1;
  return 0;
}

function sdRoundBox(px: number, py: number, hx: number, hy: number, r: number) {
  const rad = Math.min(Math.max(r, 0), Math.min(hx, hy));
  const qx = Math.abs(px) - hx + rad;
  const qy = Math.abs(py) - hy + rad;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
}

function sdRoundBox4(px: number, py: number, hx: number, hy: number, r: [number, number, number, number]) {
  const rx = px > 0 ? r[0] : r[2];
  const ry = px > 0 ? r[1] : r[3];
  const rad = Math.max(0, py > 0 ? rx : ry);
  const qx = Math.abs(px) - hx + rad;
  const qy = Math.abs(py) - hy + rad;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
}

function smin(a: number, b: number, k: number) {
  const h = Math.min(1, Math.max(0, 0.5 + 0.5 * (b - a) / Math.max(k, 1e-5)));
  return b * (1 - h) + a * h - k * h * (1 - h);
}

function restNotch(
  px: number,
  py: number,
  vx: number,
  vy: number,
  A: number,
  B: number,
  C: number,
  D: number,
  mode: Mode,
) {
  if (mode === "none") return 1e5;
  const n = A + B + C + D;
  if (Math.abs(n - 3) > 0.5) return 1e5;
  let qx = px - vx * PPC;
  let qy = py - vy * PPC;
  if (A < 0.5) {
    qx = -qx;
    qy = -qy;
  } else if (B < 0.5) qy = -qy;
  else if (C < 0.5) qx = -qx;
  if (mode === "pie") {
    if (qx < -1 || qy < -1) return 1e5;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - uCorner;
  }
  if (qx < 0 || qy < 0 || qx > uCorner || qy > uCorner) return 1e5;
  return uCorner - Math.hypot(uCorner - qx, uCorner - qy);
}

function shaderField(xCell: number, yCell: number, cells: Cells, mode: Mode) {
  const px = xCell * PPC;
  const py = yCell * PPC;
  const baseX = Math.floor(xCell);
  const baseY = Math.floor(yCell);
  let unionD = 1e5;
  const gcs: Array<[number, number]> = [];
  const alive: number[] = [];
  const ds: number[] = [];
  for (let j = -2; j <= 2; j++) {
    for (let i = -2; i <= 2; i++) {
      const gx = baseX + i;
      const gy = baseY + j;
      gcs.push([gx, gy]);
      const live = liveAt(cells, gx, gy);
      alive.push(live);
      ds.push(1e5);
      if (!live) continue;
      const e = liveAt(cells, gx + 1, gy);
      const w = liveAt(cells, gx - 1, gy);
      const s = liveAt(cells, gx, gy + 1);
      const n = liveAt(cells, gx, gy - 1);
      const ortho = e || w || s || n;
      const diag =
        liveAt(cells, gx + 1, gy + 1) ||
        liveAt(cells, gx + 1, gy - 1) ||
        liveAt(cells, gx - 1, gy + 1) ||
        liveAt(cells, gx - 1, gy - 1);
      const hu = ortho || diag ? 0.5 : blobScale;
      const he = hu * PPC;
      const rad = uCorner * hu * 2;
      const rads: [number, number, number, number] = [
        (1 - e) * (1 - s) * rad,
        (1 - e) * (1 - n) * rad,
        (1 - w) * (1 - s) * rad,
        (1 - w) * (1 - n) * rad,
      ];
      const d = sdRoundBox4(px - (gx + 0.5) * PPC, py - (gy + 0.5) * PPC, he, he, rads);
      ds[ds.length - 1] = d;
      unionD = Math.min(unionD, d);
    }
  }
  const notch = (ox: number, oy: number) => {
    const ix = baseX + ox;
    const iy = baseY + oy;
    const A = liveAt(cells, ix - 1, iy - 1);
    const B = liveAt(cells, ix, iy - 1);
    const C = liveAt(cells, ix - 1, iy);
    const D = liveAt(cells, ix, iy);
    return restNotch(px, py, ix, iy, A, B, C, D, mode);
  };
  let field = Math.min(unionD, notch(0, 0), notch(1, 0), notch(0, 1), notch(1, 1));
  field -= SEAM;

  if (uGooey <= 1e-4) return field;

  for (let n = 0; n < 25; n++) {
    if (!alive[n]) continue;
    for (let m = n + 1; m < 25; m++) {
      if (!alive[m]) continue;
      const dx = gcs[m][0] - gcs[n][0];
      const dy = gcs[m][1] - gcs[n][1];
      const cheb = Math.max(Math.abs(dx), Math.abs(dy));
      if (cheb > 2.5) continue;
      if (Math.abs(dx) === 1 && Math.abs(dy) === 1) {
        const o0 = liveAt(cells, gcs[n][0], gcs[m][1]);
        const o1 = liveAt(cells, gcs[m][0], gcs[n][1]);
        if (o0 + o1 === 1) continue;
      }
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      if (adx + ady < 2) continue;
      let need = adx > 0 && ady > 0;
      if (!need) {
        const sx = Math.sign(dx);
        const sy = Math.sign(dy);
        const steps = Math.max(adx, ady);
        for (let s = 1; s < steps; s++) {
          if (!liveAt(cells, gcs[n][0] + sx * s, gcs[n][1] + sy * s)) {
            need = true;
            break;
          }
        }
      }
      if (!need) continue;
      if (ds[n] < 0 || ds[m] < 0) continue;
      const glueHe = 0.5 * PPC;
      const glueR = Math.min(uCorner, glueHe);
      const ga = sdRoundBox(px - (gcs[n][0] + 0.5) * PPC, py - (gcs[n][1] + 0.5) * PPC, glueHe, glueHe, glueR);
      const gb = sdRoundBox(px - (gcs[m][0] + 0.5) * PPC, py - (gcs[m][1] + 0.5) * PPC, glueHe, glueHe, glueR);
      field = Math.min(field, smin(ga, gb, uGooey));
    }
  }
  return field;
}

function raster(cells: Cells, pad: { x0: number; x1: number; y0: number; y1: number }, mode: Mode) {
  const w = Math.round((pad.x1 - pad.x0) * PPC);
  const h = Math.round((pad.y1 - pad.y0) * PPC);
  const gray = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = pad.x0 + (x + 0.5) / PPC;
      const py = pad.y0 + (y + 0.5) / PPC;
      gray[y * w + x] = shaderField(px, py, cells, mode) <= 0 ? 255 : 0;
    }
  }
  return { w, h, gray };
}

function extraSolid(a: Buffer, b: Buffer) {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] && !b[i]) n += 1;
  return n;
}

function concatRgb(
  panels: Array<{ w: number; h: number; gray: Buffer }>,
  gap = 8,
) {
  const h = Math.max(...panels.map((p) => p.h));
  const w = panels.reduce((s, p) => s + p.w, 0) + gap * (panels.length - 1);
  const rgb = Buffer.alloc(w * h * 3, 20);
  let ox = 0;
  for (const p of panels) {
    for (let y = 0; y < p.h; y++) {
      for (let x = 0; x < p.w; x++) {
        const g = p.gray[y * p.w + x];
        const i = ((y * w) + ox + x) * 3;
        rgb[i] = g;
        rgb[i + 1] = g;
        rgb[i + 2] = g;
      }
    }
    ox += p.w + gap;
  }
  return { w, h, rgb };
}

const outDir = "/tmp/life-rest-review";
mkdirSync(outDir, { recursive: true });

for (const shape of SHAPES) {
  const pie = raster(shape.cells, shape.pad, "pie");
  const cad = raster(shape.cells, shape.pad, "cad");
  const none = raster(shape.cells, shape.pad, "none");
  const strip = concatRgb([pie, cad, none]);
  writePng(`${outDir}/${shape.id}-pie-cad-none.png`, strip.w, strip.h, strip.rgb);
  console.log(
    `${shape.id} pie-vs-cad=${extraSolid(pie.gray, cad.gray)} cad-vs-none=${extraSolid(cad.gray, none.gray)} none-vs-cad=${extraSolid(none.gray, cad.gray)} pie-vs-none=${extraSolid(pie.gray, none.gray)}`,
  );
}

console.log(`uCorner=${uCorner.toFixed(2)}px goo=${goo.toFixed(3)} pullk=${uGooey.toFixed(2)}px`);
