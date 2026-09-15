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
uniform float uGooey;
uniform float uSoftness;
uniform float uWrap;
uniform float uBlend;
uniform vec2 uPointer;
uniform float uPointerAmp;
uniform float uPointerRadius;

out vec4 fragColor;

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

vec2 cellCenter(vec2 gc) {
  return uOrigin + (gc + 0.5) * uCellSize;
}

// One occupancy, one language: circle + capsules. Paint/align and play
// both use this. Pairwise products so a dying cell never links to a
// birth that never shared a generation.
float cellField(vec2 px, vec2 gc, float t, float rad) {
  vec2 occ = sampleOcc(gc);
  float o = occ.x * occ.y > 0.5 ? 1.0 : mix(occ.x, occ.y, t);
  if (o < 0.02) return 1e5;
  return length(px - cellCenter(gc)) - rad * o;
}

float orthoLink(vec2 px, vec2 a, vec2 occ, vec2 nb, float t, float rad) {
  if (uWrap < 0.5 && !inGrid(nb, uGridSize)) return 1e5;
  vec2 nocc = sampleOcc(nb);
  float rLink = (occ.x * occ.y > 0.5 && nocc.x * nocc.y > 0.5)
    ? rad
    : rad * mix(occ.x * nocc.x, occ.y * nocc.y, t);
  if (rLink < rad * 0.55) return 1e5;
  return sdCapsule(px, a, cellCenter(nb), rLink);
}

// Orthogonal tubes only. Diagonals at mid-blend draw the wireframe mesh.
float neighborLinks(vec2 px, vec2 gc, float t, float rad) {
  vec2 occ = sampleOcc(gc);
  vec2 a = cellCenter(gc);
  float d = 1e5;
  d = min(d, orthoLink(px, a, occ, gc + vec2(1.0, 0.0), t, rad));
  d = min(d, orthoLink(px, a, occ, gc + vec2(-1.0, 0.0), t, rad));
  d = min(d, orthoLink(px, a, occ, gc + vec2(0.0, 1.0), t, rad));
  d = min(d, orthoLink(px, a, occ, gc + vec2(0.0, -1.0), t, rad));
  return d;
}
}

// Press the live surface toward the pointer. Scales with occupancy so
// a vacant cell cannot open a hole or grow a filament.
float pointerBulge(vec2 px, float occ) {
  if (occ < 0.02 || uPointerAmp < 1e-4) return 0.0;
  vec2 d = px - uPointer;
  float r = max(uPointerRadius, 1.0);
  return occ * uPointerAmp * exp(-dot(d, d) / (r * r));
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

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 gc = base + vec2(float(i), float(j));
      if (uWrap < 0.5 && !inGrid(gc, uGridSize)) continue;
      vec2 occ = sampleOcc(gc);
      float o = mix(occ.x, occ.y, t);
      float d = cellField(px, gc, t, rad) - pointerBulge(px, o);
      if (d < lim && sd < lim) sd = smin(sd, d, k);
      else sd = min(sd, d);
    }
  }

  sd = min(sd, neighborLinks(px, base, t, rad));

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
  uGooey: WebGLUniformLocation;
  uSoftness: WebGLUniformLocation;
  uWrap: WebGLUniformLocation;
  uBlend: WebGLUniformLocation;
  uPointer: WebGLUniformLocation;
  uPointerAmp: WebGLUniformLocation;
  uPointerRadius: WebGLUniformLocation;
};

const ORTHO: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
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
  private camX = 0;
  private camY = 0;
  private camScale = 1;
  private ptrCssX = -1e6;
  private ptrCssY = -1e6;
  private ptrAmp = 0;
  private lastPtrCssX = 0;
  private lastPtrY = 0;

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

  setPointer(cssX: number, cssY: number): void {
    const dx = cssX - this.lastPtrCssX;
    const dy = cssY - this.lastPtrY;
    this.lastPtrCssX = cssX;
    this.lastPtrY = cssY;
    this.ptrCssX = cssX;
    this.ptrCssY = cssY;
    this.ptrAmp = Math.min(1, this.ptrAmp * 0.72 + Math.hypot(dx, dy) * 0.045);
  }

  clearPointer(): void {
    this.ptrCssX = -1e6;
    this.ptrCssY = -1e6;
    this.ptrAmp *= 0.5;
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
    this.ptrAmp *= 0.9;
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
      uGooey: loc("uGooey"),
      uSoftness: loc("uSoftness"),
      uWrap: loc("uWrap"),
      uBlend: loc("uBlend"),
      uPointer: loc("uPointer"),
      uPointerAmp: loc("uPointerAmp"),
      uPointerRadius: loc("uPointerRadius"),
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
    gl.uniform1f(u.uGooey, L.gooeyDev);
    gl.uniform1f(u.uSoftness, L.softDev);
    gl.uniform1f(u.uWrap, this.wrap ? 1 : 0);
    gl.uniform1f(u.uBlend, this.blend);
    const dpr = this.canvas!.width / Math.max(L.cssW, 1);
    gl.uniform2f(u.uPointer, this.ptrCssX * dpr, this.ptrCssY * dpr);
    const minCell = Math.min(L.cellDevW, L.cellDevH);
    gl.uniform1f(u.uPointerAmp, this.ptrAmp * minCell * 0.85);
    gl.uniform1f(u.uPointerRadius, minCell * 2.6);

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

    const bit = (grid: Uint8Array | Uint8ClampedArray, c: number, r: number) => {
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
        const occ = prev && next ? 1 : mix(prev, next, t);
        if (occ < 0.02) continue;

        eachReplica(c, r, (cx, cy) => {
          ctx.beginPath();
          ctx.arc(cx, cy, rad * occ, 0, Math.PI * 2);
          ctx.fill();
          for (const [dx, dy] of ORTHO) {
            if (dx < 0 || (dx === 0 && dy < 0)) continue;
            const nPrev = bit(previous, c + dx, r + dy);
            const nNext = bit(current, c + dx, r + dy);
            const rLink = prev && next && nPrev && nNext ? rad : rad * mix(prev * nPrev, next * nNext, t);
            if (rLink < rad * 0.55) continue;
            ctx.lineWidth = rLink * 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + dx * L.cellDevW, cy + dy * L.cellDevH);
            ctx.stroke();
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
    const zoom = this.camScale;
    const cellCssW = (cssW / cols) * zoom;
    const cellCssH = (cssH / rows) * zoom;
    const minCell = Math.min(cellCssW, cellCssH);
    const g = this.goo;
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

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
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

export default LifeBlobRenderer;
