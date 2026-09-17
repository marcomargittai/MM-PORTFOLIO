/**
 * Hairline + glue-snap review at 22 px/cell.
 * Hairlines: CAD axis ray vs clipped fillet.
 * Glue: waterField t=0.75 vs t=1 vs t=0 on a diagonal pair.
 */
import { mkdirSync, writeFileSync } from "fs";
import { deflateSync } from "zlib";
import { innerNotchFillet, liveCore, liveField } from "../src/lib/life/magnetism.ts";
import { waterField } from "../src/lib/life/morph.ts";
import { DEFAULT_GOO, DEFAULT_PULL, GOO_MAX, PULL_UNIT } from "../src/lib/life/prefs.ts";

const PPC = 22;
const pull = DEFAULT_PULL / PULL_UNIT;
const goo = DEFAULT_GOO / GOO_MAX;
const rad = goo * 0.5;

type Cells = ReadonlyArray<readonly [number, number]>;

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

function raster(
  w: number,
  h: number,
  pad: { x0: number; y0: number },
  sample: (x: number, y: number) => number,
) {
  const gray = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = pad.x0 + (x + 0.5) / PPC;
      const py = pad.y0 + (y + 0.5) / PPC;
      gray[y * w + x] = sample(px, py) <= 0 ? 255 : 0;
    }
  }
  return gray;
}

function extra(a: Buffer, b: Buffer) {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] && !b[i]) n += 1;
  return n;
}

function concat(panels: Buffer[], w: number, h: number, gap = 8) {
  const W = w * panels.length + gap * (panels.length - 1);
  const rgb = Buffer.alloc(W * h * 3, 16);
  for (let p = 0; p < panels.length; p++) {
    const ox = p * (w + gap);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const g = panels[p][y * w + x];
        const i = (y * W + ox + x) * 3;
        rgb[i] = g;
        rgb[i + 1] = g;
        rgb[i + 2] = g;
      }
    }
  }
  return { w: W, h, rgb };
}

const L: Cells = [[0, 0], [1, 0], [0, 1]];
const DIAG: Cells = [[0, 0], [1, 1]];
const BAR: Cells = [[0, 0], [1, 0], [2, 0]];
const pad = { x0: -0.4, y0: -0.4 };
const w = Math.round(2.8 * PPC);
const h = Math.round(2.8 * PPC);

const outDir = "/tmp/life-glue-review";
mkdirSync(outDir, { recursive: true });

const lCore = raster(w, h, pad, (x, y) => liveCore(x, y, L, pull, goo));
const lFull = raster(w, h, pad, (x, y) => liveField(x, y, L, pull, goo));
const lFillet = raster(w, h, pad, (x, y) => innerNotchFillet(x, y, L, rad));
const lStrip = concat([lCore, lFull, lFillet], w, h);
writePng(`${outDir}/l-core-full-fillet.png`, lStrip.w, lStrip.h, lStrip.rgb);

const d75 = raster(w, h, pad, (x, y) => waterField(x, y, DIAG, DIAG, 0.75, pull, goo));
const d1 = raster(w, h, pad, (x, y) => waterField(x, y, DIAG, DIAG, 1, pull, goo));
const d0 = raster(w, h, pad, (x, y) => waterField(x, y, DIAG, DIAG, 0, pull, goo));
const dRaw = raster(w, h, pad, (x, y) => liveField(x, y, DIAG, pull, goo));
const dStrip = concat([d75, d1, d0, dRaw], w, h);
writePng(`${outDir}/diag-t75-t1-t0-raw.png`, dStrip.w, dStrip.h, dStrip.rgb);

const b75 = raster(Math.round(3.8 * PPC), Math.round(2.2 * PPC), { x0: -0.4, y0: -0.6 }, (x, y) =>
  waterField(x, y, BAR, BAR, 0.75, pull, goo),
);
const b1 = raster(Math.round(3.8 * PPC), Math.round(2.2 * PPC), { x0: -0.4, y0: -0.6 }, (x, y) =>
  waterField(x, y, BAR, BAR, 1, pull, goo),
);
const bw = Math.round(3.8 * PPC);
const bh = Math.round(2.2 * PPC);
const bStrip = concat([b75, b1], bw, bh);
writePng(`${outDir}/bar-t75-t1.png`, bStrip.w, bStrip.h, bStrip.rgb);

console.log(`L fillet-vs-core extra=${extra(lFillet, lCore)} core-vs-full=${extra(lCore, lFull)} full-vs-core=${extra(lFull, lCore)}`);
console.log(`diag t75-vs-t1=${extra(d75, d1)} t1-vs-t75=${extra(d1, d75)} t1-vs-t0=${extra(d1, d0)} t0-vs-t1=${extra(d0, d1)} raw-vs-t1=${extra(dRaw, d1)} t1-vs-raw=${extra(d1, dRaw)}`);
console.log(`bar t75-vs-t1=${extra(b75, b1)} t1-vs-t75=${extra(b1, b75)}`);
console.log(`axis ray at (1+r+0.18, 1.02) d=${innerNotchFillet(1 + rad + 0.18, 1.02, L, rad)}`);
