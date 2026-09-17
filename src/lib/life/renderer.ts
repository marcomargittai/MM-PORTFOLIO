import {
  growthWiggle,
  liquidEase,
  wiggleOccupancy,
  WIGGLE_DIED,
  WIGGLE_STAY,
} from "./death";
import { pullKCells } from "./magnetism";
import { SKEL_SIGMA, skelFlux } from "./morph";
import { GOO_MAX, GOO_UNIT, PULL_MAX, PULL_UNIT } from "./prefs";

const PTR_VEL_ADD = 2;
const PTR_VEL_DECAY = 0.9;
const PTR_STALE_S = 0.1;
const PTR_MIN_DT_S = 0.014;
const PTR_SPLAT_UV = 0.25;
const PTR_SPLAT_FLOOR = 0.035;
const PTR_SIZE_GAIN = 0.55;
const PTR_CORNER_HOVER = 0.42;
const PTR_AMOUNT_SLOW = 0.22;
const PTR_AMOUNT_FAST = 0.85;
const PTR_LEAVE_S = 0.12;

/** Outward offset in pixels — hides tile hairlines without inflating corners. */
const REST_SEAM_PX = 1.25;

export type CellCoord = { col: number; row: number };

export type LifeBlobRendererOptions = {
  goo?: number;
  pull?: number;
  wrap?: boolean;
};

const GOO_INTENSITY_MAX = GOO_MAX / GOO_UNIT;
const PULL_INTENSITY_MAX = PULL_MAX / PULL_UNIT;

const VERT_SRC = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const COMMON = `#version 300 es
precision highp float;

uniform sampler2D uGrid;
uniform vec2 uGridSize;
uniform vec2 uCellSize;
uniform vec2 uOrigin;
uniform vec2 uResolution;
uniform float uGooey;
uniform float uPull;
uniform float uCorner;
uniform float uSoftness;
uniform float uWrap;

vec2 wrapCell(vec2 c, vec2 g) {
  return mod(mod(c, g) + g, g);
}

bool inGrid(vec2 c, vec2 g) {
  return c.x >= 0.0 && c.y >= 0.0 && c.x < g.x && c.y < g.y;
}

vec2 sampleOcc(vec2 gc) {
  vec2 tc = uWrap >= 0.5 ? wrapCell(gc, uGridSize) : gc;
  if (uWrap < 0.5 && !inGrid(tc, uGridSize)) return vec2(0.0);
  return texelFetch(uGrid, ivec2(tc), 0).rg;
}

float sampleLive(vec2 gc, float ch) {
  vec2 o = sampleOcc(gc);
  return ch < 0.5 ? o.x : o.y;
}

vec2 cellCenter(vec2 gc) {
  return uOrigin + (gc + 0.5) * uCellSize;
}

float sdRoundBox(vec2 p, vec2 b, float r) {
  r = min(max(r, 0.0), min(b.x, b.y));
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float sdRoundBox4(vec2 p, vec2 b, vec4 r) {
  r.xy = (p.x > 0.0) ? r.xy : r.zw;
  r.x = (p.y > 0.0) ? r.x : r.y;
  r.x = max(r.x, 0.0);
  vec2 q = abs(p) - b + r.x;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r.x;
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / max(k, 1e-5), 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// Concave Goo-radius fillet at a 3-of-4 vertex, clipped to [0,rad]²
// so the axis rays cannot become 1.25px hairlines after the seam.
float restNotch(vec2 px, vec2 vertexGc, float A, float B, float C, float D, float rad) {
  float n = A + B + C + D;
  if (abs(n - 3.0) > 0.5 || rad < 1e-4) return 1e5;
  vec2 q = px - (uOrigin + vertexGc * uCellSize);
  if (A < 0.5) q = -q;
  else if (B < 0.5) q.y = -q.y;
  else if (C < 0.5) q.x = -q.x;
  if (q.x < 0.0 || q.y < 0.0 || q.x > rad || q.y > rad) return 1e5;
  return rad - length(vec2(rad) - q);
}

bool needPull(vec2 a, vec2 b, float ch) {
  vec2 d = b - a;
  float adx = abs(d.x);
  float ady = abs(d.y);
  if (adx + ady < 1.5) return false;
  if (adx > 0.5 && ady > 0.5) return true;
  float sx = sign(d.x);
  float sy = sign(d.y);
  float steps = max(adx, ady);
  for (int s = 1; s < 5; s++) {
    if (float(s) >= steps - 0.5) break;
    if (sampleLive(a + vec2(sx, sy) * float(s), ch) < 0.5) return true;
  }
  return false;
}

void restFullCore(vec2 px, float ch, out float fullD, out float coreD) {
  vec2 gridPos = (px - uOrigin) / uCellSize;
  vec2 base = floor(gridPos);
  float blobScale = 0.5 + 0.1 * uPull;
  float unionD = 1e5;
  float alive[25];
  vec2 gcs[25];
  float ds[25];

  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      int idx = (j + 2) * 5 + (i + 2);
      vec2 gc = base + vec2(float(i), float(j));
      gcs[idx] = gc;
      float live = sampleLive(gc, ch);
      alive[idx] = live;
      ds[idx] = 1e5;
      if (live < 0.5) continue;
      float e = sampleLive(gc + vec2(1.0, 0.0), ch);
      float w = sampleLive(gc + vec2(-1.0, 0.0), ch);
      float s = sampleLive(gc + vec2(0.0, 1.0), ch);
      float n = sampleLive(gc + vec2(0.0, -1.0), ch);
      float ortho = max(e, max(w, max(s, n)));
      float ne = sampleLive(gc + vec2(1.0, 1.0), ch);
      float nw = sampleLive(gc + vec2(-1.0, 1.0), ch);
      float se = sampleLive(gc + vec2(1.0, -1.0), ch);
      float sw = sampleLive(gc + vec2(-1.0, -1.0), ch);
      float diag = max(ne, max(nw, max(se, sw)));
      float hu = (ortho > 0.5 || diag > 0.5) ? 0.5 : blobScale;
      vec2 he = hu * uCellSize;
      float rad = uCorner * hu * 2.0;
      vec4 rads = vec4(
        (1.0 - e) * (1.0 - s) * rad,
        (1.0 - e) * (1.0 - n) * rad,
        (1.0 - w) * (1.0 - s) * rad,
        (1.0 - w) * (1.0 - n) * rad
      );
      ds[idx] = sdRoundBox4(px - cellCenter(gc), he, rads);
      unionD = min(unionD, ds[idx]);
    }
  }

  float field = unionD;
  field = min(field, restNotch(px, base, alive[6], alive[7], alive[11], alive[12], uCorner));
  field = min(field, restNotch(px, base + vec2(1.0, 0.0), alive[7], alive[8], alive[12], alive[13], uCorner));
  field = min(field, restNotch(px, base + vec2(0.0, 1.0), alive[11], alive[12], alive[16], alive[17], uCorner));
  field = min(field, restNotch(px, base + vec2(1.0, 1.0), alive[12], alive[13], alive[17], alive[18], uCorner));
  field -= ${REST_SEAM_PX.toFixed(2)};
  coreD = field;

  if (uGooey <= 1e-4) { fullD = field; return; }

  float minCell = min(uCellSize.x, uCellSize.y);
  if (field < -0.25 * minCell || field > 1.65 * minCell) {
    fullD = field;
    return;
  }

  for (int n = 0; n < 25; n++) {
    if (alive[n] < 0.5) continue;
    for (int m = n + 1; m < 25; m++) {
      if (alive[m] < 0.5) continue;
      vec2 dlt = gcs[m] - gcs[n];
      float cheb = max(abs(dlt.x), abs(dlt.y));
      if (cheb > 2.5) continue;
      if (abs(dlt.x) > 0.5 && abs(dlt.x) < 1.5 && abs(dlt.y) > 0.5 && abs(dlt.y) < 1.5) {
        float o0 = sampleLive(vec2(gcs[n].x, gcs[m].y), ch);
        float o1 = sampleLive(vec2(gcs[m].x, gcs[n].y), ch);
        if (abs(o0 + o1 - 1.0) < 0.5) continue;
      }
      if (!needPull(gcs[n], gcs[m], ch)) continue;
      if (ds[n] < 0.0 || ds[m] < 0.0) continue;
      vec2 glueHe = 0.5 * uCellSize;
      float glueR = min(uCorner, min(glueHe.x, glueHe.y));
      float ga = sdRoundBox(px - cellCenter(gcs[n]), glueHe, glueR);
      float gb = sdRoundBox(px - cellCenter(gcs[m]), glueHe, glueR);
      field = min(field, smin(ga, gb, uGooey));
    }
  }
  fullD = field;
}
`;

const FIELD_SRC = `${COMMON}
uniform float uBlend;
uniform float uIdentical;
out vec4 fragColor;

void main() {
  vec2 px = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  vec2 gridPos = (px - uOrigin) / uCellSize;
  if (uWrap < 0.5 && (
      gridPos.x < 0.0 || gridPos.y < 0.0 ||
      gridPos.x >= uGridSize.x || gridPos.y >= uGridSize.y)) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  float aa = max(uSoftness, 1.15);
  float fullD;
  float coreD;
  if (uIdentical > 0.5 || uBlend < 0.001 || uBlend > 0.999) {
    float ch = (uIdentical > 0.5 || uBlend > 0.5) ? 1.0 : 0.0;
    restFullCore(px, ch, fullD, coreD);
    float a = 1.0 - smoothstep(-aa, aa, fullD);
    float hold = 1.0 - smoothstep(-aa, aa, coreD);
    fragColor = vec4(a, a, hold, 1.0);
    return;
  }
  float f0;
  float c0;
  float f1;
  float c1;
  restFullCore(px, 0.0, f0, c0);
  restFullCore(px, 1.0, f1, c1);
  float a0 = 1.0 - smoothstep(-aa, aa, f0);
  float a1 = 1.0 - smoothstep(-aa, aa, f1);
  float hold = (1.0 - smoothstep(-aa, aa, c0)) * (1.0 - smoothstep(-aa, aa, c1));
  fragColor = vec4(a0, a1, hold, 1.0);
}
`;

const BLUR_SRC = `#version 300 es
precision highp float;

uniform sampler2D uField;
uniform vec2 uResolution;
uniform float uBlend;
uniform float uSigma;
uniform vec2 uAxis;
uniform float uMix;
uniform float uWiggle;

out vec4 fragColor;

float liquidEase(float t) {
  t = clamp(t, 0.0, 1.0);
  return t * t * (10.0 + t * (-20.0 + t * (15.0 - 4.0 * t)));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec4 c = texture(uField, uv);
  float t = uBlend;
  float e = liquidEase(t);
  float inter = uMix > 0.5 ? c.b : c.g;
  float src = uMix > 0.5
    ? mix(c.r, c.g, e) + uWiggle * (max(c.g - c.r, 0.0) + ${WIGGLE_STAY.toFixed(2)} * min(c.r, c.g) + ${WIGGLE_DIED.toFixed(2)} * max(c.r - c.g, 0.0))
    : c.r;
  float sig = max(uSigma, 0.45);
  float acc = 0.0;
  float wsum = 0.0;
  for (int i = -24; i <= 24; i++) {
    float w = exp(-0.5 * float(i * i) / (sig * sig));
    vec4 s = texture(uField, uv + uAxis * float(i) / uResolution);
    float v = uMix > 0.5
      ? mix(s.r, s.g, e) + uWiggle * (max(s.g - s.r, 0.0) + ${WIGGLE_STAY.toFixed(2)} * min(s.r, s.g) + ${WIGGLE_DIED.toFixed(2)} * max(s.r - s.g, 0.0))
      : s.r;
    acc += v * w;
    wsum += w;
  }
  fragColor = vec4(acc / max(wsum, 1e-6), inter, 0.0, 1.0);
}
`;

const COMPOSE_SRC = `#version 300 es
precision highp float;

uniform sampler2D uField;
uniform vec2 uResolution;
uniform vec2 uOrigin;
uniform vec2 uCellSize;
uniform vec2 uGridSize;
uniform float uWrap;
uniform float uSigma;
uniform vec2 uPtr;
uniform vec2 uPtrPrev;
uniform float uPtrVel;
uniform float uPtrAlive;

out vec4 fragColor;

vec2 wrapCell(vec2 c, vec2 g) {
  return mod(mod(c, g) + g, g);
}

bool inGrid(vec2 c, vec2 g) {
  return c.x >= 0.0 && c.y >= 0.0 && c.x < g.x && c.y < g.y;
}

vec2 cellCenter(vec2 gc) {
  return uOrigin + (gc + 0.5) * uCellSize;
}

float sdRoundBox(vec2 p, vec2 b, float r) {
  r = min(max(r, 0.0), min(b.x, b.y));
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float lineDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  return length(pa - ba * h);
}

float hoverAt(vec2 cellPx) {
  float minSide = min(uResolution.x, uResolution.y);
  float rad = max((${PTR_SPLAT_FLOOR.toFixed(3)} + ${PTR_SPLAT_UV.toFixed(2)} * uPtrVel) * minSide, 1.0);
  float d = lineDist(cellPx, uPtrPrev, uPtr);
  float t = clamp(1.0 - d / rad, 0.0, 1.0);
  float amount = mix(${PTR_AMOUNT_SLOW.toFixed(2)}, ${PTR_AMOUNT_FAST.toFixed(2)}, clamp(uPtrVel, 0.0, 1.0));
  return t * t * t * amount * uPtrAlive;
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 c = texture(uField, uv).rg;
  float blurred = c.r;
  float inter = c.g;
  float ae = max(0.035, 0.35 / max(uSigma, 1.0));
  float body = max(inter, smoothstep(0.5 - ae, 0.5 + ae, blurred));

  vec2 gridPos = (px - uOrigin) / uCellSize;
  if (uWrap < 0.5 && (
      gridPos.x < 0.0 || gridPos.y < 0.0 ||
      gridPos.x >= uGridSize.x || gridPos.y >= uGridSize.y)) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  float minCell = min(uCellSize.x, uCellSize.y);
  float dotR = clamp(minCell * 0.03, 1.15, 2.25);
  float lattice = 0.0;
  vec2 base = floor(gridPos);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 gc = base + vec2(float(i), float(j));
      if (uWrap < 0.5 && !inGrid(gc, uGridSize)) continue;
      if (uWrap >= 0.5) gc = wrapCell(gc, uGridSize);
      vec2 center = cellCenter(gc);
      float infl = hoverAt(center);
      float half = dotR * (1.0 + ${PTR_SIZE_GAIN.toFixed(2)} * infl);
      float rad = half * mix(1.0, ${PTR_CORNER_HOVER.toFixed(2)}, infl);
      float sd = sdRoundBox(px - center, vec2(half), rad);
      float aa = max(0.75, fwidth(sd));
      lattice = max(lattice, 1.0 - smoothstep(0.0, aa, sd));
    }
  }

  float a = max(body, lattice);
  fragColor = vec4(vec3(a), 1.0);
}
`;

type Layout = {
  cssW: number;
  cssH: number;
  cols: number;
  rows: number;
  originCssX: number;
  originCssY: number;
  cellCssW: number;
  cellCssH: number;
  originDevX: number;
  originDevY: number;
  cellDevW: number;
  cellDevH: number;
  halfDevW: number;
  halfDevH: number;
  cornerDev: number;
  gooeyDev: number;
  softDev: number;
  range: number;
};

type FieldUniforms = {
  uGrid: WebGLUniformLocation;
  uGridSize: WebGLUniformLocation;
  uCellSize: WebGLUniformLocation;
  uOrigin: WebGLUniformLocation;
  uResolution: WebGLUniformLocation;
  uGooey: WebGLUniformLocation;
  uPull: WebGLUniformLocation;
  uCorner: WebGLUniformLocation;
  uSoftness: WebGLUniformLocation;
  uWrap: WebGLUniformLocation;
  uBlend: WebGLUniformLocation;
  uIdentical: WebGLUniformLocation;
};

type BlurUniforms = {
  uField: WebGLUniformLocation;
  uResolution: WebGLUniformLocation;
  uBlend: WebGLUniformLocation;
  uSigma: WebGLUniformLocation;
  uAxis: WebGLUniformLocation;
  uMix: WebGLUniformLocation;
  uWiggle: WebGLUniformLocation;
};

type ComposeUniforms = {
  uField: WebGLUniformLocation;
  uResolution: WebGLUniformLocation;
  uOrigin: WebGLUniformLocation;
  uCellSize: WebGLUniformLocation;
  uGridSize: WebGLUniformLocation;
  uWrap: WebGLUniformLocation;
  uSigma: WebGLUniformLocation;
  uPtr: WebGLUniformLocation;
  uPtrPrev: WebGLUniformLocation;
  uPtrVel: WebGLUniformLocation;
  uPtrAlive: WebGLUniformLocation;
};

export class LifeBlobRenderer {
  goo = 0.06;
  pull = 0.1;
  wrap = true;
  softness = 0.2;
  wiggleEnabled = false;

  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private tex: WebGLTexture | null = null;
  private fieldProg: WebGLProgram | null = null;
  private blurProg: WebGLProgram | null = null;
  private composeProg: WebGLProgram | null = null;
  private fieldUni: FieldUniforms | null = null;
  private blurUni: BlurUniforms | null = null;
  private composeUni: ComposeUniforms | null = null;
  private fboA: WebGLFramebuffer | null = null;
  private fboB: WebGLFramebuffer | null = null;
  private texA: WebGLTexture | null = null;
  private texB: WebGLTexture | null = null;
  private fboW = 0;
  private fboH = 0;
  private texCols = 0;
  private texRows = 0;
  private upload: Uint8Array | null = null;
  private blend = 1;
  private growth = 0;
  private morphDuration = 1 / 12;

  private ctx2d: CanvasRenderingContext2D | null = null;
  private off2d: HTMLCanvasElement | OffscreenCanvas | null = null;
  private offCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

  private layout: Layout | null = null;
  private camX = 0;
  private camY = 0;
  private camScale = 1;
  private ptrCssX = -1e6;
  private ptrCssY = -1e6;
  private ptrSampleCssX = -1e6;
  private ptrSampleCssY = -1e6;
  private ptrVel = 0;
  private ptrAlive = 0;
  private ptrLastT = 0;
  private ptrHaveSample = false;
  private ptrInside = false;
  private identical = true;
  private gridHash = 0;
  private lastFieldSig = "";

  init(canvas: HTMLCanvasElement, opts: LifeBlobRendererOptions = {}): void {
    this.dispose();
    this.canvas = canvas;
    this.goo = opts.goo ?? 0.06;
    this.pull = opts.pull ?? 0.1;
    this.wrap = opts.wrap ?? true;

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });

    if (gl) {
      this.gl = gl;
      try {
        this.initGl(gl);
        markGl("ok");
      } catch (err) {
        console.warn("Life WebGL2 init failed; using canvas2d.", err);
        markGl(String(err));
        try {
          gl.getExtension("WEBGL_lose_context")?.loseContext();
        } catch {
          /* ignore */
        }
        this.teardownGl();
        this.init2d(canvas);
      }
    } else {
      markGl("no-webgl2");
      this.init2d(canvas);
    }

    this.resize();
  }

  setGoo(goo01: number): void {
    this.goo = Math.min(GOO_INTENSITY_MAX, Math.max(0, goo01));
    if (this.layout) this.layout = this.computeLayout(this.layout.cols, this.layout.rows);
  }

  setPull(pull01: number): void {
    this.pull = Math.min(PULL_INTENSITY_MAX, Math.max(0, pull01));
    if (this.layout) this.layout = this.computeLayout(this.layout.cols, this.layout.rows);
  }

  get needsWake(): boolean {
    return this.ptrInside || this.ptrVel > 0.008 || this.ptrAlive > 0.01;
  }

  setPointer(cssX: number, cssY: number): void {
    if (!this.ptrInside) this.ptrHaveSample = false;
    this.ptrCssX = cssX;
    this.ptrCssY = cssY;
    this.ptrInside = true;
  }

  clearPointer(): void {
    this.ptrInside = false;
  }

  setWiggleEnabled(on: boolean): void {
    this.wiggleEnabled = on;
  }

  setMorphDuration(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    this.morphDuration = seconds;
  }

  setCamera(x: number, y: number, scale: number): void {
    this.camX = x;
    this.camY = y;
    this.camScale = scale;
    if (this.layout) this.layout = this.computeLayout(this.layout.cols, this.layout.rows);
  }

  cellAtCss(cssX: number, cssY: number): { x: number; y: number } | null {
    const L = this.layout;
    if (!L || L.cellCssW <= 0 || L.cellCssH <= 0) return null;
    let col = Math.floor((cssX - L.originCssX) / L.cellCssW);
    let row = Math.floor((cssY - L.originCssY) / L.cellCssH);
    if (this.wrap) {
      col = ((col % L.cols) + L.cols) % L.cols;
      row = ((row % L.rows) + L.rows) % L.rows;
    } else if (col < 0 || row < 0 || col >= L.cols || row >= L.rows) {
      return null;
    }
    return { x: col, y: row };
  }

  resize(): void {
    const canvas = this.canvas;
    if (!canvas) return;

    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    const parent = canvas.parentElement;
    const cssW = Math.max(1, canvas.clientWidth || parent?.clientWidth || window.innerWidth);
    const cssH = Math.max(1, canvas.clientHeight || parent?.clientHeight || window.innerHeight);
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    if (this.gl) {
      this.gl.viewport(0, 0, w, h);
    } else if (this.off2d && this.offCtx) {
      if (this.off2d.width !== w || this.off2d.height !== h) {
        this.off2d.width = w;
        this.off2d.height = h;
      }
    }

    if (this.layout) {
      this.layout = this.computeLayout(this.layout.cols, this.layout.rows);
    }
  }

  render(
    previous: Uint8Array | Uint8ClampedArray,
    current: Uint8Array | Uint8ClampedArray,
    cols: number,
    rows: number,
    blend = 1,
  ): void {
    if (!this.canvas || cols < 1 || rows < 1) return;
    const n = cols * rows;
    if (previous.length < n || current.length < n) return;

    this.blend = blend < 0 ? 0 : blend > 1 ? 1 : blend;
    this.layout = this.computeLayout(cols, rows);
    this.stepPointer(this.layout.cssW, this.layout.cssH);
    const packed = this.pack(previous, current, cols, rows);

    if (this.gl && this.fieldProg && this.vao && this.tex && this.fieldUni) {
      this.renderGl(packed, cols, rows);
    } else if (this.ctx2d && this.offCtx && this.off2d) {
      this.render2d(previous, current, cols, rows);
    }
  }

  dispose(): void {
    this.teardownGl();
    this.ctx2d = null;
    this.off2d = null;
    this.offCtx = null;
    this.canvas = null;
    this.layout = null;
    this.upload = null;
  }

  private pack(
    previous: Uint8Array | Uint8ClampedArray,
    current: Uint8Array | Uint8ClampedArray,
    cols: number,
    rows: number,
  ): Uint8Array {
    const n = cols * rows;
    if (!this.upload || this.upload.length !== n * 2) {
      this.upload = new Uint8Array(n * 2);
    }
    const out = this.upload;
    let changed = 0;
    let same = true;
    let hash = 2166136261;
    for (let i = 0; i < n; i++) {
      const prev = previous[i] ? 1 : 0;
      const next = current[i] ? 1 : 0;
      out[i * 2] = prev ? 255 : 0;
      out[i * 2 + 1] = next ? 255 : 0;
      if (prev !== next) {
        same = false;
        changed += 1;
      }
      hash = Math.imul(hash ^ (prev + next * 2), 16777619);
    }
    this.growth = changed;
    this.identical = same;
    this.gridHash = hash;
    return out;
  }

  private link(gl: WebGL2RenderingContext, frag: string): WebGLProgram {
    const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, frag);
    const program = gl.createProgram();
    if (!program) throw new Error("program");
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program) || "link";
      gl.deleteProgram(program);
      throw new Error(log);
    }
    return program;
  }

  private initGl(gl: WebGL2RenderingContext): void {
    const fieldProg = this.link(gl, FIELD_SRC);
    const blurProg = this.link(gl, BLUR_SRC);
    const composeProg = this.link(gl, COMPOSE_SRC);

    const vao = gl.createVertexArray();
    const tex = gl.createTexture();
    if (!vao || !tex) throw new Error("vao/tex");

    gl.bindVertexArray(vao);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const loc = (p: WebGLProgram, name: string): WebGLUniformLocation => {
      const u = gl.getUniformLocation(p, name);
      if (!u) throw new Error(name);
      return u;
    };

    this.fieldProg = fieldProg;
    this.blurProg = blurProg;
    this.composeProg = composeProg;
    this.vao = vao;
    this.tex = tex;
    this.fieldUni = {
      uGrid: loc(fieldProg, "uGrid"),
      uGridSize: loc(fieldProg, "uGridSize"),
      uCellSize: loc(fieldProg, "uCellSize"),
      uOrigin: loc(fieldProg, "uOrigin"),
      uResolution: loc(fieldProg, "uResolution"),
      uGooey: loc(fieldProg, "uGooey"),
      uPull: loc(fieldProg, "uPull"),
      uCorner: loc(fieldProg, "uCorner"),
      uSoftness: loc(fieldProg, "uSoftness"),
      uWrap: loc(fieldProg, "uWrap"),
      uBlend: loc(fieldProg, "uBlend"),
      uIdentical: loc(fieldProg, "uIdentical"),
    };
    this.blurUni = {
      uField: loc(blurProg, "uField"),
      uResolution: loc(blurProg, "uResolution"),
      uBlend: loc(blurProg, "uBlend"),
      uSigma: loc(blurProg, "uSigma"),
      uAxis: loc(blurProg, "uAxis"),
      uMix: loc(blurProg, "uMix"),
      uWiggle: loc(blurProg, "uWiggle"),
    };
    this.composeUni = {
      uField: loc(composeProg, "uField"),
      uResolution: loc(composeProg, "uResolution"),
      uOrigin: loc(composeProg, "uOrigin"),
      uCellSize: loc(composeProg, "uCellSize"),
      uGridSize: loc(composeProg, "uGridSize"),
      uWrap: loc(composeProg, "uWrap"),
      uSigma: loc(composeProg, "uSigma"),
      uPtr: loc(composeProg, "uPtr"),
      uPtrPrev: loc(composeProg, "uPtrPrev"),
      uPtrVel: loc(composeProg, "uPtrVel"),
      uPtrAlive: loc(composeProg, "uPtrAlive"),
    };
  }

  private ensureTargets(gl: WebGL2RenderingContext, w: number, h: number): void {
    if (this.fboW === w && this.fboH === h && this.texA && this.texB) return;
    if (this.texA) gl.deleteTexture(this.texA);
    if (this.texB) gl.deleteTexture(this.texB);
    if (this.fboA) gl.deleteFramebuffer(this.fboA);
    if (this.fboB) gl.deleteFramebuffer(this.fboB);

    const makeTex = () => {
      const t = gl.createTexture();
      if (!t) throw new Error("fbo tex");
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    const makeFbo = (t: WebGLTexture) => {
      const f = gl.createFramebuffer();
      if (!f) throw new Error("fbo");
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error("fbo incomplete");
      }
      return f;
    };

    this.texA = makeTex();
    this.texB = makeTex();
    this.fboA = makeFbo(this.texA);
    this.fboB = makeFbo(this.texB);
    this.fboW = w;
    this.fboH = h;
    this.lastFieldSig = "";
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private init2d(canvas: HTMLCanvasElement): void {
    // After a WebGL context has touched this canvas, 2d is illegal on it.
    // Prefer a plain 2d context — `desynchronized` returns null in some browsers.
    let target = canvas;
    let ctx =
      target.getContext("2d", { alpha: false }) ||
      target.getContext("2d");
    if (!ctx) {
      const next = document.createElement("canvas");
      next.className = canvas.className;
      const style = canvas.getAttribute("style");
      if (style) next.setAttribute("style", style);
      next.style.display = "block";
      next.style.width = "100%";
      next.style.height = "100%";
      canvas.replaceWith(next);
      target = next;
      ctx = next.getContext("2d", { alpha: false }) || next.getContext("2d");
    }
    if (!ctx) {
      markGl("no-2d");
      return;
    }
    this.canvas = target;
    this.ctx2d = ctx;
    const off =
      typeof OffscreenCanvas === "function" ? new OffscreenCanvas(1, 1) : document.createElement("canvas");
    const offCtx =
      off.getContext("2d", { willReadFrequently: true }) || off.getContext("2d");
    if (!offCtx) {
      markGl("no-offscreen-2d");
      return;
    }
    this.off2d = off;
    this.offCtx = offCtx;
  }

  private bindFieldUniforms(gl: WebGL2RenderingContext, cols: number, rows: number): void {
    const L = this.layout!;
    const u = this.fieldUni!;
    gl.uniform1i(u.uGrid, 0);
    gl.uniform2f(u.uGridSize, cols, rows);
    gl.uniform2f(u.uCellSize, L.cellDevW, L.cellDevH);
    gl.uniform2f(u.uOrigin, L.originDevX, L.originDevY);
    gl.uniform2f(u.uResolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform1f(u.uGooey, L.gooeyDev);
    gl.uniform1f(u.uPull, this.pull);
    gl.uniform1f(u.uCorner, L.cornerDev);
    gl.uniform1f(u.uSoftness, L.softDev);
    gl.uniform1f(u.uWrap, this.wrap ? 1 : 0);
    gl.uniform1f(u.uBlend, this.blend);
    gl.uniform1f(u.uIdentical, this.identical ? 1 : 0);
  }

  private renderGl(grid: Uint8Array, cols: number, rows: number): void {
    const gl = this.gl!;
    const L = this.layout!;
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    this.ensureTargets(gl, w, h);

    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    if (cols !== this.texCols || rows !== this.texRows) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, cols, rows, 0, gl.RG, gl.UNSIGNED_BYTE, grid);
      this.texCols = cols;
      this.texRows = rows;
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cols, rows, gl.RG, gl.UNSIGNED_BYTE, grid);
    }

    const t = this.blend;
    const minCell = Math.min(L.cellDevW, L.cellDevH);
    const sigma = Math.max(0.45, SKEL_SIGMA * minCell * skelFlux(t, this.identical));
    const wiggle = this.wiggleEnabled ? growthWiggle(t, this.growth, this.morphDuration) : 0;
    const fieldSig = [
      cols,
      rows,
      w,
      h,
      this.blend,
      this.identical ? 1 : 0,
      this.gridHash,
      L.originDevX,
      L.originDevY,
      L.cellDevW,
      L.cellDevH,
      L.gooeyDev,
      this.pull,
      L.cornerDev,
      this.wrap ? 1 : 0,
      sigma,
      wiggle,
    ].join();

    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.bindVertexArray(this.vao);
    gl.viewport(0, 0, w, h);

    if (fieldSig !== this.lastFieldSig) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboA);
      gl.useProgram(this.fieldProg);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      this.bindFieldUniforms(gl, cols, rows);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      const blur = this.blurUni!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboB);
      gl.useProgram(this.blurProg);
      gl.bindTexture(gl.TEXTURE_2D, this.texA);
      gl.uniform1i(blur.uField, 0);
      gl.uniform2f(blur.uResolution, w, h);
      gl.uniform1f(blur.uBlend, this.blend);
      gl.uniform1f(blur.uSigma, sigma);
      gl.uniform1f(blur.uWiggle, wiggle);
      gl.uniform2f(blur.uAxis, 1, 0);
      gl.uniform1f(blur.uMix, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboA);
      gl.bindTexture(gl.TEXTURE_2D, this.texB);
      gl.uniform2f(blur.uAxis, 0, 1);
      gl.uniform1f(blur.uMix, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.lastFieldSig = fieldSig;
    }

    const c = this.composeUni!;
    const dpr = L.cssW > 0 ? this.canvas!.width / L.cssW : 1;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.composeProg);
    gl.bindTexture(gl.TEXTURE_2D, this.texA);
    gl.uniform1i(c.uField, 0);
    gl.uniform2f(c.uResolution, w, h);
    gl.uniform2f(c.uOrigin, L.originDevX, L.originDevY);
    gl.uniform2f(c.uCellSize, L.cellDevW, L.cellDevH);
    gl.uniform2f(c.uGridSize, cols, rows);
    gl.uniform1f(c.uWrap, this.wrap ? 1 : 0);
    gl.uniform1f(c.uSigma, Math.max(sigma, 1));
    gl.uniform2f(c.uPtr, this.ptrCssX * dpr, this.ptrCssY * dpr);
    gl.uniform2f(c.uPtrPrev, this.ptrSampleCssX * dpr, this.ptrSampleCssY * dpr);
    gl.uniform1f(c.uPtrVel, this.ptrVel);
    gl.uniform1f(c.uPtrAlive, this.ptrAlive);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.commitPointerSample();
  }

  private paintRest(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    bit: (c: number, r: number) => number,
    cols: number,
    rows: number,
  ): void {
    const L = this.layout!;
    const seam = 0.6;
    const replicas = this.wrap ? [-1, 0, 1] : [0];
    const eachReplica = (c: number, r: number, draw: (cx: number, cy: number) => void) => {
      for (const oy of replicas) {
        if (oy !== 0 && r > 3 && r < rows - 4) continue;
        for (const ox of replicas) {
          if (ox !== 0 && c > 3 && c < cols - 4) continue;
          const cx = L.originDevX + (c + ox * cols + 0.5) * L.cellDevW;
          const cy = L.originDevY + (r + oy * rows + 0.5) * L.cellDevH;
          draw(cx, cy);
        }
      }
    };
    const fillBlob = (
      cx: number,
      cy: number,
      hw: number,
      hh: number,
      cr: number | [number, number, number, number],
    ) => {
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(cx - hw, cy - hh, hw * 2, hh * 2, cr);
      } else {
        ctx.rect(cx - hw, cy - hh, hw * 2, hh * 2);
      }
      ctx.fill();
    };

    ctx.fillStyle = "#fff";
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!bit(c, r)) continue;
        const e = bit(c + 1, r);
        const w = bit(c - 1, r);
        const s = bit(c, r + 1);
        const north = bit(c, r - 1);
        const cr = Math.min(L.cornerDev, Math.min(L.halfDevW, L.halfDevH));
        const radii: [number, number, number, number] = [
          !e && !s ? cr : 0,
          !e && !north ? cr : 0,
          !w && !s ? cr : 0,
          !w && !north ? cr : 0,
        ];
        eachReplica(c, r, (cx, cy) => {
          fillBlob(cx, cy, L.halfDevW + seam, L.halfDevH + seam, radii);
        });
      }
    }
    const filletR = L.cornerDev;
    if (filletR > 0.6) {
      for (let r = -1; r < rows; r++) {
        for (let c = -1; c < cols; c++) {
          const a = bit(c, r);
          const b = bit(c + 1, r);
          const d = bit(c, r + 1);
          const e = bit(c + 1, r + 1);
          if (a + b + d + e !== 3) continue;
          const vx = L.originDevX + (c + 1) * L.cellDevW;
          const vy = L.originDevY + (r + 1) * L.cellDevH;
          ctx.beginPath();
          ctx.moveTo(vx, vy);
          if (!e) {
            ctx.lineTo(vx + filletR, vy);
            ctx.arc(vx + filletR, vy + filletR, filletR, -Math.PI / 2, Math.PI, false);
          } else if (!d) {
            ctx.lineTo(vx - filletR, vy);
            ctx.arc(vx - filletR, vy + filletR, filletR, -Math.PI / 2, 0, false);
          } else if (!a) {
            ctx.lineTo(vx - filletR, vy);
            ctx.arc(vx - filletR, vy - filletR, filletR, Math.PI / 2, 0, true);
          } else {
            ctx.lineTo(vx + filletR, vy);
            ctx.arc(vx + filletR, vy - filletR, filletR, Math.PI / 2, Math.PI, false);
          }
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  private render2d(
    previous: Uint8Array | Uint8ClampedArray,
    current: Uint8Array | Uint8ClampedArray,
    cols: number,
    rows: number,
  ): void {
    const canvas = this.canvas!;
    const ctx = this.ctx2d!;
    const off = this.off2d!;
    const offCtx = this.offCtx!;
    const L = this.layout!;
    const w = canvas.width;
    const h = canvas.height;
    const t = this.blend;
    const e = liquidEase(t);
    const wiggle = this.wiggleEnabled ? growthWiggle(t, this.growth, this.morphDuration) : 0;

    const bitOf = (grid: Uint8Array | Uint8ClampedArray, c: number, r: number) => {
      let x = c;
      let y = r;
      if (this.wrap) {
        x = ((c % cols) + cols) % cols;
        y = ((r % rows) + rows) % rows;
      } else if (c < 0 || r < 0 || c >= cols || r >= rows) {
        return 0;
      }
      return grid[y * cols + x] ? 1 : 0;
    };

    offCtx.setTransform(1, 0, 0, 1, 0, 0);
    const paintOne = (grid: Uint8Array | Uint8ClampedArray) => {
      offCtx.fillStyle = "#000";
      offCtx.fillRect(0, 0, w, h);
      this.paintRest(offCtx, (c, r) => bitOf(grid, c, r), cols, rows);
      return offCtx.getImageData(0, 0, w, h).data;
    };
    let prevData: Uint8ClampedArray;
    let nextData: Uint8ClampedArray;
    if (t < 0.001) {
      prevData = nextData = paintOne(previous);
    } else if (t > 0.999) {
      prevData = nextData = paintOne(current);
    } else {
      prevData = paintOne(previous);
      nextData = paintOne(current);
    }

    const mix = new Float32Array(w * h);
    const inter = new Uint8Array(w * h);
    for (let i = 0, p = 0; i < mix.length; i++, p += 4) {
      const a = prevData[p] / 255;
      const b = nextData[p] / 255;
      mix[i] = a * (1 - e) + b * e + wiggleOccupancy(a, b, wiggle);
      inter[i] = a > 0.5 && b > 0.5 ? 1 : 0;
    }

    const sigma = Math.max(
      0.45,
      SKEL_SIGMA * Math.min(L.cellDevW, L.cellDevH) * skelFlux(t, this.identical),
    );
    const blurred = boxBlur(mix, w, h, sigma);
    const out = ctx.createImageData(w, h);
    for (let i = 0, p = 0; i < blurred.length; i++, p += 4) {
      const on = inter[i] || blurred[i] >= 0.5 ? 255 : 0;
      out.data[p] = on;
      out.data[p + 1] = on;
      out.data[p + 2] = on;
      out.data[p + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);

    const replicas = this.wrap ? [-1, 0, 1] : [0];
    const dotR = Math.min(2.25, Math.max(1.15, Math.min(L.cellDevW, L.cellDevH) * 0.03));
    const dpr = L.cssW > 0 ? canvas.width / L.cssW : 1;
    const ptrX = this.ptrCssX * dpr;
    const ptrY = this.ptrCssY * dpr;
    const prevX = this.ptrSampleCssX * dpr;
    const prevY = this.ptrSampleCssY * dpr;
    const splatR = Math.max((PTR_SPLAT_FLOOR + PTR_SPLAT_UV * this.ptrVel) * Math.min(w, h), 1);
    const amount = PTR_AMOUNT_SLOW + (PTR_AMOUNT_FAST - PTR_AMOUNT_SLOW) * this.ptrVel;
    ctx.fillStyle = "#fff";
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        for (const oy of replicas) {
          if (oy !== 0 && r > 3 && r < rows - 4) continue;
          for (const ox of replicas) {
            if (ox !== 0 && c > 3 && c < cols - 4) continue;
            const cx = L.originDevX + (c + ox * cols + 0.5) * L.cellDevW;
            const cy = L.originDevY + (r + oy * rows + 0.5) * L.cellDevH;
            const dist = lineDist2(cx, cy, prevX, prevY, ptrX, ptrY);
            const falloff = Math.max(0, Math.min(1, 1 - dist / splatR));
            const infl = falloff * falloff * falloff * amount * this.ptrAlive;
            const half = dotR * (1 + PTR_SIZE_GAIN * infl);
            const corner = half * (1 - infl + PTR_CORNER_HOVER * infl);
            ctx.beginPath();
            if (typeof ctx.roundRect === "function") {
              ctx.roundRect(cx - half, cy - half, half * 2, half * 2, corner);
            } else {
              ctx.arc(cx, cy, half, 0, Math.PI * 2);
            }
            ctx.fill();
          }
        }
      }
    }
    this.commitPointerSample();
  }

  private stepPointer(cssW: number, cssH: number): void {
    const now = typeof performance !== "undefined" ? performance.now() : 0;
    const rawDt = this.ptrLastT === 0 ? 1 / 60 : (now - this.ptrLastT) / 1000;
    const dt = Math.min(0.05, Math.max(0, rawDt));
    this.ptrLastT = now;
    const dtRatio = Math.min(2, dt * 60);
    const decay = Math.exp(Math.log(PTR_VEL_DECAY) * dtRatio);

    if (!this.ptrInside) {
      this.ptrAlive = Math.max(0, this.ptrAlive - dt / PTR_LEAVE_S);
      this.ptrVel *= decay;
      this.ptrSampleCssX = this.ptrCssX;
      this.ptrSampleCssY = this.ptrCssY;
      return;
    }

    this.ptrAlive = 1;
    if (!this.ptrHaveSample) {
      this.ptrSampleCssX = this.ptrCssX;
      this.ptrSampleCssY = this.ptrCssY;
      this.ptrHaveSample = true;
      return;
    }

    const dx = (this.ptrCssX - this.ptrSampleCssX) / Math.max(cssW, 1);
    const dy = (this.ptrCssY - this.ptrSampleCssY) / Math.max(cssH, 1);
    const len = Math.hypot(dx, dy);
    const stale = dt > PTR_STALE_S;
    if (dt >= PTR_MIN_DT_S && len > 0 && !stale) {
      this.ptrVel = Math.min(1, this.ptrVel + PTR_VEL_ADD * len);
    }
    this.ptrVel *= decay;
  }

  private commitPointerSample(): void {
    this.ptrSampleCssX = this.ptrCssX;
    this.ptrSampleCssY = this.ptrCssY;
  }

  private computeLayout(cols: number, rows: number): Layout {
    const canvas = this.canvas!;
    const parent = canvas.parentElement;
    const cssW = Math.max(
      1,
      canvas.clientWidth || parent?.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 1),
    );
    const cssH = Math.max(
      1,
      canvas.clientHeight || parent?.clientHeight || (typeof window !== "undefined" ? window.innerHeight : 1),
    );
    const dpr = canvas.width / cssW;
    const zoom = this.camScale;
    const cellCssW = (cssW / cols) * zoom;
    const cellCssH = (cssH / rows) * zoom;
    const minCell = Math.min(cellCssW, cellCssH);
    const g = this.goo;
    const p = this.pull;
    const round = Math.min(1, Math.max(0, g / GOO_INTENSITY_MAX));
    const blobScale = 0.5;
    const halfCssW = cellCssW * blobScale;
    const halfCssH = cellCssH * blobScale;
    const maxCorner = Math.min(halfCssW, halfCssH);
    const cornerCss = round * maxCorner;
    const gooeyCss = pullKCells(p) * minCell;

    return {
      cssW,
      cssH,
      cols,
      rows,
      originCssX: this.camX,
      originCssY: this.camY,
      cellCssW,
      cellCssH,
      originDevX: this.camX * dpr,
      originDevY: this.camY * dpr,
      cellDevW: cellCssW * dpr,
      cellDevH: cellCssH * dpr,
      halfDevW: halfCssW * dpr,
      halfDevH: halfCssH * dpr,
      cornerDev: cornerCss * dpr,
      gooeyDev: gooeyCss * dpr,
      softDev: this.softness * dpr,
      range: 1,
    };
  }

  private teardownGl(): void {
    const gl = this.gl;
    if (gl) {
      if (this.tex) gl.deleteTexture(this.tex);
      if (this.texA) gl.deleteTexture(this.texA);
      if (this.texB) gl.deleteTexture(this.texB);
      if (this.fboA) gl.deleteFramebuffer(this.fboA);
      if (this.fboB) gl.deleteFramebuffer(this.fboB);
      if (this.vao) gl.deleteVertexArray(this.vao);
      if (this.fieldProg) gl.deleteProgram(this.fieldProg);
      if (this.blurProg) gl.deleteProgram(this.blurProg);
      if (this.composeProg) gl.deleteProgram(this.composeProg);
    }
    this.gl = null;
    this.fieldProg = null;
    this.blurProg = null;
    this.composeProg = null;
    this.vao = null;
    this.tex = null;
    this.texA = null;
    this.texB = null;
    this.fboA = null;
    this.fboB = null;
    this.fieldUni = null;
    this.blurUni = null;
    this.composeUni = null;
    this.texCols = 0;
    this.texRows = 0;
    this.fboW = 0;
    this.fboH = 0;
    this.lastFieldSig = "";
  }
}

function markGl(status: string) {
  if (typeof window === "undefined") return;
  (window as Window & { __mmLifeGL?: string }).__mmLifeGL = status;
}

function lineDist2(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const denom = bax * bax + bay * bay;
  const h = denom <= 1e-8 ? 0 : Math.min(1, Math.max(0, (pax * bax + pay * bay) / denom));
  return Math.hypot(pax - bax * h, pay - bay * h);
}

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("shader");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) || "compile";
    gl.deleteShader(sh);
    throw new Error(log);
  }
  return sh;
}

function boxBlur(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  if (sigma < 0.45) return src;
  const r = Math.max(1, Math.ceil(sigma * 2.2));
  const ker: number[] = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp((-0.5 * i * i) / (sigma * sigma));
    ker.push(v);
    sum += v;
  }
  for (let i = 0; i < ker.length; i++) ker[i] /= sum;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += src[j * w + Math.min(w - 1, Math.max(0, i + k))] * ker[k + r];
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

export default LifeBlobRenderer;
