"use client";

import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";

/**
 * Voice-reactive speaking wave — a compact vertical bar visualizer.
 *
 * The shared `energyRef` is bumped from word boundaries in useAudio. This
 * component turns that signal into the "live tutor" bar language used in the
 * course rail: short cyan bars at rest, taller brighter bars while speech is
 * active. Clicking the visualizer stops the current speech.
 */

const HEIGHT = 58; // css px
const BAR_COUNT = 34;
const BAR_GAP = 4;

const BAR_COLORS = [
  "#38bdf8",
  "#22d3ee",
  "#06b6d4",
  "#60a5fa",
  "#7dd3fc",
];

function roundedBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

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
      energyRef.current = Math.max(0.08, energyRef.current * 0.91);
      const e = energyRef.current;
      const t = now / 1000;

      const w = canvas.width / dpr;
      const h = HEIGHT;
      const baseline = h - 9;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";

      const usableWidth = Math.max(0, w - 8);
      const barWidth = Math.max(
        2,
        Math.floor((usableWidth - BAR_GAP * (BAR_COUNT - 1)) / BAR_COUNT),
      );
      const totalWidth = BAR_COUNT * barWidth + (BAR_COUNT - 1) * BAR_GAP;
      const startX = (w - totalWidth) / 2;

      for (let i = 0; i < BAR_COUNT; i++) {
        const position = i / Math.max(1, BAR_COUNT - 1);
        const centreLift = 1 - Math.abs(position - 0.5) * 0.55;
        const pulse =
          Math.sin(t * 5.2 + i * 0.72) * 0.5 +
          Math.sin(t * 2.7 + i * 1.37) * 0.35 +
          0.65;
        const normalized = Math.max(0.18, Math.min(1, pulse));
        const height = 8 + normalized * centreLift * (12 + e * 33);
        const x = startX + i * (barWidth + BAR_GAP);
        const y = baseline - height;
        const grad = ctx.createLinearGradient(0, y, 0, baseline);
        grad.addColorStop(0, BAR_COLORS[(i + 1) % BAR_COLORS.length]);
        grad.addColorStop(1, BAR_COLORS[i % BAR_COLORS.length]);

        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.52 + e * 0.42;
        ctx.shadowColor = "#22d3ee";
        ctx.shadowBlur = 4 + e * 14;
        roundedBar(ctx, x, y, barWidth, height, barWidth);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
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
