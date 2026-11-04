'use client';

import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { api } from '@/lib/api';
import { countryName, flag } from '@/lib/countries';
import { formatAmount, timeAgo } from '@/lib/format';
import type { TickerItem } from '@/lib/types';
import { cn } from '@/lib/utils';

export function useTicker(initial?: TickerItem[]) {
  return useQuery({
    queryKey: ['ticker'],
    queryFn: async () => (await api<{ items: TickerItem[] }>('/api/ticker', { auth: false })).items,
    initialData: initial,
    refetchInterval: 12_000,
    staleTime: 8_000,
  });
}

/** Live list of the latest confirmed gifts. New rows slide in at the top. */
export function LiveTicker({ initial, limit = 4, className, tone = 'glass' }: { initial?: TickerItem[]; limit?: number; className?: string; tone?: 'glass' | 'plain' }) {
  const { data } = useTicker(initial);
  const items = (data ?? []).slice(0, limit);

  return (
    <div className={cn(tone === 'glass' ? 'glass rounded-3xl p-4 text-white shadow-glow' : 'card p-4', className)}>
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-pulseRing rounded-full bg-accent-400" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-400" />
        </span>
        <h2 className={cn('font-sans text-sm font-semibold tracking-normal', tone === 'glass' ? 'text-white' : 'text-ink')}>Giving right now</h2>
      </div>
      <ul className="space-y-1" aria-live="polite">
        <AnimatePresence initial={false}>
          {items.map((d) => (
            <motion.li key={d.id} layout initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: 'spring', damping: 26, stiffness: 300 }}>
              <Link href={`/needs/${d.need.slug}`} className={cn('flex items-center gap-3 rounded-2xl px-2.5 py-2 transition', tone === 'glass' ? 'hover:bg-white/10' : 'hover:bg-sunken')}>
                <span aria-hidden className="text-xl leading-none">{d.anonymous || !d.donorCountry ? '💚' : flag(d.donorCountry)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">
                    {d.donorName} <span className={tone === 'glass' ? 'text-white/60' : 'text-muted'}>gave</span> {formatAmount(d.amount, d.currency)}
                  </span>
                  <span className={cn('block truncate text-[12.5px]', tone === 'glass' ? 'text-white/60' : 'text-muted')}>
                    to {d.need.name}, {countryName(d.need.country)} · {timeAgo(d.createdAt)}
                  </span>
                </span>
              </Link>
            </motion.li>
          ))}
        </AnimatePresence>
        {!items.length && <li className={cn('px-2.5 py-3 text-sm', tone === 'glass' ? 'text-white/70' : 'text-muted')}>The first gift will appear here.</li>}
      </ul>
    </div>
  );
}
