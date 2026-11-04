'use client';

import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false, loading: () => <span className="block h-full w-full" /> });

const ease = { i: { x: [0.45], y: [1] }, o: { x: [0.55], y: [0] } };

/** Hand-authored Lottie: an arc that grows and shrinks while it travels around a ring. */
const animationData = {
  v: '5.7.0', fr: 60, ip: 0, op: 120, w: 100, h: 100, nm: 'luma-bridge-loader', ddd: 0, assets: [],
  layers: [
    {
      ddd: 0, ind: 1, ty: 4, nm: 'arc', sr: 1, ao: 0, ip: 0, op: 120, st: 0, bm: 0,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 1, k: [{ t: 0, s: [0], i: { x: [0.5], y: [0.5] }, o: { x: [0.5], y: [0.5] } }, { t: 120, s: [360] }] },
        p: { a: 0, k: [50, 50, 0] }, a: { a: 0, k: [0, 0, 0] }, s: { a: 0, k: [100, 100, 100] },
      },
      shapes: [
        {
          ty: 'gr', nm: 'g',
          it: [
            { ty: 'el', nm: 'ring', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [58, 58] } },
            { ty: 'tm', nm: 'trim', s: { a: 0, k: 0 }, e: { a: 1, k: [{ t: 0, s: [12], ...ease }, { t: 60, s: [72], ...ease }, { t: 120, s: [12] }] }, o: { a: 0, k: 0 }, m: 1 },
            { ty: 'st', nm: 'stroke', c: { a: 0, k: [0.145, 0.388, 0.922, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 7 }, lc: 2, lj: 2 },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
        },
      ],
    },
    {
      ddd: 0, ind: 2, ty: 4, nm: 'dot', sr: 1, ao: 0, ip: 0, op: 120, st: 0, bm: 0,
      ks: {
        o: { a: 0, k: 100 }, r: { a: 0, k: 0 }, p: { a: 0, k: [50, 50, 0] }, a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [{ t: 0, s: [70, 70, 100], ...{ i: { x: [0.45, 0.45, 0.45], y: [1, 1, 1] }, o: { x: [0.55, 0.55, 0.55], y: [0, 0, 0] } } }, { t: 60, s: [100, 100, 100], i: { x: [0.45, 0.45, 0.45], y: [1, 1, 1] }, o: { x: [0.55, 0.55, 0.55], y: [0, 0, 0] } }, { t: 120, s: [70, 70, 100] }] },
      },
      shapes: [
        {
          ty: 'gr', nm: 'g',
          it: [
            { ty: 'el', nm: 'dot', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [14, 14] } },
            { ty: 'fl', c: { a: 0, k: [0.063, 0.725, 0.506, 1] }, o: { a: 0, k: 100 } },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
        },
      ],
    },
  ],
};

export function LottieLoader({ size = 64, label = 'Loading', className }: { size?: number; label?: string; className?: string }) {
  return (
    <div role="status" aria-label={label} className={cn('inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <Lottie animationData={animationData} loop autoplay rendererSettings={{ preserveAspectRatio: 'xMidYMid meet' }} />
    </div>
  );
}

export function PageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-muted">
      <LottieLoader size={72} label={label} />
      <span className="text-sm">{label}…</span>
    </div>
  );
}
