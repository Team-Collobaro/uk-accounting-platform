"use client";

import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";

/**
 * Voice-reactive speaking wave — a horizontal gradient visualizer.
 *
 * Rendered as a band above the chat input while an AI message is spoken aloud.
 * A <canvas> draws several stacked, gradient-stroked sine waves whose amplitude
 * and glow are driven by the shared `energyRef` "loudness" signal — spiked on
 * every spoken word boundary in useAudio, decayed here each frame (floored so
 * the line keeps a gentle ripple between words). The result reads as a living,
 * voice-driven waveform rather than a canned loop.
 *
 * Clicking the band stops the speech. On unmount (speech ended/cancelled) the
 * rAF loop is cancelled and the energy reset. Reduced-motion / print hide the
 * canvas via CSS so nothing animates.
 */

const HEIGHT = 60; // css px

// Orange/amber/gold palette matching the brand (hsl 16 100% 58%)
const LAYERS = [
  {
    colors: ["#ff4500", "#ff8c00"] as [string, string],
    glow: "#ff5c00",
    lineWidth: 3.0,
    freq: 0.006,
    speed: 0.8,
    phase: 0,
    ampScale: 1.0,
  },
  {
    colors: ["#ff6200", "#ffb300"] as [string, string],
    glow: "#ff8000",
    lineWidth: 2.2,
    freq: 0.010,
    speed: 1.2,
    phase: Math.PI * 0.4,
    ampScale: 0.82,
  },
  {
    colors: ["#ff3000", "#ff6500"] as [string, string],
    glow: "#ff4500",
    lineWidth: 1.8,
    freq: 0.014,
    speed: 1.7,
    phase: Math.PI * 0.8,
    ampScale: 0.65,
  },
  {
    colors: ["#ff8c00", "#ffd000"] as [string, string],
    glow: "#ffaa00",
    lineWidth: 1.4,
    freq: 0.018,
    speed: 2.3,
    phase: Math.PI * 1.2,
    ampScale: 0.5,
  },
  {
    colors: ["#ff5500", "#ff9400"] as [string, string],
    glow: "#ff6a00",
    lineWidth: 1.0,
    freq: 0.024,
    speed: 3.0,
    phase: Math.PI * 1.6,
    ampScale: 0.35,
  },
];

export function SpeakingWave({
  energyRef,
  onStop,
}: {
  energyRef: MutableRefObject<number>;
  onStop: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const w = wrapper.clientWidth;
      canvas.width = w * dpr;
      canvas.height = HEIGHT * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${HEIGHT}px`;
      ctx.scale(dpr, dpr);
    };
    resize();

    const ro = new ResizeObserver(() => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      resize();
    });
    ro.observe(wrapper);

    const heartbeat = window.setInterval(() => {
      energyRef.current = Math.min(1, energyRef.current + 0.18);
    }, 240);

    let raf = 0;

    const draw = (now: number) => {
      energyRef.current = Math.max(0.05, energyRef.current * 0.9);
      const e = energyRef.current;
      const t = now / 1000;

      const w = canvas.width / dpr;
      const h = HEIGHT;
      const cy = h / 2;

      ctx.clearRect(0, 0, w, h);

      for (const layer of LAYERS) {
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, layer.colors[0]);
        grad.addColorStop(1, layer.colors[1]);

        ctx.beginPath();
        for (let x = 0; x <= w; x++) {
          // Smoothstep envelope: amplitude tapers to zero toward both edges so
          // the wave eases into the centre line instead of being clipped flat.
          const norm = w > 0 ? x / w : 0;
          const edge = 0.16; // fraction of width over which to fade in/out
          let env = 1;
          if (norm < edge) env = norm / edge;
          else if (norm > 1 - edge) env = (1 - norm) / edge;
          env = env * env * (3 - 2 * env);

          const maxAmp = h * 0.38 * e * layer.ampScale * env;
          const y =
            cy +
            Math.sin(x * layer.freq + t * layer.speed + layer.phase) * maxAmp;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        ctx.strokeStyle = grad;
        ctx.lineWidth = layer.lineWidth;
        ctx.shadowColor = layer.glow;
        ctx.shadowBlur = 8 + 20 * e;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(heartbeat);
      ro.disconnect();
      energyRef.current = 0;
    };
  }, [energyRef]);

  return (
    <button
      type="button"
      ref={wrapperRef}
      onClick={onStop}
      title="Stop speaking"
      aria-label="Stop speaking"
      className="speaking-wave"
    >
      <canvas ref={canvasRef} aria-hidden />
    </button>
  );
}
