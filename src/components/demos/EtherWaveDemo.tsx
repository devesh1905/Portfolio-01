"use client";

import { useEffect, useRef, useState } from "react";

const SAMPLE_RATE = 48000;
const BUFFERS = [512, 1536, 4096];

// A playable stand-in for EtherWave's stream monitor: the buffer size drives the latency
// read-out exactly as it does in the real app (latency = buffer / sample rate).
export default function EtherWaveDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bufferSize, setBufferSize] = useState(1536);
  const [streaming, setStreaming] = useState(true);
  const [gain, setGain] = useState(70);
  const latency = ((bufferSize / SAMPLE_RATE) * 1000).toFixed(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const gold = getComputedStyle(document.documentElement).getPropertyValue("--color-gold").trim() || "gold";
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let phase = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1.5;
      for (let channel = 0; channel < 2; channel++) {
        ctx.beginPath();
        ctx.strokeStyle = gold;
        ctx.globalAlpha = channel === 0 ? 1 : 0.35;
        for (let x = 0; x < w; x++) {
          const r = x / w;
          const amp = streaming ? (gain / 100) * h * 0.32 * Math.sin(r * Math.PI) : 0;
          const y =
            h / 2 +
            (Math.sin(r * Math.PI * 8 + phase * (channel ? 0.9 : 1.2)) * 0.65 +
              Math.cos(r * Math.PI * 18 - phase * 0.8) * 0.35) *
              amp;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      phase += 0.06;
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [streaming, gain]);

  return (
    <div className="rounded-2xl border border-line bg-bg p-5">
      <p className="mb-3 text-sm text-subtle">Try it: change the buffer and watch the latency.</p>
      <canvas ref={canvasRef} className="h-24 w-full" aria-label="Simulated stereo waveform" role="img" />
      <dl className="my-4 grid grid-cols-2 gap-3 border-y border-line py-3 text-sm sm:grid-cols-4">
        {[
          ["Latency", `${latency} ms`],
          ["Buffer", `${bufferSize} samples`],
          ["Format", "16-bit PCM"],
          ["Sample rate", "48 kHz"],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-subtle">{k}</dt>
            <dd className="tabular-nums text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Buffer size" className="flex rounded-full border border-line p-1">
          {BUFFERS.map((size) => (
            <button
              key={size}
              type="button"
              aria-pressed={bufferSize === size}
              onClick={() => setBufferSize(size)}
              className={`min-h-10 rounded-full px-4 text-sm tabular-nums ${
                bufferSize === size ? "bg-gold text-gold-ink" : "text-muted hover:text-ink"
              }`}
            >
              {size}
            </button>
          ))}
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm text-muted">
          Gain
          <input
            type="range"
            min={10}
            max={100}
            value={gain}
            onChange={(e) => setGain(Number(e.target.value))}
            className="w-28 accent-[var(--color-gold)]"
          />
        </label>
        <button
          type="button"
          aria-pressed={streaming}
          onClick={() => setStreaming((s) => !s)}
          className="min-h-11 rounded-full border border-line px-4 text-sm text-ink hover:border-gold"
        >
          {streaming ? "Mute" : "Unmute"}
        </button>
      </div>
    </div>
  );
}
