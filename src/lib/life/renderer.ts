import { GOO_MAX, GOO_UNIT } from "./prefs";

export type CellCoord = { col: number; row: number };

export type LifeBlobRendererOptions = {
  goo?: number;
  wrap?: boolean;
};

const GOO_INTENSITY_MAX = GOO_MAX / GOO_UNIT;

const VERT_SRC = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG_SRC = `#version 300 es
precision highp float;

uniform sampler2D uGrid;
uniform vec2 uGridSize;
uniform vec2 uCellSize;
uniform vec2 uOrigin;
uniform vec2 uResolution;
uniform vec2 uHalfExtents;
uniform float uCornerRadius;
uniform float uGooey;
uniform float uSoftness;
uniform float uWrap;
uniform float uBlend;

out vec4 fragColor;

float sdRoundedBox(vec2 p, vec2 b, float r) {
  float rr = min(r, min(b.x, b.y));
  vec2 q = abs(p) - b + rr;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rr;
}

float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

// Polynomial smooth-min. The extra term dies at |a-b| >= k, so a vacant
// cell between two live ones cannot grow a filament.
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / max(k, 1e-5), 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

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

// Grow or retract along live neighbors so a new square is a nub on the
// existing blob. Prefer neighbors that remain; only then transfer mass
// from a neighbor that is dying in the same tick.
float morphFromNeighbors(vec2 px, vec2 gc, vec2 center, bool birth, float t, float rad, vec2 halfExt, float rr) {
  float dStay = 1e5;
  float dFall = 1e5;
  bool anyStay = false;
  bool anyFall = false;

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      if (i == 0 && j == 0) continue;
      vec2 parentGc = gc + vec2(float(i), float(j));
      vec2 nocc = sampleOcc(parentGc);
      bool stay = nocc.x > 0.5 && nocc.y > 0.5;
      bool fallback = birth ? nocc.x > 0.5 : nocc.y > 0.5;
      if (!stay && !fallback) continue;
      vec2 parentC = uOrigin + (parentGc + 0.5) * uCellSize;
      vec2 tip = birth ? mix(parentC, center, t) : mix(center, parentC, t);
      float dCap = sdCapsule(px, parentC, tip, rad);
      if (stay) {
        anyStay = true;
        dStay = min(dStay, dCap);
      } else {
        anyFall = true;
        dFall = min(dFall, dCap);
      }
    }
  }

  float dGrow = anyStay ? dStay : dFall;
  float dBox = sdRoundedBox(px - center, halfExt, rr);
  if (!anyStay && !anyFall) {
    float s = birth ? t : (1.0 - t);
    if (s < 0.02) return 1e5;
    return sdRoundedBox(px - center, halfExt * s, rr * s);
  }
  if (birth) return mix(dGrow, dBox, smoothstep(0.55, 1.0, t));
  return mix(dBox, dGrow, smoothstep(0.0, 0.38, t));
}

float cellField(vec2 px, vec2 gc, float t, vec2 halfExt, float rad, float rr) {
  vec2 occ = sampleOcc(gc);
  float prev = occ.x;
  float next = occ.y;
  if (prev < 0.5 && next < 0.5) return 1e5;

  vec2 center = uOrigin + (gc + 0.5) * uCellSize;
  if (prev > 0.5 && next > 0.5) {
    return length(px - center) - rad;
  }
  return morphFromNeighbors(px, gc, center, next > 0.5, t, rad, halfExt, rr);
}

bool isLive(vec2 gc) {
  vec2 occ = sampleOcc(gc);
  return occ.x > 0.5 || occ.y > 0.5;
}

vec2 cellCenter(vec2 gc) {
  return uOrigin + (gc + 0.5) * uCellSize;
}

// Capsules from this cell to every live neighbor. Called once for the
// cell under the pixel so a waist always sees the link that fills it.
float neighborLinks(vec2 px, vec2 gc, float rad) {
  if (!isLive(gc)) return 1e5;
  vec2 a = cellCenter(gc);
  float d = 1e5;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      if (i == 0 && j == 0) continue;
      vec2 nb = gc + vec2(float(i), float(j));
      if (uWrap < 0.5 && !inGrid(nb, uGridSize)) continue;
      if (!isLive(nb)) continue;
      d = min(d, sdCapsule(px, a, cellCenter(nb), rad));
    }
  }
  return d;
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  vec2 local = px - uOrigin;
  vec2 gridPos = local / uCellSize;

  if (uWrap < 0.5 && (
      gridPos.x < 0.0 || gridPos.y < 0.0 ||
      gridPos.x >= uGridSize.x || gridPos.y >= uGridSize.y)) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  vec2 base = floor(gridPos);
  float t = uBlend * uBlend * (3.0 - 2.0 * uBlend);
  float rad = min(uHalfExtents.x, uHalfExtents.y);
  float k = max(uGooey, 1e-4);
  float lim = min(uCellSize.x, uCellSize.y) * 0.95;
  float sd = 1e5;

  // Chebyshev 1 only — this cell and its eight neighbors. No long-range union.
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 gc = base + vec2(float(i), float(j));
      if (uWrap < 0.5 && !inGrid(gc, uGridSize)) continue;
      float d = cellField(px, gc, t, uHalfExtents, rad, uCornerRadius);
      if (d < lim && sd < lim) sd = smin(sd, d, k);
      else sd = min(sd, d);
    }
  }

  sd = min(sd, neighborLinks(px, base, rad));

  // Constant AA. fwidth(sd) on a windowed field spikes at cell borders
  // and draws CAD hairlines through empty space.
  float aa = max(uSoftness, 1.15);
  if (sd > aa * 2.5) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  float a = 1.0 - smoothstep(-aa, aa, sd);
  fragColor = vec4(vec3(a), 1.0);
}`;

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

type GlUniforms = {
  uGrid: WebGLUniformLocation;
  uGridSize: WebGLUniformLocation;
  uCellSize: WebGLUniformLocation;
  uOrigin: WebGLUniformLocation;
  uResolution: WebGLUniformLocation;
  uHalfExtents: WebGLUniformLocation;
  uCornerRadius: WebGLUniformLocation;
  uGooey: WebGLUniformLocation;
  uSoftness: WebGLUniformLocation;
  uWrap: WebGLUniformLocation;
  uBlend: WebGLUniformLocation;
};

const ORTHO: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const DIAG: Array<[number, number]> = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

export class LifeBlobRenderer {
  goo = 0.22;
  wrap = true;
  softness = 0.2;

  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private tex: WebGLTexture | null = null;
  private uniforms: GlUniforms | null = null;
  private texCols = 0;
  private texRows = 0;
  private upload: Uint8Array | null = null;
  private blend = 1;

  private ctx2d: CanvasRenderingContext2D | null = null;
  private off2d: HTMLCanvasElement | OffscreenCanvas | null = null;
  private offCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

  private layout: Layout | null = null;

  init(canvas: HTMLCanvasElement, opts: LifeBlobRendererOptions = {}): void {
    this.dispose();
    this.canvas = canvas;
    this.goo = opts.goo ?? 0.22;
    this.wrap = opts.wrap ?? true;

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });

    if (gl) {
      this.gl = gl;
      try {
        this.initGl(gl);
      } catch (err) {
        console.warn("Life WebGL2 init failed; using canvas2d.", err);
        this.teardownGl();
        this.init2d(canvas);
      }
    } else {
      this.init2d(canvas);
    }

    this.resize();
  }

  setGoo(goo01: number): void {
    this.goo = Math.min(GOO_INTENSITY_MAX, Math.max(0, goo01));
    if (this.layout) this.layout = this.computeLayout(this.layout.cols, this.layout.rows);
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
    const packed = this.pack(previous, current, cols, rows);

    if (this.gl && this.program && this.vao && this.tex && this.uniforms) {
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
    for (let i = 0; i < n; i++) {
      out[i * 2] = previous[i] ? 255 : 0;
      out[i * 2 + 1] = current[i] ? 255 : 0;
    }
    return out;
  }

  private initGl(gl: WebGL2RenderingContext): void {
    const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
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

    const loc = (name: string): WebGLUniformLocation => {
      const u = gl.getUniformLocation(program, name);
      if (!u) throw new Error(name);
      return u;
    };

    this.program = program;
    this.vao = vao;
    this.tex = tex;
    this.uniforms = {
      uGrid: loc("uGrid"),
      uGridSize: loc("uGridSize"),
      uCellSize: loc("uCellSize"),
      uOrigin: loc("uOrigin"),
      uResolution: loc("uResolution"),
      uHalfExtents: loc("uHalfExtents"),
      uCornerRadius: loc("uCornerRadius"),
      uGooey: loc("uGooey"),
      uSoftness: loc("uSoftness"),
      uWrap: loc("uWrap"),
      uBlend: loc("uBlend"),
    };
  }

  private init2d(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) throw new Error("No WebGL2 or Canvas2D");
    this.ctx2d = ctx;
    const off =
      typeof OffscreenCanvas === "function" ? new OffscreenCanvas(1, 1) : document.createElement("canvas");
    const offCtx = off.getContext("2d");
    if (!offCtx) throw new Error("offscreen 2d");
    this.off2d = off;
    this.offCtx = offCtx;
  }

  private renderGl(grid: Uint8Array, cols: number, rows: number): void {
    const gl = this.gl!;
    const L = this.layout!;
    const u = this.uniforms!;

    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    if (cols !== this.texCols || rows !== this.texRows) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, cols, rows, 0, gl.RG, gl.UNSIGNED_BYTE, grid);
      this.texCols = cols;
      this.texRows = rows;
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cols, rows, gl.RG, gl.UNSIGNED_BYTE, grid);
    }

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);

    gl.uniform1i(u.uGrid, 0);
    gl.uniform2f(u.uGridSize, cols, rows);
    gl.uniform2f(u.uCellSize, L.cellDevW, L.cellDevH);
    gl.uniform2f(u.uOrigin, L.originDevX, L.originDevY);
    gl.uniform2f(u.uResolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform2f(u.uHalfExtents, L.halfDevW, L.halfDevH);
    gl.uniform1f(u.uCornerRadius, L.cornerDev);
    gl.uniform1f(u.uGooey, L.gooeyDev);
    gl.uniform1f(u.uSoftness, L.softDev);
    gl.uniform1f(u.uWrap, this.wrap ? 1 : 0);
    gl.uniform1f(u.uBlend, this.blend);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private render2d(
    previous: Uint8Array | Uint8ClampedArray,
    current: Uint8Array | Uint8ClampedArray,
    cols: number,
    rows: number,
  ): void {
    const canvas = this.canvas!;
    const ctx = this.ctx2d!;
    const L = this.layout!;
    const w = canvas.width;
    const h = canvas.height;
    const t = this.blend * this.blend * (3 - 2 * this.blend);
    const replicas = this.wrap ? [-1, 0, 1] : [0];
    const rad = Math.min(L.halfDevW, L.halfDevH);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#fff";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = rad * 2;

    const live = (grid: Uint8Array | Uint8ClampedArray, c: number, r: number) => {
      let x = c;
      let y = r;
      if (this.wrap) {
        x = ((c % cols) + cols) % cols;
        y = ((r % rows) + rows) % rows;
      } else if (c < 0 || r < 0 || c >= cols || r >= rows) {
        return false;
      }
      return grid[y * cols + x] !== 0;
    };

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

    for (let r = 0; r < rows; r++) {
      const rowOff = r * cols;
      for (let c = 0; c < cols; c++) {
        const prev = previous[rowOff + c] ? 1 : 0;
        const next = current[rowOff + c] ? 1 : 0;
        if (!prev && !next) continue;

        if (prev && next) {
          eachReplica(c, r, (cx, cy) => {
            ctx.beginPath();
            ctx.arc(cx, cy, rad, 0, Math.PI * 2);
            ctx.fill();
            for (const [dx, dy] of [...ORTHO, ...DIAG]) {
              if (dx < 0 || (dx === 0 && dy < 0)) continue;
              if (!live(previous, c + dx, r + dy) || !live(current, c + dx, r + dy)) continue;
              ctx.beginPath();
              ctx.moveTo(cx, cy);
              ctx.lineTo(cx + dx * L.cellDevW, cy + dy * L.cellDevH);
              ctx.stroke();
            }
          });
          continue;
        }

        const birth = !prev && next;
        const stayParents = neighborsOf(c, r, (x, y) => live(previous, x, y) && live(current, x, y));
        const fallbackParents = neighborsOf(c, r, (x, y) => (birth ? live(previous, x, y) : live(current, x, y)));
        const parents = stayParents.length ? stayParents : fallbackParents;

        if (parents.length === 0) {
          const s = birth ? t : 1 - t;
          if (s < 0.02) continue;
          eachReplica(c, r, (cx, cy) => {
            fillRoundedRect(
              ctx,
              cx - L.halfDevW * s,
              cy - L.halfDevH * s,
              L.halfDevW * 2 * s,
              L.halfDevH * 2 * s,
              L.cornerDev * s,
            );
          });
          continue;
        }

        eachReplica(c, r, (cx, cy) => {
          const settle = birth ? smoothstep(0.55, 1, t) : 1 - smoothstep(0, 0.38, t);
          const grow = 1 - settle;
          if (grow > 0.02) {
            ctx.globalAlpha = grow;
            for (const [dx, dy] of parents) {
              const px = cx + dx * L.cellDevW;
              const py = cy + dy * L.cellDevH;
              const tipX = birth ? mix(px, cx, t) : mix(cx, px, t);
              const tipY = birth ? mix(py, cy, t) : mix(cy, py, t);
              ctx.beginPath();
              ctx.moveTo(px, py);
              ctx.lineTo(tipX, tipY);
              ctx.stroke();
            }
            ctx.globalAlpha = 1;
          }
          if (settle > 0.02) {
            ctx.globalAlpha = settle;
            fillRoundedRect(ctx, cx - L.halfDevW, cy - L.halfDevH, L.halfDevW * 2, L.halfDevH * 2, L.cornerDev);
            ctx.globalAlpha = 1;
          }
        });
      }
    }
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
    const cellCssW = cssW / cols;
    const cellCssH = cssH / rows;
    const minCell = Math.min(cellCssW, cellCssH);
    const g = this.goo;
    // Default (g=0.22) already fills adjacent waists into one body. Stay
    // under 0.64 scale / ~1.22 k so a vacant cell between two live ones
    // cannot fill (midpoint sd stays > 0 even at 180).
    const blobScale = 0.575 + g * 0.032;
    const halfCssW = cellCssW * blobScale;
    const halfCssH = cellCssH * blobScale;
    const cornerCss = Math.min(halfCssW, halfCssH);
    const gooeyCss = minCell * (0.86 + g * 0.2);

    return {
      cssW,
      cssH,
      cols,
      rows,
      originCssX: 0,
      originCssY: 0,
      cellCssW,
      cellCssH,
      originDevX: 0,
      originDevY: 0,
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
      if (this.vao) gl.deleteVertexArray(this.vao);
      if (this.program) gl.deleteProgram(this.program);
    }
    this.gl = null;
    this.program = null;
    this.vao = null;
    this.tex = null;
    this.uniforms = null;
    this.texCols = 0;
    this.texRows = 0;
  }
}

function neighborsOf(c: number, r: number, live: (x: number, y: number) => boolean): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const [dx, dy] of ORTHO) {
    if (live(c + dx, r + dy)) out.push([dx, dy]);
  }
  for (const [dx, dy] of DIAG) {
    if (live(c + dx, r + dy)) out.push([dx, dy]);
  }
  return out;
}

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function smoothstep(e0: number, e1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
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

function fillRoundedRect(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
  ctx.fill();
}

export default LifeBlobRenderer;
