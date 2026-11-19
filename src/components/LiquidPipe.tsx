"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

// A glass tube in the left margin that fills with liquid gold as the page scrolls.
// Raw WebGL1: one full-canvas fragment shader in CSS-pixel space (y down); all motion
// (level spring, 1D surface waves, bubbles) runs in JS at a fixed 120 Hz step.

const QUERY = "(min-width: 1280px) and (hover: hover)";
const REDUCED = "(prefers-reduced-motion: reduce)";

// Colours in linear RGB, derived from --color-gold oklch(0.82 0.11 85) ≈ sRGB(0.90, 0.75, 0.43).
const GOLD = [0.782, 0.519, 0.152];
const GOLD_LIGHT = [0.9, 0.6, 0.18];
const GOLD_DEEP = [0.39, 0.15, 0.017];
const GLASS = [1.0, 0.97, 0.92]; // warm white, sRGB

const WIDTH = 44; // canvas width, CSS px
const TOP = 84; // tube top, below the 56px nav
const BOTTOM = 36; // tube gap to the viewport bottom
const R = 7; // outer radius
const WALL = 1.5;
const RI = R - WALL;

const COLS = 16;
const MAX_BUBBLES = 14;
const STEP = 1 / 120;

// Level spring: underdamped (zeta ~0.55) so a fast scroll overshoots and settles.
const LEVEL_K = 64;
const LEVEL_D = 8.8;
// Surface: v += (-k*h + spread*lap - damp*v - kick*accel*profile) * dt, h in px (up = +).
const SURF_K = 14;
const SURF_SPREAD = 30 * 30;
const SURF_DAMP = 0.9;
const SURF_KICK = 0.012;
const SURF_MAX = 4.5;
// Bubbles: buoyancy against linear drag gives a terminal speed of BUOY / DRAG px/s.
const BUOY = 330;
const DRAG = 6;
const BUBBLE_BASE_RATE = 0.12; // per second
const BUBBLE_VEL_RATE = 7; // per second, per unit of |level velocity|
const POP_KICK = 7;

const vec3 = (c: number[]) => `vec3(${c.map((v) => v.toFixed(4)).join(",")})`;

const VERT = `attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.,1.);}`;

const FRAG = `precision highp float;
uniform vec2 uSize;
uniform float uDpr;
uniform vec2 uSpan;
uniform float uLevelY;
uniform float uH[${COLS}];
uniform vec4 uB[${MAX_BUBBLES}];
uniform float uT;

const float R = ${R.toFixed(1)};
const float WALL = ${WALL.toFixed(1)};
const float RI = ${RI.toFixed(1)};
const vec3 GOLD = ${vec3(GOLD)};
const vec3 LIGHT = ${vec3(GOLD_LIGHT)};
const vec3 DEEP = ${vec3(GOLD_DEEP)};
const vec3 GLASS = ${vec3(GLASS)};

float surfaceH(float x) {
  float f = clamp((x + RI) / (2. * RI), 0., 1.) * ${(COLS - 1).toFixed(1)};
  float h = 0.;
  for (int i = 0; i < ${COLS}; i++) h += uH[i] * max(0., 1. - abs(f - float(i)));
  return h;
}

vec3 toSrgb(vec3 c) { return pow(clamp(c, 0., 1.), vec3(1. / 2.2)); }

void main() {
  vec2 p = vec2(gl_FragCoord.x, uSize.y * uDpr - gl_FragCoord.y) / uDpr;
  float x = p.x - uSize.x * .5;
  float aa = 1. / uDpr;

  vec2 q = vec2(x, p.y - clamp(p.y, uSpan.x + R, uSpan.y - R));
  float lq = length(q);
  float d = lq - R;
  if (d > 1.5) { gl_FragColor = vec4(0.); return; }
  vec2 g = q / max(lq, 1e-4);
  float outer = clamp(.5 - d / aa, 0., 1.);
  float di = d + WALL;
  float inner = clamp(.5 - di / aa, 0., 1.);

  // Surface: resting level, wave columns and a concave meniscus climbing the walls.
  float u = clamp(x / RI, -1., 1.);
  float sy = uLevelY - surfaceH(x) - 1.3 * pow(abs(u), 3.);
  float depth = p.y - sy;
  float liq = inner * clamp(depth / aa + .5, 0., 1.);

  vec3 col = vec3(0.);
  float alpha = 0.;

  if (liq > 0.) {
    float nz = sqrt(max(1. - u * u, 0.));
    float k = clamp(depth / 360., 0., 1.);
    vec3 base = mix(LIGHT, GOLD, smoothstep(0., .1, k));
    base = mix(base, DEEP, smoothstep(.1, 1., k) * .8);
    // Cylinder: dark reflective walls, bright core offset toward the light.
    float shade = mix(.05, 1., pow(nz, 1.8)) * (1. - .22 * u);
    vec3 c = base * shade;
    c += LIGHT * exp(-pow((u + .3) / .16, 2.)) * .22;
    c = mix(c, DEEP * .3, smoothstep(.35, 1., abs(u)) * .8);
    // Caustic bands drifting upward.
    float band = sin(p.y * .085 + uT * 1.5 + sin(p.y * .021 - uT * .45) * 2.6 + u * 1.3);
    c += LIGHT * smoothstep(.55, 1., band) * .1 * nz;
    // Just below the surface the liquid catches more light.
    c = mix(c, LIGHT * 1.1, exp(-max(depth, 0.) / 2.2) * .35);

    for (int i = 0; i < ${MAX_BUBBLES}; i++) {
      vec4 b = uB[i];
      if (b.w <= 0.) continue;
      vec2 bp = vec2(x, p.y) - b.xy;
      float dist = length(bp);
      float inside = clamp((b.z - dist) / aa + .5, 0., 1.);
      float ring = exp(-pow((dist - b.z + .35) / .3, 2.));
      // Rim is brightest toward the light (top-left), darker underneath.
      float lit = clamp(.5 - dot(bp / max(dist, 1e-3), vec2(.7, .7)) * .5, 0., 1.);
      vec2 sp = bp + b.z * vec2(.4, .4);
      float spec = exp(-dot(sp, sp) / (.05 * b.z * b.z + .03));
      c = mix(c, c * 1.3 + LIGHT * .1, inside * b.w * .85);
      c = mix(c, DEEP * .6, ring * (1. - lit) * .5 * b.w);
      c += vec3(1., .94, .78) * (ring * lit * .9 + spec * 1.3) * b.w;
    }

    col = toSrgb(c);
    float meniscus = exp(-pow(depth / .7, 2.));
    col += vec3(1., .93, .74) * meniscus * .85 * inner;
    col *= liq;
    alpha = liq;
  }

  // Glass: narrow dome normal from the SDF.
  float s = clamp(-d / (R * .85), 0., 1.);
  float h = sqrt(1. - (1. - s) * (1. - s));
  vec3 n = normalize(vec3(g * (1. - h), h + .04));
  vec3 L = normalize(vec3(-.55, -.5, .7));
  vec3 H = normalize(L + vec3(0., 0., 1.));
  float nh = max(dot(n, H), 0.);
  float spec = pow(nh, 90.) * 1.4 + pow(nh, 30.) * .15;
  float fres = pow(1. - n.z, 3.) * .55;
  float rim = (1. - smoothstep(0., .55, abs(d + .45))) * .2;
  float innerRim = (1. - smoothstep(0., .5, abs(di + .2))) * .07;
  float along = smoothstep(uSpan.x + 4., uSpan.x + 26., p.y) * (1. - smoothstep(uSpan.y - 26., uSpan.y - 4., p.y));
  float streak = exp(-pow((x + R * .5) / .55, 2.)) * .5 * along
               + exp(-pow((x - R * .62) / .45, 2.)) * .1 * along;
  float wallBand = clamp(.5 + di / aa, 0., 1.);

  float ga = (.035 + wallBand * .07 + fres) * outer;
  col = col * (1. - ga) + GLASS * ga;
  alpha = alpha + ga * (1. - alpha);

  // Faint gold glow just above the surface, inside the glass.
  float above = sy - p.y;
  float glow = above > 0. ? exp(-above / 5.) * .22 * inner * step(uSpan.x, sy) : 0.;
  col += vec3(.95, .76, .4) * glow;
  alpha = max(alpha, glow);

  vec3 add = GLASS * (spec + rim + streak) * outer + GLASS * innerRim * outer;
  col += add;
  alpha = min(1., alpha + dot(add, vec3(.33)) * .5);
  gl_FragColor = vec4(col, alpha);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn(gl.getShaderInfoLog(sh));
    return null;
  }
  return sh;
}

/** Starts the pipe on a canvas. Returns a cleanup, or null if WebGL is unavailable. */
function mountPipe(canvas: HTMLCanvasElement): (() => void) | null {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, antialias: false, alpha: true });
  if (!gl) return null;
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  if (!vs || !fs || !prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const loc = (name: string) => gl.getUniformLocation(prog, name);
  const uSize = loc("uSize");
  const uDpr = loc("uDpr");
  const uSpan = loc("uSpan");
  const uLevelY = loc("uLevelY");
  const uH = loc("uH[0]");
  const uB = loc("uB[0]");
  const uT = loc("uT");

  let cssH = 0;
  let dpr = 1;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    cssH = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(WIDTH * dpr);
    canvas.height = Math.round(cssH * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  resize();

  const target = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  };

  // Liquid spans the inner capsule: level 0 = empty, 1 = full.
  const innerTop = () => TOP + WALL;
  const innerBot = () => cssH - BOTTOM - WALL;
  const levelY = (lv: number) => innerBot() - lv * (innerBot() - innerTop());

  let level = target();
  let vel = 0;
  let time = 0;

  const h = new Float32Array(COLS);
  const hv = new Float32Array(COLS);
  // Kick profile: a mean-free centre bulge plus a slight tilt, so the surface rocks.
  const profile = new Float32Array(COLS);
  let mean = 0;
  for (let i = 0; i < COLS; i++) {
    const x = ((i + 0.5) / COLS) * 2 - 1;
    profile[i] = Math.cos(Math.PI * x) + 0.45 * Math.sin((Math.PI * x) / 2);
    mean += profile[i] / COLS;
  }
  for (let i = 0; i < COLS; i++) profile[i] -= mean;

  const bx0 = new Float32Array(MAX_BUBBLES);
  const by = new Float32Array(MAX_BUBBLES);
  const bvy = new Float32Array(MAX_BUBBLES);
  const br = new Float32Array(MAX_BUBBLES);
  const bph = new Float32Array(MAX_BUBBLES);
  const bfq = new Float32Array(MAX_BUBBLES);
  const bAge = new Float32Array(MAX_BUBBLES);
  const bLive = new Uint8Array(MAX_BUBBLES);
  const bUniform = new Float32Array(MAX_BUBBLES * 4);
  let spawnAcc = 0;

  const colAt = (x: number) =>
    Math.min(COLS - 1, Math.max(0, Math.round(((x + RI) / (2 * RI)) * (COLS - 1))));

  const spawn = () => {
    const surf = levelY(level);
    const bottom = innerBot();
    if (bottom - surf < 10) return;
    for (let i = 0; i < MAX_BUBBLES; i++) {
      if (bLive[i]) continue;
      const r = 1 + Math.random() * 1.1;
      br[i] = r;
      bx0[i] = (Math.random() * 2 - 1) * (RI - r - 1.4);
      by[i] = bottom - r - 1.5 - Math.random() * 3;
      bvy[i] = 0;
      bph[i] = Math.random() * Math.PI * 2;
      bfq[i] = 2.5 + Math.random() * 2.5;
      bAge[i] = 0;
      bLive[i] = 1;
      return;
    }
  };

  const step = (dt: number) => {
    const accel = LEVEL_K * (target() - level) - LEVEL_D * vel;
    vel += accel * dt;
    level += vel * dt;
    time += dt;
    const span = innerBot() - innerTop();
    const accelPx = accel * span;

    for (let i = 0; i < COLS; i++) {
      const l = h[i > 0 ? i - 1 : 0];
      const r = h[i < COLS - 1 ? i + 1 : COLS - 1];
      const lap = l + r - 2 * h[i];
      hv[i] += (-SURF_K * h[i] + SURF_SPREAD * lap - SURF_DAMP * hv[i] - SURF_KICK * accelPx * profile[i]) * dt;
    }
    for (let i = 0; i < COLS; i++) {
      h[i] = Math.max(-SURF_MAX, Math.min(SURF_MAX, h[i] + hv[i] * dt));
    }

    spawnAcc += (BUBBLE_BASE_RATE + BUBBLE_VEL_RATE * Math.abs(vel)) * dt;
    while (spawnAcc >= 1) {
      spawnAcc -= 1;
      spawn();
    }
    const surf = levelY(level);
    for (let i = 0; i < MAX_BUBBLES; i++) {
      if (!bLive[i]) continue;
      bvy[i] += (-BUOY - DRAG * bvy[i]) * dt;
      by[i] += bvy[i] * dt;
      bAge[i] += dt;
      const x = bx0[i] + Math.sin(time * bfq[i] + bph[i]) * 0.7;
      const c = colAt(x);
      if (by[i] - br[i] * 0.5 <= surf - h[c] || by[i] > innerBot()) {
        bLive[i] = 0;
        hv[c] -= POP_KICK * br[i];
        if (c > 0) hv[c - 1] -= POP_KICK * br[i] * 0.4;
        if (c < COLS - 1) hv[c + 1] -= POP_KICK * br[i] * 0.4;
      }
    }
  };

  const render = () => {
    for (let i = 0; i < MAX_BUBBLES; i++) {
      const o = i * 4;
      if (!bLive[i]) {
        bUniform[o + 3] = 0;
        continue;
      }
      // Bubbles swell slightly as they rise.
      const rise = Math.max(0, innerBot() - by[i]) / 600;
      bUniform[o] = bx0[i] + Math.sin(time * bfq[i] + bph[i]) * 0.7;
      bUniform[o + 1] = by[i];
      bUniform[o + 2] = br[i] * (1 + 0.25 * Math.min(rise, 1));
      bUniform[o + 3] = Math.min(1, bAge[i] / 0.25);
    }
    gl.uniform2f(uSize, WIDTH, cssH);
    gl.uniform1f(uDpr, dpr);
    gl.uniform2f(uSpan, TOP, cssH - BOTTOM);
    gl.uniform1f(uLevelY, levelY(level));
    gl.uniform1fv(uH, h);
    gl.uniform4fv(uB, bUniform);
    gl.uniform1f(uT, time);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  // 2 = level or surface moving, 1 = only bubbles rising, 0 = still.
  const activity = () => {
    if (Math.abs(vel) > 1e-4 || Math.abs(target() - level) > 2e-4) return 2;
    let energy = 0;
    for (let i = 0; i < COLS; i++) energy += hv[i] * hv[i] + SURF_K * h[i] * h[i];
    if (energy > 2e-3) return 2;
    for (let i = 0; i < MAX_BUBBLES; i++) if (bLive[i]) return 1;
    return 0;
  };

  let raf = 0;
  let last = 0;
  let lastDraw = 0;
  let acc = 0;
  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    acc += dt;
    while (acc >= STEP) {
      step(STEP);
      acc -= STEP;
    }
    const state = activity();
    // Slow idle bubbles only need ~30 fps.
    if (state !== 1 || now - lastDraw > 30) {
      render();
      lastDraw = now;
    }
    raf = state ? requestAnimationFrame(frame) : 0;
  };
  const wake = () => {
    if (raf || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  let idle = 0;
  const scheduleIdle = () => {
    idle = window.setTimeout(() => {
      if (!document.hidden) {
        spawn();
        wake();
      }
      scheduleIdle();
    }, 2000 + Math.random() * 2000);
  };
  scheduleIdle();

  const onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else wake();
  };
  const onResize = () => {
    resize();
    render();
    wake();
  };

  window.addEventListener("scroll", wake, { passive: true });
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisibility);
  render();
  wake();

  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(idle);
    window.removeEventListener("scroll", wake);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
    gl.deleteProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    gl.deleteBuffer(buf);
  };
}

const subscribe = (onChange: () => void) => {
  const queries = [window.matchMedia(QUERY), window.matchMedia(REDUCED)];
  for (const q of queries) q.addEventListener("change", onChange);
  return () => {
    for (const q of queries) q.removeEventListener("change", onChange);
  };
};
const getSnapshot = () => window.matchMedia(QUERY).matches && !window.matchMedia(REDUCED).matches;
const getServerSnapshot = () => false;

export default function LiquidPipe() {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!enabled || !canvas) return;
    const cleanup = mountPipe(canvas);
    // No WebGL: show nothing.
    if (!cleanup) canvas.style.display = "none";
    return cleanup ?? undefined;
  }, [enabled]);

  if (!enabled) return null;
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed top-0 z-30 h-screen"
      style={{ left: "calc((100vw - 72rem) / 4 - 22px)", width: WIDTH }}
    />
  );
}
