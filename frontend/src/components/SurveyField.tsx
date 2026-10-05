import { useEffect, useRef } from 'react';
import type { Theme } from '../lib/theme';

/**
 * SurveyField — the ambient layer.
 *
 * A drifting graticule with three delta meanders and a survey sweep that
 * crosses roughly every fourteen seconds, ticking each graticule crossing
 * as it passes. It reads as a sheet still being worked on.
 *
 * Deliberately not: floating particles with connecting lines, or blurred
 * colour orbs. Those say "AI landing page"; a graticule says "cadastre".
 *
 * Costs: one canvas, one rAF, paused when the tab is hidden or when the
 * reader has asked for reduced motion.
 */
export default function SurveyField({ theme }: { theme: Theme }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const css = getComputedStyle(document.documentElement);
    const lineColor = css.getPropertyValue('--line-strong').trim() || '#b4b8ac';
    const inkColor = css.getPropertyValue('--indigo').trim() || '#22456e';

    let w = 0;
    let h = 0;
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const GRID = 64;
    const SWEEP_PERIOD = 14_000; // ms
    let raf = 0;
    let start = performance.now();

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, w, h);

      // 1. Graticule, drifting slowly on both axes.
      const ox = (t * 3) % GRID;
      const oy = (t * 1.6) % GRID;
      ctx.lineWidth = 1;
      ctx.strokeStyle = lineColor;
      ctx.globalAlpha = 0.16;
      ctx.beginPath();
      for (let x = -GRID + ox; x < w + GRID; x += GRID) {
        ctx.moveTo(Math.round(x) + 0.5, 0);
        ctx.lineTo(Math.round(x) + 0.5, h);
      }
      for (let y = -GRID + oy; y < h + GRID; y += GRID) {
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(w, Math.round(y) + 0.5);
      }
      ctx.stroke();

      // 2. Three meanders. Bangladesh is a delta; the land record is
      //    argued about mostly where the water moves.
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = inkColor;
      ctx.lineWidth = 1.25;
      const bands = [0.28, 0.56, 0.82];
      bands.forEach((band, i) => {
        const phase = t * (0.05 + i * 0.015) + i * 2.1;
        const amp = 26 + i * 14;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 12) {
          const y =
            h * band +
            Math.sin(x * 0.0032 + phase) * amp +
            Math.cos(x * 0.0011 - phase * 0.7) * (amp * 0.55);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });

      // 3. The sweep. One hairline crossing the sheet, ticking each
      //    graticule crossing it passes. This is the only "event".
      if (!reduce) {
        const p = ((now - start) % SWEEP_PERIOD) / SWEEP_PERIOD;
        if (p < 0.55) {
          const sx = (p / 0.55) * (w + 160) - 80;
          ctx.globalAlpha = 0.3;
          ctx.strokeStyle = inkColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(Math.round(sx) + 0.5, 0);
          ctx.lineTo(Math.round(sx) + 0.5, h);
          ctx.stroke();

          // tick the crossings just behind the sweep line
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = inkColor;
          const nearestX = Math.round((sx - ox) / GRID) * GRID + ox;
          if (Math.abs(nearestX - sx) < 26) {
            for (let y = -GRID + oy; y < h + GRID; y += GRID) {
              ctx.fillRect(Math.round(nearestX) - 1.5, Math.round(y) - 1.5, 3, 3);
            }
          }
        }
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };

    if (reduce) {
      // Draw one static frame: the sheet, unmoving.
      draw(performance.now());
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(draw);
    }

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else if (!reduce) {
        start = performance.now();
        raf = requestAnimationFrame(draw);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      cancelAnimationFrame(raf);
    };
  }, [theme]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 select-none opacity-[0.55] dark:opacity-40"
    />
  );
}
