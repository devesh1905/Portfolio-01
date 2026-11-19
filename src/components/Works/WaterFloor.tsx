"use client";
/* eslint-disable react-hooks/immutability --
   a render loop mutates three.js uniforms, buffers and refs every frame by design. */

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// A pool of dark water under the gallery.
//
// Two things make it read as water rather than a shiny floor:
// 1. A height-field ripple simulation (the classic two-buffer wave equation) runs on the CPU
//    at a fixed 120 Hz. The cursor, the moving strip and falling drops push it.
// 2. The shader derives all the light from that surface: the slope bends the reflection and
//    the floor grid underneath, the curvature focuses light into caustics, and a very tight
//    specular adds glints. A few analytic swells keep it alive when nothing touches it.
//
// The reflection is the mirrored card copies (layer 1) rendered into a texture just before the
// water draws, then sampled in screen space and bent by the surface normal.

export const REFLECTION_LAYER = 1;

const X0 = -9;
const Z0 = -9;
const SX = 18;
const SZ = 11.5;
const GW = 144; // grid cells across
const GH = 92;
const CELL = SX / GW;
const STEP = 1 / 120; // fixed physics step
const WAVE_SPEED = 3.2; // world units per second
const DAMP = 0.55;
const GRAVITY = 7.5;

const vertex = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vPos, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D uH;
  uniform sampler2D uRefl;
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uOffset;
  uniform float uR;
  uniform vec3 uGold;
  uniform vec3 uDeep;
  varying vec3 vPos;

  float gridLine(float v, float spacing) {
    float g = abs(fract(v / spacing - 0.5) - 0.5) / fwidth(v / spacing);
    return 1.0 - min(g, 1.0);
  }

  void main() {
    vec2 uv = (vPos.xz - vec2(${X0.toFixed(1)}, ${Z0.toFixed(1)})) / vec2(${SX.toFixed(1)}, ${SZ.toFixed(1)});
    vec2 t = vec2(1.0 / ${GW.toFixed(1)}, 1.0 / ${GH.toFixed(1)});
    float hc = texture2D(uH, uv).r;
    float hl = texture2D(uH, uv - vec2(t.x, 0.0)).r;
    float hr = texture2D(uH, uv + vec2(t.x, 0.0)).r;
    float hd = texture2D(uH, uv - vec2(0.0, t.y)).r;
    float hu = texture2D(uH, uv + vec2(0.0, t.y)).r;
    float cell = ${CELL.toFixed(4)};
    vec2 grad = vec2(hr - hl, hu - hd) / (2.0 * cell);
    float lap = (hl + hr + hd + hu - 4.0 * hc) / (cell * cell);

    // Slow analytic swells (closed-form slope and curvature) so the caustics never freeze.
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      vec2 dir = normalize(vec2(cos(fi * 2.1 + 0.4), sin(fi * 2.1 + 0.4)));
      float k = 1.7 + fi * 0.9;
      float amp = 0.0025 / (1.0 + fi * 0.6);
      float ph = dot(dir, vPos.xz) * k - sqrt(2.9 * k) * uTime;
      grad += amp * k * cos(ph) * dir;
      lap -= amp * k * k * sin(ph);
    }

    vec3 N = normalize(vec3(-grad.x * 2.4, 1.0, -grad.y * 2.4));
    vec3 V = normalize(cameraPosition - vPos);
    float ndv = max(dot(N, V), 0.0);
    float fres = 0.12 + 0.88 * pow(1.0 - ndv, 3.0);

    // Reflection of the cards, bent by the surface, with a hint of dispersion.
    vec2 suv = gl_FragCoord.xy / uRes;
    vec2 o = vec2(N.x, -N.z) * 0.065;
    vec4 r0 = texture2D(uRefl, suv + o);
    vec3 refl = vec3(r0.r, texture2D(uRefl, suv + o * 1.07).g, texture2D(uRefl, suv + o * 1.15).b);
    refl += uDeep * (1.0 - r0.a);

    // The old floor grid, now lying under the water: shifted by refraction, lit by caustics.
    float depth = 0.45;
    vec2 bed = vPos.xz - vec2(N.x, N.z) * depth * 2.2;
    float rad = length(bed);
    float ang = atan(bed.x, -bed.y);
    float line = max(gridLine(ang * uR + uOffset, 0.62), gridLine(rad, 0.62));
    float c = max(-lap * 1.1, 0.0);
    c = c * c / (1.0 + 0.6 * c);
    float path = depth / max(ndv, 0.12);
    vec3 bedCol = uDeep + uGold * (line * 0.09 + c * 0.45);
    bedCol *= exp(-path * vec3(0.55, 0.75, 1.15)); // warm water: blue goes first, gold stays

    vec3 col = mix(bedCol, refl, fres);

    // Glints: a light low behind the gallery, mirrored in the ripples.
    // High enough that the flat surface never catches it; only ripple faces sparkle.
    vec3 L = normalize(vec3(-0.3, 1.25, -1.0));
    float spec = pow(max(dot(reflect(-V, N), L), 0.0), 300.0);
    col += spec * 1.8 * vec3(1.0, 0.9, 0.7);

    float r = length(vPos.xz);
    float a = atan(vPos.x, -vPos.z);
    float fade = smoothstep(${(5.6 + 3.2).toFixed(1)}, ${(5.6 - 0.6).toFixed(1)}, r) * smoothstep(0.4, 2.6, r)
      * (1.0 - smoothstep(0.72, 1.15, abs(a)));
    gl_FragColor = vec4(col, fade * 0.96);
    #include <colorspace_fragment>
  }
`;

// Gold drops drawn as glass beads: a dome normal across each point sprite, refraction of a
// warm gradient, a fresnel rim and a tight highlight from the top left.
const dropVertex = /* glsl */ `
  attribute float aSize;
  varying float vAlive;
  void main() {
    vAlive = aSize > 0.0 ? 1.0 : 0.0;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (1500.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const dropFragment = /* glsl */ `
  uniform vec3 uGold;
  varying float vAlive;
  void main() {
    if (vAlive < 0.5) discard;
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    p.y = -p.y;
    float d = length(p) - 0.92;
    float px = fwidth(d);
    float inside = 1.0 - smoothstep(-px, px, d);
    if (inside <= 0.0) discard;
    float s = clamp(-d / 0.6, 0.0, 1.0);
    float h = sqrt(1.0 - (1.0 - s) * (1.0 - s));
    vec3 n = normalize(vec3(normalize(p + 1e-4) * (1.0 - h), h + 0.04));
    vec2 q = p - n.xy * 0.45;
    vec3 col = mix(uGold * 0.55, uGold * 1.25, smoothstep(-1.0, 0.8, -q.y));
    col += pow(1.0 - n.z, 3.0) * vec3(1.0, 0.95, 0.85) * 0.5;
    col += pow(max(dot(n, normalize(vec3(-0.45, 0.6, 0.65) + vec3(0.0, 0.0, 1.0))), 0.0), 90.0) * 1.6;
    col += (1.0 - smoothstep(0.0, 0.06, abs(d + 0.05))) * 0.25;
    gl_FragColor = vec4(col, inside);
    #include <colorspace_fragment>
  }
`;

type Drop = { x: number; y: number; z: number; vx: number; vy: number; vz: number; size: number; delay: number; crown: boolean };

const MAX_DROPS = 40;

export type WaterControls = {
  // A point on the water the cursor is over (world xz), or null.
  pointer: { current: THREE.Vector2 | null };
  // Arc speed of the strip, for a faint wake along the front of the cards.
  speed: { current: number };
  // Called to drop gold into the pool: once when the gallery comes into view, and on clicks.
  dropAt: { current: ((x: number, z: number) => void) | null };
  pour: { current: (() => void) | null };
};

class Ripples {
  h = new Float32Array(GW * GH);
  v = new Float32Array(GW * GH);
  energy = 0;

  step(dt: number) {
    const { h, v } = this;
    const c2 = (WAVE_SPEED * WAVE_SPEED) / (CELL * CELL);
    let e = 0;
    for (let y = 1; y < GH - 1; y++) {
      for (let x = 1; x < GW - 1; x++) {
        const i = y * GW + x;
        const lap = h[i - 1] + h[i + 1] + h[i - GW] + h[i + GW] - 4 * h[i];
        v[i] += (c2 * lap - DAMP * v[i]) * dt;
      }
    }
    for (let i = 0; i < h.length; i++) {
      h[i] += v[i] * dt;
      e += Math.abs(v[i]);
    }
    // Reflecting edges: copy the neighbour so rings bounce back.
    for (let x = 0; x < GW; x++) {
      h[x] = h[x + GW];
      h[(GH - 1) * GW + x] = h[(GH - 2) * GW + x];
    }
    for (let y = 0; y < GH; y++) {
      h[y * GW] = h[y * GW + 1];
      h[y * GW + GW - 1] = h[y * GW + GW - 2];
    }
    this.energy = e;
  }

  // Push the surface down in a soft disc (a negative velocity kick makes a ring).
  poke(wx: number, wz: number, amount: number, radius: number) {
    const cx = (wx - X0) / CELL;
    const cz = (wz - Z0) / CELL;
    const rc = radius / CELL;
    const r = Math.ceil(rc * 2.5);
    for (let y = Math.max(1, Math.floor(cz - r)); y <= Math.min(GH - 2, Math.ceil(cz + r)); y++) {
      for (let x = Math.max(1, Math.floor(cx - r)); x <= Math.min(GW - 2, Math.ceil(cx + r)); x++) {
        const d2 = ((x - cx) ** 2 + (y - cz) ** 2) / (rc * rc);
        this.v[y * GW + x] -= amount * Math.exp(-d2);
      }
    }
  }
}

export default function WaterFloor({
  y,
  offset,
  controls,
  gold,
  deep,
}: {
  y: number;
  offset: { current: number };
  controls: WaterControls;
  gold: THREE.Color;
  deep: THREE.Color;
}) {
  const sim = useMemo(() => new Ripples(), []);
  const half = useMemo(() => new Uint16Array(GW * GH), []);
  const heightTex = useMemo(() => {
    const t = new THREE.DataTexture(half, GW, GH, THREE.RedFormat, THREE.HalfFloatType);
    t.minFilter = t.magFilter = THREE.LinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  }, [half]);
  const reflection = useMemo(() => new THREE.WebGLRenderTarget(2, 2, { depthBuffer: true }), []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uH: { value: heightTex },
          uRefl: { value: reflection.texture },
          uRes: { value: new THREE.Vector2(1, 1) },
          uTime: { value: 0 },
          uOffset: { value: 0 },
          uR: { value: 5.6 },
          uGold: { value: gold },
          uDeep: { value: deep },
        },
      }),
    [heightTex, reflection, gold, deep]
  );

  // Drops: a fixed pool of points; size 0 means unused.
  const drops = useMemo<Drop[]>(() => [], []);
  const dropGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX_DROPS * 3), 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(MAX_DROPS), 1));
    return g;
  }, []);
  const dropMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: dropVertex,
        fragmentShader: dropFragment,
        transparent: true,
        depthWrite: false,
        uniforms: { uGold: { value: gold } },
      }),
    [gold]
  );

  useEffect(() => {
    const spawn = (x: number, z: number, height: number, delay: number) => {
      if (drops.length >= MAX_DROPS) return;
      drops.push({ x, y: height, z, vx: 0, vy: 0, vz: 0, size: 0.13 + Math.random() * 0.06, delay, crown: false });
    };
    controls.dropAt.current = (x, z) => spawn(x, z, y + 2.6, 0);
    controls.pour.current = () => {
      for (let i = 0; i < 6; i++) {
        spawn(-2.6 + i * 1.05 + (Math.random() - 0.5) * 0.4, -2.4 - Math.random() * 1.6, y + 2.8 + Math.random(), i * 0.16);
      }
    };
    return () => {
      controls.dropAt.current = null;
      controls.pour.current = null;
    };
  }, [controls, drops, y]);

  useEffect(
    () => () => {
      heightTex.dispose();
      reflection.dispose();
      material.dispose();
      dropGeometry.dispose();
      dropMaterial.dispose();
    },
    [heightTex, reflection, material, dropGeometry, dropMaterial]
  );

  const clock = useMemo(() => ({ acc: 0, last: null as THREE.Vector2 | null }), []);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uOffset.value = offset.current;

    // Cursor: a trail of small rings while it moves over the water.
    const p = controls.pointer.current;
    if (p && clock.last) {
      const moved = Math.min(p.distanceTo(clock.last), 0.4);
      if (moved > 0.002) sim.poke(p.x, p.y, moved * 9, 0.15);
    }
    clock.last = p ? p.clone() : null;

    // Wake: the moving strip disturbs the water just in front of the cards.
    const sp = controls.speed.current;
    if (Math.abs(sp) > 0.05) {
      for (let a = -0.9; a <= 0.9; a += 0.18) {
        const rr = 5.6 - 0.35;
        sim.poke(rr * Math.sin(a), -rr * Math.cos(a), Math.min(Math.abs(sp), 6) * 0.004, 0.22);
      }
    }

    // Drops: ballistic fall, a splash ring where they land, and a small crown of droplets.
    const pos = dropGeometry.attributes.position.array as Float32Array;
    const size = dropGeometry.attributes.aSize.array as Float32Array;
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      if (d.delay > 0) {
        d.delay -= dt;
        continue;
      }
      d.vy -= GRAVITY * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;
      if (d.y <= y) {
        sim.poke(d.x, d.z, d.crown ? 0.5 : 2.4, d.crown ? 0.08 : 0.17);
        if (!d.crown) {
          for (let k = 0; k < 5; k++) {
            const ang = (k / 5) * Math.PI * 2 + Math.random();
            if (drops.length < MAX_DROPS) {
              drops.push({
                x: d.x,
                y: y + 0.01,
                z: d.z,
                vx: Math.cos(ang) * (0.35 + Math.random() * 0.3),
                vy: 1.4 + Math.random() * 0.9,
                vz: Math.sin(ang) * (0.35 + Math.random() * 0.3),
                size: 0.045 + Math.random() * 0.03,
                delay: 0,
                crown: true,
              });
            }
          }
        }
        drops.splice(i, 1);
      }
    }
    for (let i = 0; i < MAX_DROPS; i++) {
      const d = drops[i];
      const live = d && d.delay <= 0;
      pos[i * 3] = live ? d.x : 0;
      pos[i * 3 + 1] = live ? d.y : -99;
      pos[i * 3 + 2] = live ? d.z : 0;
      size[i] = live ? d.size : 0;
    }
    dropGeometry.attributes.position.needsUpdate = true;
    dropGeometry.attributes.aSize.needsUpdate = true;

    // Fixed-step physics, then upload only while something is moving.
    clock.acc += dt;
    let steps = 0;
    while (clock.acc >= STEP && steps < 6) {
      sim.step(STEP);
      clock.acc -= STEP;
      steps++;
    }
    if (sim.energy > 0.02 || steps === 0) {
      for (let i = 0; i < sim.h.length; i++) half[i] = THREE.DataUtils.toHalfFloat(sim.h[i]);
      heightTex.needsUpdate = true;
    }
  });

  // Render the mirrored cards into the reflection texture right before the water draws, with
  // the same camera, so the reflection lines up in screen space.
  const onBeforeRender = useMemo(
    () => (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) => {
      const size = renderer.getDrawingBufferSize(new THREE.Vector2());
      material.uniforms.uRes.value.copy(size);
      const w = Math.max(2, Math.round(size.x * 0.5));
      const h = Math.max(2, Math.round(size.y * 0.5));
      if (reflection.width !== w || reflection.height !== h) reflection.setSize(w, h);
      const prevTarget = renderer.getRenderTarget();
      const prevMask = camera.layers.mask;
      const prevColor = renderer.getClearColor(new THREE.Color());
      const prevAlpha = renderer.getClearAlpha();
      camera.layers.set(REFLECTION_LAYER);
      renderer.setRenderTarget(reflection);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(prevTarget);
      renderer.setClearColor(prevColor, prevAlpha);
      camera.layers.mask = prevMask;
    },
    [material, reflection]
  );

  return (
    <>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, y, Z0 + SZ / 2]}
        material={material}
        onBeforeRender={onBeforeRender as unknown as THREE.Object3D["onBeforeRender"]}
        renderOrder={-2}
      >
        <planeGeometry args={[SX, SZ]} />
      </mesh>
      <points geometry={dropGeometry} material={dropMaterial} frustumCulled={false} renderOrder={2} />
    </>
  );
}
