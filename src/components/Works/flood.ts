// Flood transition for the project page.
//
// Open: water rises from the bottom of the screen, arriving first where the clicked card sat,
// and the page exists only below the waterline (a clip-path rebuilt from the surface every
// frame). Once the line has left the top, the tint and caustics clear and the clip goes away.
// Close is the drain: the water clouds over again and falls away, taking the page with it.
//
// Physics: a 1D spring surface for the waterline, a spring-driven level, and a small 2D
// height-field ripple grid underwater (uploaded as a texture each frame). The shader adds the
// meniscus line, lens band, caustics, warm absorption, a glint, and four analytic swells. Drops
// and bubbles are drawn as point sprites. Everything runs only during the transition.

const N = 96; // waterline columns
const STEP = 1 / 120; // fixed physics step
const MAX_PARTICLES = 160;
const DPR_CAP = 1.5;

// Tuning. Lengths are CSS px unless noted; times are seconds.
const T = {
  // waterline columns: v += (-k*(h-eq) + spread*lap - damp*v) * dt   (lap in column units,
  // spread = (colWaveSpeed / column spacing)^2)
  colK: 14,
  colWaveSpeed: 440, // px/s (≈ 30 columns/s on a 1440 px screen)
  colSpreadMax: 96 * 96, // stability cap on narrow screens
  colDamp: 0.9,
  drizzleRate: 40, // kicks per second
  drizzleKick: 22, // px/s
  // level spring, in screen heights
  levelK: 7.2,
  levelZeta: 0.6,
  openTarget: -0.32, // above the top
  openStart: 1.0, // the mound tip starts at the bottom edge
  openV0: -0.9, // already flowing in (H/s)
  closeTarget: 1.38, // below the bottom
  closeStart: -0.3,
  closeDelay: 0.07,
  // inflow mound at the origin, as a fraction of the screen height
  bumpA: 0.36,
  bumpSigma: 0.16, // of the width
  bumpTau: 0.42,
  drainA: 0.2, // on close the water lingers at the origin
  drainTau: 0.3,
  // ripple grid: v += (c2*lap - damp*v) * dt   (cell units)
  gridW: 64,
  ripC2: 38 * 38,
  ripDamp: 0.85,
  // clear / cloud
  clearTime: 0.75,
  cloudTime: 0.2,
  gravity: 2900,
};

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let webglOk: boolean | null = null;
// WebGL is there and motion is welcome. The probe context is released straight away.
export function canFlood(): boolean {
  if (typeof window === "undefined" || reducedMotion()) return false;
  if (webglOk === null) {
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl");
      webglOk = !!gl;
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      webglOk = false;
    }
  }
  return webglOk;
}

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;        // CSS px
uniform float uDpr;
uniform sampler2D uLine;  // N x 1, 16-bit y per column
uniform float uN;
uniform vec2 uRange;      // y = uRange.x + v * uRange.y
uniform sampler2D uRip;   // r: h, g/b: gradient, a: laplacian
uniform vec2 uRipSize;    // CSS px covered by the grid
uniform vec2 uRipTex;     // grid size in cells
uniform float uTime;
uniform float uClar;      // underwater tint/caustics amount
uniform sampler2D uImg;
uniform vec4 uImgRect;    // x, y, w, h (CSS px)
uniform vec2 uImgScale;   // object-fit: cover, position top
uniform float uImgOn;

// cubic B-spline filtering from four bilinear taps: smooth curvature from a coarse grid
vec4 cubicW(float v) {
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
  vec4 s = n * n * n;
  float x = s.x, y = s.y - 4.0 * s.x, z = s.z - 4.0 * s.y + 6.0 * s.x;
  return vec4(x, y, z, 6.0 - x - y - z) * (1.0 / 6.0);
}
vec4 bicubic(sampler2D t, vec2 uv, vec2 ts) {
  uv = uv * ts - 0.5;
  vec2 f = fract(uv);
  uv -= f;
  vec4 xc = cubicW(f.x), yc = cubicW(f.y);
  vec4 c = uv.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 s = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
  vec4 o = (c + vec4(xc.yw, yc.yw) / s) / ts.xxyy;
  vec4 s0 = texture2D(t, o.xz), s1 = texture2D(t, o.yz), s2 = texture2D(t, o.xw), s3 = texture2D(t, o.yw);
  float sx = s.x / (s.x + s.y), sy = s.z / (s.z + s.w);
  return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
}

void swell(vec2 k, float a, float ph, float w, vec2 p, inout vec2 g, inout vec3 hs) {
  float s = dot(k, p) + ph;
  g += w * a * k * cos(s);
  hs -= w * a * sin(s) * vec3(k.x * k.x, k.y * k.y, k.x * k.y);
}

float lineAt(float i) {
  vec4 t = texture2D(uLine, vec2((clamp(i, 0.0, uN - 1.0) + 0.5) / uN, 0.5));
  float v = (floor(t.r * 255.0 + 0.5) * 256.0 + floor(t.g * 255.0 + 0.5)) / 65535.0;
  return uRange.x + v * uRange.y;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y * uDpr - gl_FragCoord.y) / uDpr;

  // waterline: Catmull-Rom through the columns
  float seg = uRes.x / (uN - 1.0);
  float f = p.x / seg;
  float i = floor(f);
  float u = f - i;
  float p0 = lineAt(i - 1.0), p1 = lineAt(i), p2 = lineAt(i + 1.0), p3 = lineAt(i + 2.0);
  float sy = 0.5 * (2.0 * p1 + (-p0 + p2) * u + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * u * u
    + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * u * u * u);
  float dsy = 0.5 * ((-p0 + p2) + 2.0 * (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * u
    + 3.0 * (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * u * u) / seg;
  float d = (p.y - sy) * inversesqrt(1.0 + dsy * dsy); // + below the surface
  float under = smoothstep(-0.6, 0.6, d);
  float depth = max(p.y - sy, 0.0);

  // ripple grid
  vec4 r = bicubic(uRip, p / uRipSize, uRipTex);
  vec2 g = (r.gb - 0.5) * 0.6;
  float lap = (r.a - 0.5) * 0.024;

  // four analytic swells (amplitude px, wave vector 1/px, angular speed), with the
  // gradient and Hessian in closed form. They shoal: stronger near the line, calmer deep down.
  vec3 hs = vec3(lap * 0.2, lap * 0.2, 0.0); // ripple part, taken as isotropic and softened
  float sw = 0.75 + 0.25 * exp(-depth / 260.0);
  // a slow domain warp keeps the net from reading as a lattice
  vec2 q = p + vec2(sin(p.y * 0.0072 + uTime * 0.6), sin(p.x * 0.0061 - uTime * 0.5 + 1.3)) * 26.0;
  swell(vec2(0.0336, 0.0102), 1.78, uTime * 1.9, sw, q, g, hs);
  swell(vec2(-0.0111, 0.0447), 1.03, uTime * -2.2, sw, q, g, hs);
  swell(vec2(0.0413, -0.0443), 0.59, uTime * 2.6, sw, q, g, hs);
  swell(vec2(-0.0541, -0.0622), 0.33, uTime * -3.1, sw, q, g, hs);
  lap = hs.x + hs.y;

  vec4 col = vec4(0.0);

  // refracted copy of the hero image while the water is thick
  if (uImgOn > 0.001) {
    vec2 q = p + g * 34.0 * uClar;
    vec2 c = (q - uImgRect.xy) / uImgRect.zw;
    vec2 hs = uImgRect.zw * 0.5;
    vec2 e = abs(q - uImgRect.xy - hs) - hs + 12.0;
    float sd = length(max(e, 0.0)) + min(max(e.x, e.y), 0.0) - 12.0;
    float m = clamp(0.5 - sd, 0.0, 1.0) * uImgOn * under;
    vec2 iuv = vec2(0.5 + (c.x - 0.5) * uImgScale.x, c.y * uImgScale.y);
    vec3 img = texture2D(uImg, clamp(iuv, 0.0, 1.0)).rgb;
    col = vec4(img * m, m);
  }

  // warm absorption: thin water is amber-clear, deep water goes to dark umber
  float ta = uClar * under * (0.16 + 0.5 * (1.0 - exp(-depth / 340.0)));
  // a faint dark lip under the meniscus where the surface bends light away
  float lip = (depth - 4.0) / 3.0;
  ta += uClar * under * 0.22 * exp(-lip * lip);
  ta = min(ta, 0.82);
  vec3 tint = vec3(0.16, 0.115, 0.06) * exp(-depth * vec3(0.0011, 0.0016, 0.0026));
  col = vec4(tint * ta + col.rgb * (1.0 - ta), ta + col.a * (1.0 - ta));

  vec3 light = vec3(0.0);
  // caustics from the curvature: light focused by the surface lens. -lap is the first-order
  // term; the full Jacobian of the refraction map turns the blobs into a filament net.
  float D = 400.0;
  float det = (1.0 + D * hs.x) * (1.0 + D * hs.y) - D * D * hs.z * hs.z;
  float cs = max(1.0 / max(abs(det), 0.05) - 1.4, 0.0) * 0.16 + max(-lap * 40.0, 0.0);
  cs = cs * cs / (1.0 + 0.6 * cs);
  float cm = 0.14 + 0.86 * exp(-depth / 220.0);
  light += vec3(1.0, 0.84, 0.56) * cs * cm * 0.06 * uClar * under;
  // volume scatter, so deep water still reads as a lit body
  light += vec3(0.89, 0.70, 0.40) * 0.04 * exp(-depth / 520.0) * uClar * under;
  // lens lift just under the surface
  light += vec3(1.0, 0.88, 0.66) * (exp(-depth / 9.0) * 0.16 + exp(-depth / 46.0) * 0.07) * under * uClar;
  // glint
  vec3 n = normalize(vec3(-g * 3.2, 1.0));
  float sp = pow(max(dot(n, normalize(vec3(0.42, -0.62, 1.0))), 0.0), 300.0);
  light += vec3(1.0, 0.95, 0.85) * sp * 0.9 * under * uClar * cm;
  // meniscus: a bright 1.5 px line along the surface, a little hotter where it tilts
  float men = exp(-d * d / (1.5 * 1.5)) * (0.85 + min(abs(dsy) * 1.4, 0.5));
  light += vec3(1.0, 0.94, 0.80) * men;
  // faint glow above the line
  float da = min(d, 0.0);
  light += vec3(0.89, 0.76, 0.45) * (1.0 - under) * (exp(da / 7.0) * 0.12 + exp(da / 36.0) * 0.045);

  gl_FragColor = vec4(col.rgb + light, clamp(col.a, 0.0, 1.0));
}
`;

const PVERT = `
attribute vec4 aP;    // x, y, radius, alpha (CSS px)
attribute vec3 aK;    // kind (0 bubble, 1 drop), velocity (px/s)
uniform vec2 uRes;
uniform float uDpr;
uniform float uMaxSize;
varying float vA;
varying float vK;
varying float vR;      // radius, CSS px
varying float vL;      // half-length of the motion streak
varying vec2 vDir;
varying float vSize;   // sprite size, CSS px
void main() {
  vA = aP.w; vK = aK.x; vR = aP.z;
  float sp = length(aK.yz);
  vDir = sp > 1.0 ? aK.yz / sp : vec2(0.0, 1.0);
  // drops stretch along their motion: a capsule, not a dot
  vL = vK > 0.5 ? min(sp * 0.0035, aP.z * 1.3) : 0.0;
  float size = min((aP.z + vL) * 2.0 + 3.0, uMaxSize / uDpr);
  vSize = size;
  gl_PointSize = size * uDpr;
  gl_Position = vec4(aP.x / uRes.x * 2.0 - 1.0, 1.0 - aP.y / uRes.y * 2.0, 0.0, 1.0);
}
`;

const PFRAG = `
precision mediump float;
varying float vA;
varying float vK;
varying float vR;
varying float vL;
varying vec2 vDir;
varying float vSize;
void main() {
  vec2 l = (gl_PointCoord - 0.5) * vSize;
  float t = clamp(dot(l, vDir), -vL, vL);
  vec2 q = (l - vDir * t) / vR;
  float rr = length(q);
  float edge = clamp((1.0 - rr) * vR, 0.0, 1.0);
  if (edge <= 0.0) discard;
  vec3 n = vec3(q, sqrt(max(1.0 - rr * rr, 0.0)));
  float fres = pow(1.0 - n.z, 2.0);
  float spec = pow(max(dot(n, normalize(vec3(-0.45, -0.6, 1.0))), 0.0), 60.0);
  vec4 c;
  if (vK < 0.5) {
    // bubble: a thin glass circle, almost all rim and highlight
    float a = (0.06 + fres * 0.45) * edge * vA;
    vec3 rgb = vec3(1.0, 0.92, 0.76) * (fres * 0.6 + spec * 1.0) * edge * vA;
    c = vec4(rgb, a * 0.4);
  } else {
    // drop: a gold-tinted glass bead with a hot highlight and a lit rim
    float a = (0.55 + fres * 0.45) * edge * vA;
    vec3 body = vec3(0.89, 0.76, 0.45) * (0.45 + 0.55 * fres) * a;
    vec3 rgb = body + vec3(1.0, 0.97, 0.9) * (spec * 1.4 + fres * 0.3) * edge * vA;
    // light focused through the bead onto its far side
    rgb += vec3(1.0, 0.86, 0.55) * pow(max(dot(n, normalize(vec3(0.45, 0.55, 1.0))), 0.0), 14.0) * 0.5 * edge * vA;
    c = vec4(rgb, a);
  }
  gl_FragColor = c;
}
`;

type Particle = {
  kind: 0 | 1;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
  age: number;
  seed: number;
  x0: number;
  crown: boolean;
};

type GLState = {
  gl: WebGLRenderingContext;
  water: WebGLProgram;
  points: WebGLProgram;
  quad: WebGLBuffer;
  pbuf: WebGLBuffer;
  lineTex: WebGLTexture;
  ripTex: WebGLTexture;
  imgTex: WebGLTexture;
  u: Record<string, WebGLUniformLocation | null>;
  pu: Record<string, WebGLUniformLocation | null>;
  aPos: number;
  aP: number;
  aK: number;
  maxPoint: number;
};

function compile(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram | null {
  const mk = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("flood shader", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };
  const v = mk(gl.VERTEX_SHADER, vs);
  const f = mk(gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return null;
  const p = gl.createProgram()!;
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.warn("flood link", gl.getProgramInfoLog(p));
    return null;
  }
  return p;
}

function texture(gl: WebGLRenderingContext, filter: number) {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);

export type FloodOptions = {
  origin: DOMRect | null;
  // The project hero, drawn refracted under the water while it is thick.
  image?: string | null;
  heroRect?: () => DOMRect | null;
};

type Phase = "idle" | "open" | "clear" | "close";

export class Flood {
  private canvas: HTMLCanvasElement;
  private sheet: HTMLElement;
  private opts: FloodOptions;
  private g: GLState | null = null;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private phase: Phase = "idle";
  private t = 0; // time in phase
  private clock = 0; // total sim time (swells)
  private W = 0;
  private H = 0;
  private dpr = 1;
  private onDone: (() => void) | null = null;

  // waterline
  private h = new Float32Array(N);
  private v = new Float32Array(N);
  private y = new Float32Array(N);
  private bell = new Float32Array(N);
  private L = 0;
  private LV = 0;
  private clar = 0;
  private clarFrom = 0;

  // ripple grid
  private GW = T.gridW;
  private GH = 0;
  private cell = 1;
  private rh = new Float32Array(0);
  private rv = new Float32Array(0);
  private rpix = new Uint8Array(0);
  private linePix = new Uint8Array(N * 4);

  private parts: Particle[] = [];
  private pdata = new Float32Array(MAX_PARTICLES * 7);
  private jetDone = false;
  private bubbleAcc = 0;

  private img: HTMLImageElement | null = null;
  private imgReady = false;
  private imgUploaded = false;

  constructor(canvas: HTMLCanvasElement, sheet: HTMLElement, opts: FloodOptions) {
    this.canvas = canvas;
    this.sheet = sheet;
    this.opts = opts;
    if (opts.image) {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        this.imgReady = true;
      };
      img.src = opts.image;
      this.img = img;
    }
  }

  get running() {
    return this.phase !== "idle";
  }

  // Water rises; the page shows below the line. Returns false if WebGL could not start.
  open(onDone?: () => void): boolean {
    if (!this.boot()) return false;
    this.onDone = onDone ?? null;
    const { H } = this;
    this.phase = "open";
    this.t = 0;
    this.clar = 1;
    this.jetDone = false;
    const A = T.bumpA * H;
    for (let i = 0; i < N; i++) {
      this.h[i] = -A * this.bell[i];
      this.v[i] = 0;
    }
    this.L = H * T.openStart + A;
    this.LV = T.openV0 * H;
    this.rh.fill(0);
    this.rv.fill(0);
    this.parts.length = 0;
    this.syncY();
    this.writeLine();
    this.applyClip();
    this.loop();
    return true;
  }

  // Water clouds over and drains away; `onDone` runs when the page is gone.
  drain(onDone: () => void): boolean {
    const wasIdle = this.phase === "idle";
    if (wasIdle && !this.boot()) return false;
    this.onDone = onDone;
    if (wasIdle) {
      this.L = T.closeStart * this.H;
      this.LV = 0;
      this.h.fill(0);
      this.v.fill(0);
      this.rh.fill(0);
      this.rv.fill(0);
      this.parts.length = 0;
      this.clar = 0;
    }
    this.clarFrom = this.clar;
    this.phase = "close";
    this.t = 0;
    this.syncY();
    this.writeLine();
    this.applyClip();
    if (wasIdle) this.loop();
    return true;
  }

  // Stop drawing the refracted hero (e.g. the page moved on to another project mid-flood).
  dropImage() {
    this.imgReady = false;
    this.img = null;
  }

  destroy() {
    this.stop();
    this.sheet.style.clipPath = "";
    this.onDone = null;
  }

  // ---------------------------------------------------------------- setup

  private boot(): boolean {
    const rect = this.sheet.getBoundingClientRect();
    this.W = Math.max(1, rect.width || window.innerWidth);
    this.H = Math.max(1, rect.height || window.innerHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    if (!this.g && !this.initGL()) return false;
    const g = this.g!;
    if (g.gl.isContextLost()) {
      this.g = null;
      return false;
    }
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.canvas.style.visibility = "visible";

    const { W } = this;
    const ox = this.opts.origin ? this.opts.origin.left + this.opts.origin.width / 2 : W / 2;
    const sigma = Math.max(T.bumpSigma * W, 120);
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1)) * W;
      this.bell[i] = Math.exp(-(((x - ox) / sigma) ** 2));
    }

    // ~64 cells across a desktop, but never cells under ~14 px (phones would turn to noise)
    this.GW = Math.max(24, Math.min(T.gridW, Math.round(W / 14)));
    this.cell = W / this.GW;
    const GH = Math.min(160, Math.max(16, Math.ceil(this.H / this.cell)));
    if (GH !== this.GH || this.rh.length !== this.GW * GH) {
      this.GH = GH;
      this.rh = new Float32Array(this.GW * GH);
      this.rv = new Float32Array(this.GW * GH);
      this.rpix = new Uint8Array(this.GW * GH * 4);
    }
    return true;
  }

  private initGL(): boolean {
    const gl = this.canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) return false;
    const water = compile(gl, VERT, FRAG);
    const points = compile(gl, PVERT, PFRAG);
    if (!water || !points) return false;
    const quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const pbuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, pbuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.pdata.byteLength, gl.DYNAMIC_DRAW);
    const names = [
      "uRes", "uDpr", "uLine", "uN", "uRange", "uRip", "uRipSize", "uRipTex", "uTime", "uClar",
      "uImg", "uImgRect", "uImgScale", "uImgOn",
    ];
    const u: GLState["u"] = {};
    for (const n of names) u[n] = gl.getUniformLocation(water, n);
    const pu: GLState["pu"] = {};
    for (const n of ["uRes", "uDpr", "uMaxSize"]) pu[n] = gl.getUniformLocation(points, n);
    const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array;
    this.g = {
      gl,
      water,
      points,
      quad,
      pbuf,
      lineTex: texture(gl, gl.NEAREST),
      ripTex: texture(gl, gl.LINEAR),
      imgTex: texture(gl, gl.LINEAR),
      u,
      pu,
      aPos: gl.getAttribLocation(water, "aPos"),
      aP: gl.getAttribLocation(points, "aP"),
      aK: gl.getAttribLocation(points, "aK"),
      maxPoint: range ? range[1] : 64,
    };
    this.imgUploaded = false;
    return true;
  }

  // Stop the loop and free the GPU side (the context stays with the canvas for next time).
  private stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.phase = "idle";
    const g = this.g;
    if (g && !g.gl.isContextLost()) {
      const { gl } = g;
      gl.deleteProgram(g.water);
      gl.deleteProgram(g.points);
      gl.deleteBuffer(g.quad);
      gl.deleteBuffer(g.pbuf);
      gl.deleteTexture(g.lineTex);
      gl.deleteTexture(g.ripTex);
      gl.deleteTexture(g.imgTex);
    }
    this.g = null;
    this.canvas.width = 1;
    this.canvas.height = 1;
    this.canvas.style.visibility = "hidden";
    this.parts.length = 0;
  }

  private finish() {
    const done = this.onDone;
    this.onDone = null;
    this.sheet.style.clipPath = "";
    this.stop();
    done?.();
  }

  // ---------------------------------------------------------------- loop

  private loop() {
    this.last = performance.now();
    this.acc = 0;
    const frame = (now: number) => {
      if (this.phase === "idle") return;
      const dt = Math.min((now - this.last) / 1000, 1 / 20);
      this.last = now;
      this.acc += dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 6) {
        this.step(STEP);
        this.acc -= STEP;
        steps++;
        if (!this.running) return;
      }
      if (steps === 6) this.acc = 0;
      if (this.g?.gl.isContextLost()) {
        this.finish();
        return;
      }
      this.writeLine();
      if (this.phase === "open" || this.phase === "close") this.applyClip();
      this.render();
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  // One fixed step of everything.
  private step(dt: number) {
    const { W, H } = this;
    this.t += dt;
    this.clock += dt;
    const t = this.t;

    // level
    let target = this.L;
    if (this.phase === "open" || this.phase === "clear") target = T.openTarget * H;
    else if (this.phase === "close") target = t > T.closeDelay ? T.closeTarget * H : T.closeStart * H;
    const K = T.levelK;
    const C = 2 * T.levelZeta * Math.sqrt(K);
    this.LV += (K * (target - this.L) - C * this.LV) * dt;
    this.L += this.LV * dt;

    // equilibrium of the columns: the inflow mound (open) or the lingering pool (close)
    let bumpAmp = 0;
    if (this.phase === "open") bumpAmp = -T.bumpA * H * Math.exp(-t / T.bumpTau);
    else if (this.phase === "close") bumpAmp = -T.drainA * H * (1 - Math.exp(-Math.max(t - T.closeDelay, 0) / T.drainTau));

    const { h, v, y, bell } = this;
    // lateral wave speed is set in px/s, so the surface behaves the same on any width
    const dx = W / (N - 1);
    const spread = Math.min((T.colWaveSpeed / dx) ** 2, T.colSpreadMax);
    for (let i = 0; i < N; i++) {
      const l = (i > 0 ? h[i - 1] : h[i + 1]) + (i < N - 1 ? h[i + 1] : h[i - 1]) - 2 * h[i];
      v[i] += (-T.colK * (h[i] - bumpAmp * bell[i]) + spread * l - T.colDamp * v[i]) * dt;
    }
    for (let i = 0; i < N; i++) h[i] += v[i] * dt;
    // drizzle: never quite still, and the faster the level moves the more the surface churns
    const churn = 1 + Math.min(Math.abs(this.LV) / H, 2) * 2.5;
    if (Math.random() < T.drizzleRate * churn * dt) {
      const i = (Math.random() * N) | 0;
      this.kickLine((i / (N - 1)) * W, (Math.random() - 0.5) * 2 * T.drizzleKick * churn, 24);
    }
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < N; i++) {
      y[i] = this.L + h[i];
      if (y[i] < minY) minY = y[i];
      if (y[i] > maxY) maxY = y[i];
    }

    this.stepRipples(dt);
    this.stepParticles(dt);

    // phases
    if (this.phase === "open") {
      if (!this.jetDone) {
        const ox = this.opts.origin ? this.opts.origin.left + this.opts.origin.width / 2 : W / 2;
        const sy = this.surfaceAt(ox);
        if (sy < H - 24) {
          this.jetDone = true;
          this.jet(ox, sy);
        }
      }
      if (maxY < -6) {
        this.phase = "clear";
        this.t = 0;
        this.sheet.style.clipPath = "";
      }
    } else if (this.phase === "clear") {
      this.clar = 1 - easeInOut(clamp01(t / T.clearTime));
      if (t >= T.clearTime) this.finish();
    } else if (this.phase === "close") {
      const k = clamp01(t / T.cloudTime);
      this.clar = this.clarFrom + (1 - this.clarFrom) * (1 - (1 - k) * (1 - k));
      const airborne = this.parts.some((p) => p.kind === 1);
      if (minY > H + 6 && !airborne) this.finish();
    }
  }

  private syncY() {
    for (let i = 0; i < N; i++) this.y[i] = this.L + this.h[i];
  }

  private surfaceAt(x: number) {
    const f = Math.min(Math.max((x / this.W) * (N - 1), 0), N - 1);
    const i = Math.min(Math.floor(f), N - 2);
    const u = f - i;
    return this.y[i] * (1 - u) + this.y[i + 1] * u;
  }

  private stepRipples(dt: number) {
    const { GW, GH, rh, rv, cell } = this;
    const churn = Math.min(Math.abs(this.LV) / this.H, 2.5) * 0.9;
    for (let cx = 0; cx < GW; cx++) {
      const sy = this.surfaceAt((cx + 0.5) * cell);
      const j0 = Math.max(0, Math.ceil(sy / cell - 0.5));
      for (let j = 0; j < Math.min(j0, GH); j++) {
        rh[j * GW + cx] = 0;
        rv[j * GW + cx] = 0;
      }
      // the moving meniscus stirs the cells just under it
      if (j0 < GH) {
        const ci = Math.min(N - 1, Math.round(((cx + 0.5) / GW) * (N - 1)));
        const idx = j0 * GW + cx;
        rv[idx] += ((Math.random() - 0.5) * churn * 60 + this.v[ci] * 0.05) * dt * 60;
      }
    }
    const c2 = T.ripC2;
    for (let j = 0; j < GH; j++) {
      const up = j > 0 ? -GW : GW;
      const dn = j < GH - 1 ? GW : -GW;
      for (let x = 0; x < GW; x++) {
        const i = j * GW + x;
        const l = x > 0 ? rh[i - 1] : rh[i + 1];
        const r = x < GW - 1 ? rh[i + 1] : rh[i - 1];
        const lap = l + r + rh[i + up] + rh[i + dn] - 4 * rh[i];
        rv[i] += (c2 * lap - T.ripDamp * rv[i]) * dt;
      }
    }
    for (let i = 0; i < rh.length; i++) rh[i] += rv[i] * dt;
  }

  private inject(x: number, y: number, amp: number, radius: number) {
    const { GW, GH, cell, rh } = this;
    const cx = x / cell - 0.5;
    const cy = y / cell - 0.5;
    const R = Math.ceil(radius * 2);
    for (let j = Math.max(0, Math.floor(cy - R)); j <= Math.min(GH - 1, Math.ceil(cy + R)); j++) {
      for (let i = Math.max(0, Math.floor(cx - R)); i <= Math.min(GW - 1, Math.ceil(cx + R)); i++) {
        const d2 = ((i - cx) ** 2 + (j - cy) ** 2) / (radius * radius);
        rh[j * GW + i] += amp * Math.exp(-d2);
      }
    }
  }

  // Impulse (px/s) on the columns around x, with a width in px. Narrow screens get gentler kicks,
  // since the same px width covers more columns there.
  private kickLine(x: number, impulse: number, widthPx: number) {
    const c = (x / this.W) * (N - 1);
    const width = Math.max(widthPx / (this.W / (N - 1)), 0.8);
    impulse *= Math.min(Math.max(this.W / 1200, 0.45), 1);
    for (let i = Math.max(0, Math.floor(c - width * 2)); i <= Math.min(N - 1, Math.ceil(c + width * 2)); i++) {
      this.v[i] += impulse * Math.exp(-(((i - c) / width) ** 2));
    }
  }

  private spawn(p: Omit<Particle, "age" | "seed" | "x0">) {
    if (this.parts.length >= MAX_PARTICLES) return;
    this.parts.push({ ...p, age: 0, seed: Math.random() * 100, x0: p.x });
  }

  // A short jet thrown up where the water first breaks the bottom edge.
  private jet(x: number, y: number) {
    const s = Math.min(Math.max(this.H / 900, 0.7), 1.35);
    for (let k = 0; k < 9; k++) {
      this.spawn({
        kind: 1,
        x: x + (Math.random() - 0.5) * 30,
        y,
        vx: (Math.random() - 0.5) * 520 * s,
        vy: -(1500 + Math.random() * 1300) * s,
        r: 3.5 + Math.random() * 4.5,
        a: 1,
        crown: true,
      });
    }
    this.kickLine(x, -380, 40);
  }

  private stepParticles(dt: number) {
    const { H, W } = this;
    const under = this.phase !== "idle";
    // bubbles: entrained by the inflow on open, rising out of the body otherwise
    if (under) {
      const rate = this.phase === "open" ? 70 : this.phase === "close" ? 26 : 22 * this.clar;
      this.bubbleAcc += rate * dt;
      while (this.bubbleAcc >= 1) {
        this.bubbleAcc -= 1;
        const ox = this.opts.origin ? this.opts.origin.left + this.opts.origin.width / 2 : W / 2;
        const x = this.phase === "open" && Math.random() < 0.65 ? ox + (Math.random() - 0.5) * 0.4 * W : Math.random() * W;
        const sy = this.surfaceAt(x);
        if (sy > H - 8) continue;
        const top = Math.max(sy + 30, 0);
        const yy = this.phase === "open" ? top + Math.random() * (H + 20 - top) : H + 10;
        if (yy < top) continue;
        this.spawn({
          kind: 0,
          x,
          y: yy,
          vx: 0,
          vy: this.phase === "open" ? this.LV * 0.45 : -60,
          r: 1.5 + Math.random() * Math.random() * 5,
          a: 0,
          crown: false,
        });
      }
    }
    const g = T.gravity;
    for (let n = this.parts.length - 1; n >= 0; n--) {
      const p = this.parts[n];
      p.age += dt;
      const sy = this.surfaceAt(p.x);
      if (p.kind === 0) {
        // buoyancy, drag and wobble
        const buoy = 260 + p.r * 120;
        p.vy += (-buoy - 3.2 * p.vy) * dt;
        p.y += p.vy * dt;
        p.x = p.x0 + Math.sin(p.age * (7 + p.seed * 0.05) + p.seed) * (1.5 + p.r * 0.9);
        p.a = Math.min(1, p.age * 6) * (this.phase === "clear" ? this.clar : 1);
        if (p.y - p.r < sy) {
          if (p.y + p.r > sy - 2 && p.r > 2.2) {
            this.inject(p.x, sy + this.cell, -0.9 - p.r * 0.25, 1.1);
            this.kickLine(p.x, 30 + p.r * 10, 14);
          }
          this.parts.splice(n, 1);
        } else if (p.y > H + 60 || p.age > 4) this.parts.splice(n, 1);
      } else {
        p.vy += g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.age > 0.04 && p.y > sy) {
          // splash: a crater ring in the body, a dip in the line, and a crown of droplets
          this.inject(p.x, Math.max(sy, 0) + this.cell * 0.8, -(2.2 + p.r * 0.7), 1.4);
          this.kickLine(p.x, Math.abs(p.vy) * 0.05 + p.r * 14, 18);
          if (p.crown && p.r > 2.5) {
            const m = 3 + ((Math.random() * 3) | 0);
            for (let k = 0; k < m; k++) {
              const ang = -Math.PI / 2 + ((k / (m - 1)) - 0.5) * 1.9 + (Math.random() - 0.5) * 0.3;
              const sp = 260 + Math.random() * 280;
              this.spawn({
                kind: 1,
                x: p.x,
                y: sy - 1,
                vx: Math.cos(ang) * sp,
                vy: Math.sin(ang) * sp - Math.max(-this.LV, 0) * 0.6,
                r: 1.1 + Math.random() * 1.4,
                a: 1,
                crown: false,
              });
            }
          }
          this.parts.splice(n, 1);
        } else if (p.y > H + 40 || p.x < -40 || p.x > W + 40 || p.age > 3) this.parts.splice(n, 1);
      }
    }
  }

  // ---------------------------------------------------------------- output

  private writeLine() {
    const { H, linePix } = this;
    const lo = -H;
    const span = 3 * H;
    for (let i = 0; i < N; i++) {
      const v = Math.round(clamp01((this.y[i] - lo) / span) * 65535);
      linePix[i * 4] = v >> 8;
      linePix[i * 4 + 1] = v & 255;
    }
  }

  // The page exists only below the surface.
  private applyClip() {
    const { W, H, y } = this;
    const M = Math.min(240, Math.max(48, Math.round(W / 7)));
    const pts: string[] = [];
    for (let k = 0; k <= M; k++) {
      const x = (k / M) * W;
      const f = (k / M) * (N - 1);
      const i = Math.min(Math.floor(f), N - 2);
      const u = f - i;
      const p0 = y[Math.max(i - 1, 0)], p1 = y[i], p2 = y[i + 1], p3 = y[Math.min(i + 2, N - 1)];
      const yy =
        0.5 *
        (2 * p1 +
          (-p0 + p2) * u +
          (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u +
          (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
      pts.push(`${x.toFixed(1)}px ${Math.min(Math.max(yy, -2), H + 2).toFixed(1)}px`);
    }
    pts.push(`${W}px ${H + 10}px`, `0px ${H + 10}px`);
    this.sheet.style.clipPath = `polygon(${pts.join(",")})`;
  }

  private render() {
    const g = this.g;
    if (!g) return;
    const { gl } = g;
    const { W, H, dpr, GW, GH, rh, rpix, cell } = this;

    // pack the ripple field: height, gradient, laplacian
    const inv2c = 1 / (2 * cell);
    const invc2 = 1 / (cell * cell);
    for (let j = 0; j < GH; j++) {
      for (let x = 0; x < GW; x++) {
        const i = j * GW + x;
        const l = x > 0 ? rh[i - 1] : rh[i];
        const r = x < GW - 1 ? rh[i + 1] : rh[i];
        const u = j > 0 ? rh[i - GW] : rh[i];
        const d = j < GH - 1 ? rh[i + GW] : rh[i];
        const o = i * 4;
        rpix[o] = 128 + Math.max(-127, Math.min(127, rh[i] * 16)) | 0;
        rpix[o + 1] = (clamp01(0.5 + ((r - l) * inv2c) / 0.6) * 255) | 0;
        rpix[o + 2] = (clamp01(0.5 + ((d - u) * inv2c) / 0.6) * 255) | 0;
        rpix[o + 3] = (clamp01(0.5 + ((l + r + u + d - 4 * rh[i]) * invc2) / 0.024) * 255) | 0;
      }
    }

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    gl.useProgram(g.water);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, g.lineTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.linePix);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, g.ripTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, GW, GH, 0, gl.RGBA, gl.UNSIGNED_BYTE, rpix);

    let imgOn = 0;
    const rect = this.opts.heroRect?.();
    if (this.imgReady && this.img && rect && rect.width > 0) {
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, g.imgTex);
      if (!this.imgUploaded) {
        try {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.img);
          this.imgUploaded = true;
        } catch {
          this.imgReady = false;
        }
      }
      if (this.imgUploaded) {
        // "thick" water: full while flooding and draining, gone as it clears
        imgOn = 0.85 * this.clar;
        const ia = this.img.naturalWidth / Math.max(1, this.img.naturalHeight);
        const ra = rect.width / rect.height;
        gl.uniform4f(g.u.uImgRect, rect.left, rect.top, rect.width, rect.height);
        gl.uniform2f(g.u.uImgScale, ia > ra ? ra / ia : 1, ia > ra ? 1 : ia / ra);
      }
    }
    gl.uniform1i(g.u.uLine, 0);
    gl.uniform1i(g.u.uRip, 1);
    gl.uniform1i(g.u.uImg, 2);
    gl.uniform1f(g.u.uImgOn, imgOn);
    gl.uniform2f(g.u.uRes, W, H);
    gl.uniform1f(g.u.uDpr, this.canvas.width / W);
    gl.uniform1f(g.u.uN, N);
    gl.uniform2f(g.u.uRange, -H, 3 * H);
    gl.uniform2f(g.u.uRipSize, GW * cell, GH * cell);
    gl.uniform2f(g.u.uRipTex, GW, GH);
    gl.uniform1f(g.u.uTime, this.clock);
    gl.uniform1f(g.u.uClar, this.clar);
    gl.bindBuffer(gl.ARRAY_BUFFER, g.quad);
    gl.enableVertexAttribArray(g.aPos);
    gl.vertexAttribPointer(g.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(g.aPos);

    // drops and bubbles
    const parts = this.parts;
    if (parts.length) {
      const pd = this.pdata;
      let n = 0;
      for (const p of parts) {
        if (n >= MAX_PARTICLES) break;
        const o = n * 7;
        pd[o] = p.x;
        pd[o + 1] = p.y;
        pd[o + 2] = p.r;
        pd[o + 3] = p.a;
        pd[o + 4] = p.kind;
        pd[o + 5] = p.kind === 1 ? p.vx : 0;
        pd[o + 6] = p.kind === 1 ? p.vy : 0;
        n++;
      }
      gl.useProgram(g.points);
      gl.uniform2f(g.pu.uRes, W, H);
      gl.uniform1f(g.pu.uDpr, dpr);
      gl.uniform1f(g.pu.uMaxSize, g.maxPoint);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.pbuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, pd.subarray(0, n * 7));
      gl.enableVertexAttribArray(g.aP);
      gl.enableVertexAttribArray(g.aK);
      gl.vertexAttribPointer(g.aP, 4, gl.FLOAT, false, 28, 0);
      gl.vertexAttribPointer(g.aK, 3, gl.FLOAT, false, 28, 16);
      gl.drawArrays(gl.POINTS, 0, n);
      gl.disableVertexAttribArray(g.aP);
      gl.disableVertexAttribArray(g.aK);
    }
  }
}
