"use client";
/* eslint-disable react-hooks/immutability, react-hooks/refs, react-hooks/preserve-manual-memoization --
   a render loop mutates three.js uniforms, springs and refs every frame by design. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Project } from "@/lib/portfolio";

// Cards sit on the inside of a cylinder around the camera, like a curved wall of prints.
// Page scroll is the single source of truth for position: dragging and the buttons scroll
// the page, and the scene springs towards whatever the scroll position says.
//
// The strip behaves like cloth: a 1D spring-wave field running along the visible arc is
// pushed by drag/scroll speed near the cursor, so waves travel along the strip and bend the
// cards towards and away from the viewer. The cursor also presses a springy dent into the
// card under it.
const R = 5.6; // cylinder radius
const CAM_Z = 2.6; // camera sits this far behind the cylinder's centre
const W = 3.6; // card width (1.6:1, matches the 1200x750 screenshots)
const H = 2.25;
const GAP = 0.32;
const SPACING = W + GAP; // distance between card centres along the arc
const SCROLL_PER_CARD_VH = 32; // page scroll needed to move one card

const FLOOR_Y = -H / 2 - 0.4;

const FIELD = 64; // samples in the wave field
const A_MAX = 1.35; // the field covers angles -A_MAX..A_MAX (radians)

const vertexShader = /* glsl */ `
  uniform float uS;
  uniform float uR;
  uniform float uHover;
  uniform float uMirror; // 1 for the copy reflected in the floor
  uniform float uField[${FIELD}];
  uniform vec4 uCursor; // angle, y, strength, unused
  varying vec2 vUv;
  varying float vAngle;
  varying float vShade;

  float field(float a) {
    float x = clamp((a + ${A_MAX.toFixed(2)}) / ${(2 * A_MAX).toFixed(2)}, 0.0, 1.0) * ${(FIELD - 1).toFixed(1)};
    int i = int(floor(x));
    int j = min(i + 1, ${FIELD - 1});
    return mix(uField[i], uField[j], fract(x));
  }

  void main() {
    vUv = uv;
    float a = (uS + position.x) / uR;
    vec3 p = vec3(uR * sin(a), position.y, -uR * cos(a));
    vec3 inward = normalize(vec3(-sin(a), 0.0, cos(a)));
    float yn = position.y / ${(H / 2).toFixed(3)};

    // 1. Cloth wave along the strip; the slope twists the strip slightly around its length.
    float f = field(a);
    float slope = (field(a + 0.03) - field(a - 0.03)) / 0.06;
    float push = f * (1.0 + 0.45 * yn);
    p.y += slope * 0.12 * position.y;

    // 2. Each card pinches inwards at its middle, a second bend on top of the cylinder.
    float pinch = sin(uv.x * 3.14159) * 0.16;

    // 3. Springy dent under the cursor, plus a small lift for the hovered card.
    float dx = (a - uCursor.x) * uR;
    float dy = position.y - uCursor.y;
    float dent = uCursor.z * exp(-(dx * dx + dy * dy) / 0.55) * 0.42;

    p += inward * (push + uHover * 0.12 - pinch - dent);
    if (uMirror > 0.5) p.y = ${(2 * FLOOR_Y).toFixed(3)} - p.y;
    vAngle = uS / uR;
    // Faces turned towards the light read brighter; dents and troughs read darker.
    vShade = clamp(1.0 + push * 0.18 - dent * 0.5 - pinch * 0.3, 0.6, 1.15);
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uTex;
  uniform float uHover;
  uniform float uAlpha;
  uniform float uMirror;
  uniform vec2 uSize;
  varying vec2 vUv;
  varying float vAngle;
  varying float vShade;
  float roundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  void main() {
    vec2 local = (vUv - 0.5) * uSize;
    float d = roundedBox(local, uSize * 0.5, 0.09);
    float edge = fwidth(d);
    float alpha = 1.0 - smoothstep(-edge, edge, d);
    // Fade cards as they turn away at the sides.
    alpha *= (1.0 - smoothstep(0.75, 1.05, abs(vAngle))) * uAlpha;
    // The reflection shows only the edge nearest the floor, fading out quickly.
    alpha *= mix(1.0, (1.0 - smoothstep(0.0, 0.5, vUv.y)) * 0.3, uMirror);
    // A slight zoom inside the frame on hover.
    vec2 uv = (vUv - 0.5) * (1.0 - uHover * 0.04) + 0.5;
    vec3 col = texture2D(uTex, uv).rgb * mix(0.86, 1.0, uHover) * vShade;
    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
  }
`;

// Perspective grid on the floor, curved to follow the strip so it scrolls with it.
const floorVertex = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vPos, 1.0);
  }
`;
const floorFragment = /* glsl */ `
  uniform float uOffset;
  uniform vec3 uColor;
  varying vec3 vPos;
  float gridLine(float v, float spacing) {
    float g = abs(fract(v / spacing - 0.5) - 0.5) / fwidth(v / spacing);
    return 1.0 - min(g, 1.0);
  }
  void main() {
    float r = length(vPos.xz);
    float a = atan(vPos.x, -vPos.z);
    float s = a * ${R.toFixed(1)} + uOffset; // same arc units as the cards
    float line = max(gridLine(s, 0.62), gridLine(r, 0.62));
    float fade = smoothstep(${(R + 3).toFixed(1)}, ${(R - 1).toFixed(1)}, r) * smoothstep(0.2, 2.5, r)
      * (1.0 - smoothstep(0.7, 1.15, abs(a)));
    gl_FragColor = vec4(uColor, line * fade * 0.22);
    #include <colorspace_fragment>
  }
`;

// Typographic stand-in used until (or instead of) a screenshot loads.
function coverTexture(project: Project) {
  const c = document.createElement("canvas");
  c.width = 1200;
  c.height = 750;
  const ctx = c.getContext("2d")!;
  const css = getComputedStyle(document.documentElement);
  const color = (name: string, fallback: string) => {
    ctx.fillStyle = fallback;
    ctx.fillStyle = css.getPropertyValue(name).trim() || fallback;
  };
  color("--color-raised", "#26231f");
  ctx.fillRect(0, 0, 1200, 750);
  const serif = css.getPropertyValue("--font-serif").trim() || "Georgia, serif";
  const sans = css.getPropertyValue("--font-sans").trim() || "system-ui, sans-serif";
  color("--color-ink", "#f1eee8");
  ctx.font = `500 92px ${serif}`;
  ctx.fillText(project.title, 72, 560, 1056);
  color("--color-muted", "#c4bfb6");
  ctx.font = `400 40px ${sans}`;
  ctx.fillText(project.subtitle, 76, 640, 1050);
  color("--color-gold", "#e2bd6a");
  ctx.fillRect(76, 110, 72, 6);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

type Hit = { angle: number; y: number };

type Shared = {
  target: { current: number };
  hovered: { current: number };
  pointer: { current: THREE.Vector2 | null };
  pickRef: { current: ((ndc: THREE.Vector2) => number) | null };
  // Screen rectangle of a card, used as the start of the open transition.
  rectRef: { current: ((index: number) => DOMRect | null) | null };
  // Card currently shown in the detail page; it is hidden here while its image is "away".
  hidden: { current: string | null };
};

// Uniform objects shared by every card, so the field and cursor are uploaded once per frame.
type SharedUniforms = {
  uField: { value: Float32Array };
  uCursor: { value: THREE.Vector4 };
};

// Damped spring step; low damping gives the overshoot that makes motion feel squishy.
function spring(state: { x: number; v: number }, target: number, k: number, c: number, dt: number) {
  state.v += (k * (target - state.x) - c * state.v) * dt;
  state.x += state.v * dt;
}

function Card({
  project,
  index,
  shared,
  common,
}: {
  project: Project;
  index: number;
  shared: Shared;
  common: SharedUniforms;
}) {
  const geometry = useMemo(() => new THREE.PlaneGeometry(W, H, 64, 16), []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        uniforms: {
          uTex: { value: coverTexture(project) },
          uS: { value: 0 },
          uR: { value: R },
          uHover: { value: 0 },
          uMirror: { value: 0 },
          uAlpha: { value: 1 },
          uSize: { value: new THREE.Vector2(W, H) },
          uField: common.uField,
          uCursor: common.uCursor,
        },
      }),
    [project, common]
  );
  // Same uniform objects (so every update reaches both), mirrored and faded.
  const reflection = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { ...material.uniforms, uMirror: { value: 1 } },
      }),
    [material]
  );

  // Cards stay invisible until their screenshot (or, failing that, the cover) is ready,
  // then fade in one after another.
  const loaded = useRef(false);
  useEffect(() => {
    if (!project.image) {
      loaded.current = true;
      return;
    }
    let cancelled = false;
    new THREE.TextureLoader().load(
      project.image,
      (tex) => {
        if (cancelled) return tex.dispose();
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        material.uniforms.uTex.value.dispose();
        material.uniforms.uTex.value = tex;
        loaded.current = true;
      },
      undefined,
      () => {
        loaded.current = true; // keep the cover if the screenshot is missing
      }
    );
    return () => {
      cancelled = true;
    };
  }, [project.image, material]);

  useEffect(
    () => () => {
      material.uniforms.uTex.value.dispose();
      material.dispose();
      reflection.dispose();
      geometry.dispose();
    },
    [material, reflection, geometry]
  );

  const hover = useRef({ x: 0, v: 0 });
  const appear = useRef({ t: -index * 0.08 }); // seconds since ready, minus a stagger
  useFrame((_, dt) => {
    spring(hover.current, shared.hovered.current === index ? 1 : 0, 170, 14, Math.min(dt, 1 / 30));
    material.uniforms.uHover.value = hover.current.x;
    if (loaded.current) appear.current.t += Math.min(dt, 1 / 30);
    const fade = THREE.MathUtils.smoothstep(appear.current.t, 0, 0.6);
    material.uniforms.uAlpha.value = shared.hidden.current === project.id ? 0 : fade;
  });

  return (
    <group>
      <mesh geometry={geometry} material={material} frustumCulled={false} />
      <mesh geometry={geometry} material={reflection} frustumCulled={false} renderOrder={-1} />
    </group>
  );
}

function Floor({ offset }: { offset: { current: number } }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: floorVertex,
        fragmentShader: floorFragment,
        transparent: true,
        depthWrite: false,
        uniforms: { uOffset: { value: 0 }, uColor: { value: new THREE.Color(0.95, 0.93, 0.88) } },
      }),
    []
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => {
    material.uniforms.uOffset.value = offset.current;
  });
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, FLOOR_Y, 0]} material={material}>
      <planeGeometry args={[2 * (R + 3), 2 * (R + 3)]} />
    </mesh>
  );
}

function Scene({
  works,
  shared,
  onIndex,
}: {
  works: Project[];
  shared: Shared;
  onIndex: (i: number) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const current = useRef({ x: shared.target.current, v: 0 });
  const position = useMemo(() => ({ current: shared.target.current }), [shared]);
  const lastIndex = useRef(-1);
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);

  const common = useMemo<SharedUniforms>(
    () => ({ uField: { value: new Float32Array(FIELD) }, uCursor: { value: new THREE.Vector4() } }),
    []
  );
  const sim = useMemo(() => ({ d: new Float32Array(FIELD), v: new Float32Array(FIELD) }), []);
  const cursor = useRef({ a: { x: 0, v: 0 }, y: { x: 0, v: 0 }, s: { x: 0, v: 0 } });
  const cam = useRef({ x: { x: 0, v: 0 }, y: { x: 0, v: 0 } });

  // Ray against the cylinder (vertices move in the shader, so mesh raycasting can't be used).
  const cast = useCallback(
    (ndc: THREE.Vector2): Hit | null => {
      raycaster.setFromCamera(ndc, camera);
      const { origin: o, direction: d } = raycaster.ray;
      const a = d.x * d.x + d.z * d.z;
      const b = 2 * (o.x * d.x + o.z * d.z);
      const c = o.x * o.x + o.z * o.z - R * R;
      const disc = b * b - 4 * a * c;
      if (disc < 0) return null;
      const t = (-b + Math.sqrt(disc)) / (2 * a);
      const p = o.clone().addScaledVector(d, t);
      return { angle: Math.atan2(p.x, -p.z), y: p.y };
    },
    [camera, raycaster]
  );

  useEffect(() => {
    shared.pickRef.current = (ndc) => {
      const hit = cast(ndc);
      if (!hit || Math.abs(hit.y) > H / 2) return -1;
      const s = hit.angle * R + current.current.x;
      const i = Math.round(s / SPACING);
      if (i < 0 || i >= works.length || Math.abs(s - i * SPACING) > W / 2) return -1;
      return i;
    };
  }, [cast, shared, works.length]);

  // Project a card's corners and edge midpoints to client pixels and take their bounds.
  useEffect(() => {
    shared.rectRef.current = (index) => {
      const box = gl.domElement.getBoundingClientRect();
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const v = new THREE.Vector3();
      for (const dx of [-W / 2, 0, W / 2]) {
        for (const y of [-H / 2, H / 2]) {
          const a = (index * SPACING - current.current.x + dx) / R;
          v.set(R * Math.sin(a), y, -R * Math.cos(a)).project(camera);
          const x = box.left + ((v.x + 1) / 2) * box.width;
          const yy = box.top + ((1 - v.y) / 2) * box.height;
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, yy); maxY = Math.max(maxY, yy);
        }
      }
      return Number.isFinite(minX) ? new DOMRect(minX, minY, maxX - minX, maxY - minY) : null;
    };
  }, [camera, gl, shared]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const pos = current.current;
    const before = pos.x;
    spring(pos, shared.target.current, 60, 13, dt);
    position.current = pos.x;
    const speed = (pos.x - before) / Math.max(dt, 1e-4); // arc units per second

    const hit = shared.pointer.current ? cast(shared.pointer.current) : null;
    const hovered = shared.pointer.current ? shared.pickRef.current?.(shared.pointer.current) ?? -1 : -1;
    shared.hovered.current = hovered;

    // Cloth field: the drag speed pushes the strip near the cursor (or the centre), and a
    // damped wave equation carries that push sideways, giving the travelling S-bend.
    const centre = hit ? hit.angle : 0;
    const steps = 3;
    const h = dt / steps;
    for (let n = 0; n < steps; n++) {
      for (let i = 0; i < FIELD; i++) {
        const ai = -A_MAX + (2 * A_MAX * i) / (FIELD - 1);
        const left = sim.d[Math.max(i - 1, 0)];
        const right = sim.d[Math.min(i + 1, FIELD - 1)];
        const lap = left - 2 * sim.d[i] + right;
        const g = Math.exp(-(((ai - centre) / 0.38) ** 2));
        const force = -speed * 1.0 * g;
        sim.v[i] += (lap * 900 - sim.d[i] * 10 - sim.v[i] * 3.2 + force) * h;
      }
      for (let i = 0; i < FIELD; i++) {
        sim.d[i] = THREE.MathUtils.clamp(sim.d[i] + sim.v[i] * h, -1.7, 1.7);
      }
    }
    common.uField.value.set(sim.d);

    // Dent follows the cursor on springs, so it trails and wobbles when the cursor moves.
    const cs = cursor.current;
    if (hit) {
      spring(cs.a, hit.angle, 140, 15, dt);
      spring(cs.y, hit.y, 140, 15, dt);
    }
    spring(cs.s, hovered >= 0 ? 1 : 0, 200, 11, dt);
    common.uCursor.value.set(cs.a.x, cs.y.x, cs.s.x, 0);

    // Camera leans a little towards the cursor for parallax.
    const ndc = shared.pointer.current;
    spring(cam.current.x, ndc ? ndc.x * 0.35 : 0, 30, 9, dt);
    spring(cam.current.y, ndc ? ndc.y * 0.2 : 0, 30, 9, dt);
    camera.position.set(cam.current.x.x, cam.current.y.x, CAM_Z);
    camera.lookAt(0, 0, -R);

    group.current?.children.forEach((child, i) => {
      // uS is shared by the card and its reflection, so setting it on one moves both.
      const m = (child.children[0] as THREE.Mesh).material as THREE.ShaderMaterial;
      const s = i * SPACING - pos.x;
      m.uniforms.uS.value = s;
      child.visible = Math.abs(s / R) < 1.2;
    });

    const idx = THREE.MathUtils.clamp(Math.round(pos.x / SPACING), 0, works.length - 1);
    if (idx !== lastIndex.current) {
      lastIndex.current = idx;
      onIndex(idx);
    }
  });

  return (
    <>
      <Floor offset={position} />
      <group ref={group}>
        {works.map((p, i) => (
          <Card key={p.id} project={p} index={i} shared={shared} common={common} />
        ))}
      </group>
    </>
  );
}

export default function WorksGallery3D({
  works,
  onOpen,
  openId,
}: {
  works: Project[];
  onOpen: (p: Project, origin: DOMRect | null) => void;
  openId: string | null;
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [inView, setInView] = useState(false);
  const shared = useRef<Shared>({
    target: { current: 0 },
    hovered: { current: -1 },
    pointer: { current: null },
    pickRef: { current: null },
    rectRef: { current: null },
    hidden: { current: null },
  }).current;
  shared.hidden.current = openId;
  const open = (i: number) => onOpen(works[i], shared.rectRef.current?.(i) ?? null);
  const drag = useRef<{ x: number; moved: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const cursorEl = useRef<HTMLDivElement>(null);
  const ringEl = useRef<HTMLDivElement>(null);
  const cursorTarget = useRef<{ x: number; y: number } | null>(null);
  const maxArc = (works.length - 1) * SPACING;

  const scrollRange = () => {
    const el = wrapper.current!;
    return el.offsetHeight - window.innerHeight;
  };

  // Page scroll position inside the pinned wrapper -> target arc position.
  useEffect(() => {
    const onScroll = () => {
      const el = wrapper.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const progress = THREE.MathUtils.clamp(-top / scrollRange(), 0, 1);
      shared.target.current = progress * maxArc;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [maxArc, shared]);

  // Only render frames while the gallery is on screen.
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting));
    if (wrapper.current) io.observe(wrapper.current);
    return () => io.disconnect();
  }, []);

  // Label cursor: follows the pointer on a spring and stretches along its direction of travel.
  useEffect(() => {
    const x = { x: 0, v: 0 };
    const y = { x: 0, v: 0 };
    let raf = 0;
    let last = performance.now();
    let placed = false;
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const t = cursorTarget.current;
      if (t && cursorEl.current && ringEl.current) {
        if (!placed) {
          x.x = t.x;
          y.x = t.y;
          placed = true;
        }
        spring(x, t.x, 260, 24, dt);
        spring(y, t.y, 260, 24, dt);
        const speed = Math.hypot(x.v, y.v);
        const stretch = Math.min(speed / 2500, 0.35);
        cursorEl.current.style.transform = `translate(${x.x}px, ${y.x}px)`;
        cursorEl.current.style.opacity = "1";
        ringEl.current.style.transform = `rotate(${Math.atan2(y.v, x.v)}rad) scale(${1 + stretch}, ${1 - stretch * 0.6})`;
      } else {
        placed = false;
        if (cursorEl.current) cursorEl.current.style.opacity = "0";
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const goTo = useCallback(
    (i: number) => {
      const el = wrapper.current;
      if (!el) return;
      const clamped = THREE.MathUtils.clamp(i, 0, works.length - 1);
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top + (clamped / (works.length - 1)) * scrollRange(), behavior: "smooth" });
    },
    [works.length]
  );

  const toNdc = (e: React.PointerEvent) => {
    const r = stage.current!.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    shared.pointer.current = toNdc(e);
    const r = stage.current!.getBoundingClientRect();
    cursorTarget.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    setHovering((shared.pickRef.current?.(shared.pointer.current) ?? -1) >= 0);
    if (drag.current) {
      const dx = e.clientX - drag.current.x;
      drag.current.x = e.clientX;
      drag.current.moved += Math.abs(dx);
      // Dragging across the full stage moves about 2.5 cards.
      const arc = (-dx / stage.current!.clientWidth) * SPACING * 2.5;
      window.scrollBy({ top: (arc / maxArc) * scrollRange(), behavior: "instant" });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const wasClick = drag.current && drag.current.moved < 6;
    drag.current = null;
    setDragging(false);
    if (wasClick) {
      const i = shared.pickRef.current?.(toNdc(e)) ?? -1;
      if (i >= 0) open(i);
    }
  };

  const project = works[index];

  return (
    <div ref={wrapper} style={{ height: `calc(100vh + ${(works.length - 1) * SCROLL_PER_CARD_VH}vh)` }}>
      <div className="sticky top-14 flex h-[calc(100vh-3.5rem)] flex-col">
        <div
          ref={stage}
          className="relative min-h-0 flex-1 cursor-none touch-pan-y select-none"
          onPointerDown={(e) => {
            drag.current = { x: e.clientX, moved: 0 };
            setDragging(true);
          }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => {
            shared.pointer.current = null;
            cursorTarget.current = null;
            drag.current = null;
            setDragging(false);
            setHovering(false);
          }}
          aria-hidden="true"
        >
          <div
            ref={cursorEl}
            className="pointer-events-none absolute left-0 top-0 z-10 opacity-0 transition-opacity duration-200"
          >
            <div
              className={`absolute flex items-center justify-center transition-[width,height,margin] duration-300 ease-out ${
                hovering && !dragging
                  ? "-ml-11 -mt-11 size-22"
                  : dragging
                    ? "-ml-7 -mt-7 size-14"
                    : "-ml-9 -mt-9 size-18"
              }`}
            >
              <div
                ref={ringEl}
                className={`absolute inset-0 rounded-full transition-colors duration-300 ${
                  hovering && !dragging ? "bg-gold" : "bg-ink"
                }`}
              />
              <span className="relative font-mono text-[13px] font-medium text-gold-ink">
                {hovering && !dragging ? "View" : "Drag"}
              </span>
            </div>
          </div>
          <Canvas
            flat
            dpr={[1, 1.75]}
            frameloop={inView ? "always" : "never"}
            camera={{ position: [0, 0, CAM_Z], fov: 34, near: 0.1, far: 50 }}
            gl={{ antialias: true, alpha: true }}
          >
            <Scene works={works} shared={shared} onIndex={setIndex} />
          </Canvas>
        </div>

        <div
          className="mx-auto flex w-full max-w-6xl flex-wrap items-end justify-between gap-4 px-4 pb-8 pt-4 sm:px-8"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") goTo(index + 1);
            if (e.key === "ArrowLeft") goTo(index - 1);
          }}
        >
          <div aria-live="polite">
            <p className="font-mono text-[13px] text-subtle">
              {index + 1} of {works.length}
            </p>
            <p className="font-serif text-3xl text-ink">{project.title}</p>
            <p className="text-muted">{project.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              aria-label="Previous project"
              className="flex size-12 items-center justify-center rounded-full border border-line text-ink hover:border-gold disabled:opacity-40"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              disabled={index === works.length - 1}
              aria-label="Next project"
              className="flex size-12 items-center justify-center rounded-full border border-line text-ink hover:border-gold disabled:opacity-40"
            >
              →
            </button>
            <button
              type="button"
              onClick={() => open(index)}
              className="min-h-12 rounded-full bg-gold px-6 font-medium text-gold-ink hover:opacity-90"
            >
              View {project.title}
            </button>
          </div>
        </div>

        <ul className="sr-only">
          {works.map((p) => (
            <li key={p.id}>
              <button type="button" tabIndex={-1} onClick={() => onOpen(p, null)}>
                {p.title}: {p.subtitle}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
