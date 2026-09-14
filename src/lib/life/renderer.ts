export type CellCoord = { col: number; row: number };

export type LifeBlobRendererOptions = {
  goo?: number;
  wrap?: boolean;
};

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
uniform float uRange;
uniform float uBlend;

out vec4 fragColor;

float sdRoundedBox(vec2 p, vec2 b, float r) {
  float rr = min(r, min(b.x, b.y));
  vec2 q = abs(p) - b + rr;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rr;
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

  ivec2 base = ivec2(floor(gridPos));
  int range = int(uRange + 0.5);
  float k = max(uGooey, 0.75);
  float acc = 0.0;
  vec2 gs = uGridSize;
  float t = uBlend * uBlend * (3.0 - 2.0 * uBlend);

  for (int j = -4; j <= 4; j++) {
    for (int i = -4; i <= 4; i++) {
      if (abs(i) > range || abs(j) > range) continue;

      ivec2 gc = base + ivec2(i, j);
      vec2 tc = vec2(gc);

      if (uWrap >= 0.5) {
        tc = mod(mod(tc, gs) + gs, gs);
      } else if (tc.x < 0.0 || tc.y < 0.0 || tc.x >= gs.x || tc.y >= gs.y) {
        continue;
      }

      vec2 occ = texelFetch(uGrid, ivec2(tc), 0).rg;
      float s = mix(occ.x, occ.y, t);
      if (s < 0.02) continue;

      vec2 center = uOrigin + (vec2(gc) + 0.5) * uCellSize;
      float d = sdRoundedBox(px - center, uHalfExtents * s, uCornerRadius * s);
      acc += exp2(-d / k);
    }
  }

  if (acc <= 1e-7) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  float sd = -k * log2(acc);
  float aa = max(uSoftness, fwidth(sd) * 0.55);
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
  uRange: WebGLUniformLocation;
  uBlend: WebGLUniformLocation;
};

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
      } catch {
        this.teardownGl();
        this.init2d(canvas);
      }
    } else {
      this.init2d(canvas);
    }

    this.resize();
  }

  setGoo(goo01: number): void {
    this.goo = Math.min(1, Math.max(0, goo01));
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
      uRange: loc("uRange"),
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
    gl.uniform1f(u.uRange, L.range);
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

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fff";

    for (let r = 0; r < rows; r++) {
      const rowOff = r * cols;
      for (let c = 0; c < cols; c++) {
        const s = (previous[rowOff + c] ? 1 : 0) * (1 - t) + (current[rowOff + c] ? 1 : 0) * t;
        if (s < 0.02) continue;
        const hw = L.halfDevW * s;
        const hh = L.halfDevH * s;
        const cr = L.cornerDev * s;
        for (const oy of replicas) {
          if (oy !== 0 && r > 3 && r < rows - 4) continue;
          for (const ox of replicas) {
            if (ox !== 0 && c > 3 && c < cols - 4) continue;
            const cx = L.originDevX + (c + ox * cols + 0.5) * L.cellDevW;
            const cy = L.originDevY + (r + oy * rows + 0.5) * L.cellDevH;
            fillRoundedRect(ctx, cx - hw, cy - hh, hw * 2, hh * 2, cr);
          }
        }
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
    const blobScale = 0.46 + g * 0.04;
    const halfCssW = cellCssW * blobScale;
    const halfCssH = cellCssH * blobScale;
    const cornerCss = Math.min(halfCssW, halfCssH) * (0.7 + g * 0.3);
    const gooeyCss = Math.max(0.6, minCell * (0.05 + g * 0.5));
    const influence = Math.max(halfCssW, halfCssH) + gooeyCss * 3.2;
    const range = Math.max(1, Math.min(4, Math.ceil(influence / Math.max(1, minCell))));

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
      range,
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
