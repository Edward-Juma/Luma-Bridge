'use client';

import createGlobe from 'cobe';
import { useEffect, useRef } from 'react';
import { COUNTRY_COORDS } from '@/lib/countries';
import { cn } from '@/lib/utils';

/**
 * WebGL globe whose markers are the countries of real, verified campaigns.
 * Drag to spin; it eases back to a slow auto-rotation. Honours prefers-reduced-motion.
 */
export function Globe({ countries, className }: { countries: string[]; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const box = wrap.current;
    if (!el || !box) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const counts = new Map<string, number>();
    countries.forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1));
    const markers = [...counts]
      .filter(([c]) => COUNTRY_COORDS[c])
      .map(([c, n]) => ({ location: COUNTRY_COORDS[c]! as [number, number], size: Math.min(0.1, 0.045 + n * 0.012) }));

    let phi = 4.2;
    let dragging = false;
    let lastX = 0;
    let velocity = 0;
    let width = box.clientWidth;
    let globe: ReturnType<typeof createGlobe> | null = null;

    const build = () => {
      globe?.destroy();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      globe = createGlobe(el, {
        devicePixelRatio: dpr,
        width: width * dpr,
        height: width * dpr,
        phi,
        theta: 0.28,
        dark: 1,
        diffuse: 1.4,
        mapSamples: width < 420 ? 9000 : 16000,
        mapBrightness: 7,
        // cobe ≥0.6.5 has no default for this; leaving it undefined turns the whole sphere black.
        mapBaseBrightness: 0.08,
        baseColor: [0.22, 0.4, 0.92],
        markerColor: [0.2, 0.95, 0.65],
        glowColor: [0.1, 0.24, 0.7],
        markers,
        onRender: (s) => {
          if (!dragging && !reduce) {
            velocity *= 0.94;
            phi += 0.0032 + velocity;
          }
          s.phi = phi;
          s.width = width * dpr;
          s.height = width * dpr;
        },
      });
    };
    build();

    const ro = new ResizeObserver(() => {
      const w = box.clientWidth;
      if (w && Math.abs(w - width) > 8) {
        width = w;
        build();
      }
    });
    ro.observe(box);

    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      phi += dx / 160;
      velocity = dx / 900;
    };
    const up = () => {
      dragging = false;
      el.style.cursor = 'grab';
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);

    return () => {
      ro.disconnect();
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      globe?.destroy();
    };
  }, [countries]);

  return (
    <div ref={wrap} className={cn('relative aspect-square w-full', className)}>
      <canvas
        ref={canvas}
        role="img"
        aria-label="A rotating globe. Green markers show countries with verified campaigns."
        className="h-full w-full cursor-grab touch-pan-y [contain:layout_paint_size]"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
