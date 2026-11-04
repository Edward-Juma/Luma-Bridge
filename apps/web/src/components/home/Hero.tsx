'use client';

import { motion } from 'framer-motion';
import { BadgeCheck, Globe2, ShieldCheck, UserRoundCheck } from 'lucide-react';
import Link from 'next/link';
import { Globe } from '@/components/Globe';
import { LiveTicker } from '@/components/Ticker';
import { countryName, flag } from '@/lib/countries';
import { money } from '@/lib/format';
import type { NeedCard, TickerItem } from '@/lib/types';

const SYMBOLS = [
  { s: '$', x: 46, y: 84, d: 0, t: 15, dx: 24, r: 14, z: 30 },
  { s: '€', x: 54, y: 92, d: 3, t: 17, dx: -18, r: -10, z: 24 },
  { s: '£', x: 62, y: 80, d: 6, t: 14, dx: 30, r: 8, z: 28 },
  { s: 'KSh', x: 70, y: 93, d: 1.5, t: 18, dx: -26, r: -12, z: 17 },
  { s: '₦', x: 78, y: 82, d: 8, t: 16, dx: 16, r: 10, z: 30 },
  { s: '₿', x: 86, y: 92, d: 4.5, t: 19, dx: -22, r: -8, z: 26 },
  { s: '₹', x: 93, y: 78, d: 10, t: 15, dx: 14, r: 12, z: 28 },
  { s: '¥', x: 4, y: 94, d: 12, t: 20, dx: 20, r: -14, z: 26 },
  { s: 'Ξ', x: 94, y: 56, d: 7, t: 17, dx: -16, r: 10, z: 26 },
];

// Deterministic so server and client markup match.
const DOTS = Array.from({ length: 36 }, (_, i) => ({
  x: (i * 37.7) % 100,
  y: (i * 53.3 + 11) % 100,
  s: 1 + ((i * 7) % 3),
  d: (i * 0.37) % 4,
  t: 3 + ((i * 5) % 5),
}));

export function Hero({ countries, featured, ticker }: { countries: string[]; featured?: NeedCard; ticker?: TickerItem[] }) {
  return (
    <section className="container pb-6 pt-2 md:pt-4">
      <div
        className="relative isolate overflow-hidden rounded-[2rem] px-6 py-12 text-white md:rounded-[2.75rem] md:px-14 md:py-20"
        style={{
          background:
            'radial-gradient(55% 70% at 78% 42%, rgb(37 99 235 / .5), transparent 62%), radial-gradient(40% 55% at 8% 105%, rgb(16 185 129 / .3), transparent 65%), linear-gradient(180deg, #0B1A3F 0%, #070F26 100%)',
        }}
      >
        {/* Particles + floating currency symbols */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          {DOTS.map((d, i) => (
            <span key={i} className="absolute animate-twinkle rounded-full bg-white" style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.s, height: d.s, ['--dur' as string]: `${d.t}s`, animationDelay: `${d.d}s` }} />
          ))}
          {SYMBOLS.map((s, i) => (
            <span
              key={i}
              className="absolute animate-floatSym font-display font-semibold text-white/80 opacity-0"
              style={{ left: `${s.x}%`, top: `${s.y}%`, fontSize: s.z, ['--dur' as string]: `${s.t}s`, ['--dx' as string]: `${s.dx}px`, ['--rot' as string]: `${s.r}deg`, animationDelay: `${s.d}s` }}
            >
              {s.s}
            </span>
          ))}
        </div>

        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="text-[clamp(2.7rem,6.6vw,5.4rem)] font-semibold leading-[0.98] text-white">
              Giving Should Reach the Right Hands.
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.12, ease: [0.16, 1, 0.3, 1] }} className="mt-6 max-w-lg text-lg text-white/75 md:text-xl">
              Connect directly with verified individuals who genuinely need help.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.24, ease: [0.16, 1, 0.3, 1] }} className="mt-9 flex flex-wrap gap-3">
              <Link href="/needs" className="btn-accent btn-lg">Donate Now</Link>
              <Link href="/register" className="btn glass btn-lg text-white hover:bg-white/20">Request Help</Link>
            </motion.div>
            <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.5 }} className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-[15px] text-white/80">
              <li className="flex items-center gap-2"><UserRoundCheck className="h-[18px] w-[18px] text-accent-400" aria-hidden /> Checked by a human auditor</li>
              <li className="flex items-center gap-2"><ShieldCheck className="h-[18px] w-[18px] text-accent-400" aria-hidden /> No account needed to give</li>
              <li className="flex items-center gap-2"><Globe2 className="h-[18px] w-[18px] text-accent-400" aria-hidden /> 16 currencies</li>
            </motion.ul>
          </div>

          <div className="relative mx-auto w-full max-w-[560px]">
            <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}>
              <Globe countries={countries} />
            </motion.div>

            {featured && (
              <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.7, ease: [0.16, 1, 0.3, 1] }} className="absolute -right-3 top-[3%] hidden w-[218px] sm:block xl:-right-8">
                <Link href={`/needs/${featured.slug}`} className="glass block animate-drift rounded-3xl p-4 shadow-glow transition hover:bg-white/15">
                  <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-accent-500/25 px-2 py-0.5 text-xs font-semibold text-accent-200">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Verified
                  </span>
                  <p className="font-display text-lg font-semibold leading-tight text-white">{featured.title}</p>
                  <p className="mt-1 text-[13px] text-white/65">{featured.beneficiary.name}, {flag(featured.beneficiary.country)} {countryName(featured.beneficiary.country)}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-accent-400" style={{ width: `${featured.percent}%` }} /></div>
                  <p className="mt-2 text-[13px] text-white/80">{money(featured.raisedUsd)} of {money(featured.goalUsd)}</p>
                </Link>
              </motion.div>
            )}

            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.95, ease: [0.16, 1, 0.3, 1] }} className="relative z-10 mx-auto -mt-6 w-full max-w-[380px] sm:-mt-16 sm:-translate-x-6">
              <LiveTicker initial={ticker} limit={3} />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
