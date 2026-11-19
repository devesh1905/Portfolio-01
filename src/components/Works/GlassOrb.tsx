"use client";
/* eslint-disable react-hooks/immutability --
   the render loop mutates uniforms and render targets every frame by design. */

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// The gallery cursor as a drop of glass. The scene is rendered into a texture first, then one
// full-screen pass copies it to the screen and, inside the orb, bends it like a lens: the
// middle magnifies, the rim refracts hard with a little dispersion, and the orb picks up a
// fresnel sheen, a tight highlight from the top left, a thin rim line and a warm caustic at the
// bottom where light comes through. It squashes along its direction of travel and turns gold
// over a card (the "View" state). Ported from the launcher's glass-drop orb shader.

export type OrbState = {
  x: number; // stage CSS px
  y: number;
  vx: number; // px per second
  vy: number;
  visible: boolean;
  mode: "drag" | "view" | "dragging";
};

const RADIUS = { drag: 38, view: 48, dragging: 30 }; // CSS px

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D uScene;
  uniform vec2 uRes;      // drawing buffer px
  uniform vec2 uC;        // orb centre, buffer px, y up
  uniform float uR;       // radius, buffer px
  uniform vec2 uDir;      // direction of travel
  uniform float uStretch; // 0..0.35
  uniform float uShow;    // 0..1
  uniform float uGold;    // 0..1, over a card
  uniform float uTime;
  uniform vec3 uGoldCol;
  uniform vec3 uDeep;
  varying vec2 vUv;

  float shape(vec2 p) {
    // Squash along the direction of travel, plus a slow living wobble.
    vec2 q = vec2(dot(p, uDir), dot(p, vec2(-uDir.y, uDir.x)));
    q.x /= 1.0 + uStretch;
    q.y /= 1.0 - uStretch * 0.55;
    float a = atan(q.y, q.x);
    float wob = 0.012 * sin(3.0 * a + uTime * 1.7) + 0.007 * sin(5.0 * a - uTime * 2.3);
    return length(q) - 1.0 - wob;
  }

  vec4 scene(vec2 px) {
    return texture2D(uScene, clamp(px / uRes, vec2(0.001), vec2(0.999)));
  }

  void main() {
    vec4 base = texture2D(uScene, vUv);
    vec2 fc = gl_FragCoord.xy;
    vec2 p = (fc - uC) / uR;
    p.y = -p.y; // y down inside the orb, like the original shader
    float d = shape(p);
    float px = 1.5 / uR;
    float inside = (1.0 - smoothstep(-px, px, d)) * uShow;

    // Soft contact shadow under the orb so it sits above the scene.
    float shadow = exp(-max(shape(p - vec2(0.0, 0.18)), 0.0) * 5.0) * 0.28 * uShow * (1.0 - inside);
    base.rgb *= 1.0 - shadow;
    base.a = max(base.a, shadow);

    if (inside <= 0.001) {
      gl_FragColor = base;
      #include <colorspace_fragment>
      return;
    }

    vec2 e = vec2(0.01, 0.0);
    vec2 g = vec2(shape(p + e.xy) - shape(p - e.xy), shape(p + e.yx) - shape(p - e.yx));
    g /= length(g) + 1e-5;
    float s = clamp(-d / 0.62, 0.0, 1.0);
    float h = sqrt(1.0 - (1.0 - s) * (1.0 - s));
    vec3 n = normalize(vec3(g * (1.0 - h), h + 0.04));

    // Lens: magnify the middle, bend hard at the rim, split channels slightly.
    vec2 toC = fc - uC;
    vec2 off = vec2(-n.x, n.y) * 0.5 * uR;
    vec2 src = uC + toC * 0.78 + off;
    vec4 r0 = scene(src);
    vec3 col = vec3(r0.r, scene(uC + toC * 0.78 + off * 1.1).g, scene(uC + toC * 0.78 + off * 1.22).b);
    col += uDeep * (1.0 - r0.a);
    col *= 1.06;

    // Gold glass over a card.
    col = mix(col, col * mix(vec3(1.0), uGoldCol, 0.6) * 1.15 + uGoldCol * 0.05, uGold);

    vec3 warm = vec3(1.0, 0.95, 0.86);
    col += pow(1.0 - n.z, 3.0) * mix(warm, uGoldCol * 1.2, uGold) * (0.6 + uGold * 0.35);
    vec3 H = normalize(vec3(-0.45, -0.6, 0.65) + vec3(0.0, 0.0, 1.0));
    col += pow(max(dot(n, H), 0.0), 90.0) * 1.5;
    col += pow(max(dot(n, normalize(vec3(0.5, 0.55, 0.7) + vec3(0.0, 0.0, 1.0))), 0.0), 30.0) * 0.18;
    col += (1.0 - smoothstep(0.0, 0.03, abs(d + 0.04))) * 0.24 * warm;
    // Caustic crescent: light focused through the drop onto its lower inside edge.
    float crescent = smoothstep(0.35, 0.95, p.y) * smoothstep(-0.02, -0.25, d);
    col += crescent * mix(warm, uGoldCol, 0.6) * 0.22;

    gl_FragColor = vec4(mix(base.rgb, col, inside), max(base.a, inside));
    #include <colorspace_fragment>
  }
`;

export default function GlassOrb({ orb }: { orb: { current: OrbState } }) {
  const { gl, size } = useThree();
  const target = useMemo(
    () => new THREE.WebGLRenderTarget(2, 2, { samples: 4, depthBuffer: true }),
    []
  );
  const quad = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uScene: { value: target.texture },
        uRes: { value: new THREE.Vector2(1, 1) },
        uC: { value: new THREE.Vector2() },
        uR: { value: 40 },
        uDir: { value: new THREE.Vector2(1, 0) },
        uStretch: { value: 0 },
        uShow: { value: 0 },
        uGold: { value: 0 },
        uTime: { value: 0 },
        uGoldCol: { value: new THREE.Color().setRGB(0.89, 0.76, 0.45, THREE.SRGBColorSpace) },
        uDeep: { value: new THREE.Color().setRGB(0.07, 0.063, 0.052, THREE.SRGBColorSpace) },
      },
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    mesh.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(mesh);
    return { scene, material, mesh, camera: new THREE.Camera() };
  }, [target]);

  useEffect(
    () => () => {
      target.dispose();
      quad.material.dispose();
      quad.mesh.geometry.dispose();
    },
    [target, quad]
  );

  // Springs for size, visibility and colour so every state change eases in.
  const st = useMemo(
    () => ({ r: { x: RADIUS.drag, v: 0 }, show: { x: 0, v: 0 }, gold: { x: 0, v: 0 }, dir: new THREE.Vector2(1, 0) }),
    []
  );

  // Priority 1: R3F stops its own render and this pass draws the frame.
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const o = orb.current;
    const spring = (s: { x: number; v: number }, to: number, k: number, c: number) => {
      s.v += (k * (to - s.x) - c * s.v) * dt;
      s.x += s.v * dt;
    };
    spring(st.r, RADIUS[o.mode], 260, 16);
    spring(st.show, o.visible ? 1 : 0, 220, 22);
    spring(st.gold, o.mode === "view" ? 1 : 0, 160, 20);

    const dpr = gl.getPixelRatio();
    const buf = gl.getDrawingBufferSize(new THREE.Vector2());
    if (target.width !== buf.x || target.height !== buf.y) target.setSize(buf.x, buf.y);

    const speed = Math.hypot(o.vx, o.vy);
    if (speed > 30) st.dir.set(o.vx, -o.vy).normalize();
    const u = quad.material.uniforms;
    u.uRes.value.copy(buf);
    u.uC.value.set(o.x * dpr, (size.height - o.y) * dpr);
    u.uR.value = Math.max(st.r.x, 1) * dpr;
    u.uDir.value.set(st.dir.x, -st.dir.y);
    u.uStretch.value = Math.min(speed / 2600, 0.35);
    u.uShow.value = THREE.MathUtils.clamp(st.show.x, 0, 1);
    u.uGold.value = THREE.MathUtils.clamp(st.gold.x, 0, 1);
    u.uTime.value = state.clock.elapsedTime;

    gl.setRenderTarget(target);
    gl.clear();
    gl.render(state.scene, state.camera);
    gl.setRenderTarget(null);
    gl.clear();
    gl.render(quad.scene, quad.camera);
  }, 1);

  return null;
}
