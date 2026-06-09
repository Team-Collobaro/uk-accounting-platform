"use client";

import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";

/**
 * Voice-reactive speaking orb — a circular music-visualizer.
 *
 * Rendered on top of an AI message's avatar while that message is spoken aloud.
 * A <canvas> draws a glowing orange core wrapped in a jagged neon ring whose
 * radius ripples per-angle in time with the speech. The ripple amplitude and
 * glow are driven by the shared `energyRef` "loudness" signal — spiked on every
 * spoken word boundary in useAudio, decayed here each frame (floored so the orb
 * keeps softly breathing between words) — so it reads as a living, voice-driven
 * visualizer rather than a canned loop.
 *
 * Clicking it stops the speech. On unmount (speech ended/cancelled) the rAF
 * loop is cancelled and the energy reset, and the plain avatar returns.
 * Reduced-motion / print hide the canvas (via CSS) so the static avatar shows.
 */

const SIZE = 84; // css px render box (overflows the small avatar slot)
const POINTS = 110; // ring resolution

export function SpeakingOrb({
  energyRef,
  onStop,
}: {
  energyRef: MutableRefObject<number>;
  onStop: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Reduced motion: skip the loop entirely (CSS hides the canvas → the plain
    // avatar shows through, never a frozen frame).
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const baseR = SIZE * 0.2; // inner orb radius (~17px, covers the 28px avatar)
    const amp = SIZE * 0.14; // max ripple height

    // Per-point ring magnitudes, eased toward a moving target each frame so the
    // jagged edge flows organically instead of strobing.
    const bins = new Float32Array(POINTS);

    let raf = 0;

    // Heartbeat fallback: keep the ring alive when no boundary events arrive
    // (some TTS engines stay silent on onboundary).
    const heartbeat = window.setInterval(() => {
      energyRef.current = Math.min(1, energyRef.current + 0.16);
    }, 240);

    const tracePath = (radiusAt: (i: number) => number) => {
      // Closed Catmull-Rom-ish smooth loop through the per-point radii.
      ctx.beginPath();
      for (let i = 0; i <= POINTS; i++) {
        const idx = i % POINTS;
        const a = (idx / POINTS) * Math.PI * 2 - Math.PI / 2;
        const r = radiusAt(idx);
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };

    const draw = (now: number) => {
      energyRef.current = Math.max(0.1, energyRef.current * 0.9);
      const e = energyRef.current; // 0.1 … 1
      const t = now / 1000;
      const glow = 0.28 + 0.72 * e;

      // Build the moving target spectrum and ease the live bins toward it.
      for (let i = 0; i < POINTS; i++) {
        const a = (i / POINTS) * Math.PI * 2;
        // Layered counter-rotating harmonics → an organic, spiky ring.
        const wave =
          Math.sin(a * 3 + t * 1.6) * 0.5 +
          Math.sin(a * 6 - t * 2.4) * 0.32 +
          Math.sin(a * 11 + t * 1.15) * 0.18;
        const target = (0.18 + 0.82 * e) * (0.5 + 0.5 * wave);
        bins[i] += (target - bins[i]) * 0.22;
      }

      ctx.clearRect(0, 0, SIZE, SIZE);

      // ── Neon ring (additive, two-tone) ──────────────────────────────
      ctx.globalCompositeOperation = "lighter";
      ctx.lineJoin = "round";

      const ringR = (i: number) => baseR + amp * 0.45 + bins[i] * amp;

      // Magenta under-glow, offset slightly larger for the pink fringe.
      ctx.lineWidth = 2;
      ctx.strokeStyle = `hsla(330, 95%, 62%, ${0.4 * glow})`;
      ctx.shadowColor = "hsla(330, 95%, 58%, 0.9)";
      ctx.shadowBlur = 14 * glow;
      tracePath((i) => ringR(i) + 2.5);
      ctx.stroke();

      // Bright brand-orange ring on top.
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "hsl(24, 100%, 62%)";
      ctx.shadowColor = "hsla(22, 100%, 55%, 0.95)";
      ctx.shadowBlur = 12 + 24 * glow;
      tracePath(ringR);
      ctx.stroke();

      // Warm fill bleeding inward from the ring toward the core.
      ctx.shadowBlur = 0;
      const fill = ctx.createRadialGradient(cx, cy, baseR * 0.3, cx, cy, baseR + amp);
      fill.addColorStop(0, `hsla(40, 100%, 72%, ${0.45 * glow})`);
      fill.addColorStop(0.55, `hsla(22, 100%, 52%, ${0.16 * glow})`);
      fill.addColorStop(1, "transparent");
      ctx.fillStyle = fill;
      tracePath(ringR);
      ctx.fill();

      // ── Inner solid orb (opaque, hides the avatar behind) ────────────
      ctx.globalCompositeOperation = "source-over";
      const orbR = baseR * (0.92 + 0.08 * e);
      const orbGrad = ctx.createRadialGradient(
        cx,
        cy - baseR * 0.45,
        1,
        cx,
        cy,
        orbR,
      );
      orbGrad.addColorStop(0, "hsl(42, 100%, 84%)");
      orbGrad.addColorStop(0.4, "hsl(28, 100%, 60%)");
      orbGrad.addColorStop(1, "hsl(13, 92%, 42%)");
      ctx.fillStyle = orbGrad;
      ctx.shadowColor = "hsla(22, 100%, 55%, 0.9)";
      ctx.shadowBlur = 10 + 16 * glow;
      ctx.beginPath();
      ctx.arc(cx, cy, orbR, 0, Math.PI * 2);
      ctx.fill();

      // ── Bright white core ────────────────────────────────────────────
      ctx.shadowColor = "rgba(255, 244, 224, 0.95)";
      ctx.shadowBlur = 6 + 10 * glow;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(cx, cy - baseR * 0.06, baseR * (0.28 + 0.05 * e), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(heartbeat);
      energyRef.current = 0;
    };
  }, [energyRef]);

  return (
    <button
      type="button"
      onClick={onStop}
      title="Stop speaking"
      aria-label="Stop speaking"
      className="speaking-orb"
    >
      <canvas ref={canvasRef} style={{ width: SIZE, height: SIZE }} aria-hidden />
    </button>
  );
}
