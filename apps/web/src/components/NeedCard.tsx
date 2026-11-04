'use client';

import { Clock, MapPin } from 'lucide-react';
import Link from 'next/link';
import { countryName, flag } from '@/lib/countries';
import { CATEGORY_LABEL, daysLeft, hash01, money } from '@/lib/format';
import type { NeedCard as Need } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useDonate } from './DonateModal';
import { Avatar, ProgressBar, UrgencyBadge, VerifiedBadge } from './ui';

const ASPECTS = ['aspect-[4/3]', 'aspect-square', 'aspect-[5/4]', 'aspect-[4/5]'];

export function NeedCard({ need, priority: eager, className }: { need: Need; priority?: boolean; className?: string }) {
  const { open } = useDonate();
  const b = need.beneficiary;
  const left = daysLeft(need.deadline);
  const aspect = ASPECTS[Math.floor(hash01(need.id) * ASPECTS.length)]!;
  const funded = need.percent >= 100;

  return (
    <article className={cn('group relative overflow-hidden rounded-3xl border border-line bg-surface shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-lift', className)}>
      <Link href={`/needs/${need.slug}`} className="block rounded-3xl after:absolute after:inset-0 after:z-0" aria-label={`${need.title}, by ${b.name}`}>
        <div className={cn('relative overflow-hidden bg-sunken', aspect)}>
          {need.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={need.coverUrl} alt="" loading={eager ? 'eager' : 'lazy'} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
          )}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-night/45 to-transparent" aria-hidden />
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {b.verified && <VerifiedBadge compact className="bg-white/90 backdrop-blur dark:bg-night/80" />}
          </div>
          <div className="absolute right-3 top-3"><UrgencyBadge priority={need.priority} className="bg-white/90 backdrop-blur dark:bg-night/80" /></div>
          <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-night backdrop-blur">{CATEGORY_LABEL[need.category]}</span>
        </div>
      </Link>

      <div className="relative z-10 p-5 pointer-events-none">
        <div className="flex items-center gap-3">
          <Avatar src={b.photoUrl} name={b.name} size={40} />
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight">{b.name}<span className="font-normal text-muted">, {b.age}</span></p>
            <p className="flex items-center gap-1 truncate text-[13px] text-muted"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden /> {b.city}, {flag(b.country)} {countryName(b.country)}</p>
          </div>
        </div>
        <h3 className="mt-4 text-[1.2rem] font-semibold leading-snug">{need.title}</h3>
        <p className="mt-1.5 line-clamp-3 text-[15px] text-muted">{need.summary}</p>

        <div className="mt-5">
          <ProgressBar percent={need.percent} label={`${need.percent}% of goal raised`} />
          <div className="mt-2.5 flex items-baseline justify-between text-sm">
            <p><span className="font-display text-lg font-semibold">{money(need.raisedUsd)}</span> <span className="text-muted">of {money(need.goalUsd)}</span></p>
            <p className="font-semibold text-accent-700 dark:text-accent-400">{need.percent}%</p>
          </div>
          {left !== null && !funded && <p className="mt-1 flex items-center gap-1 text-[13px] text-muted"><Clock className="h-3.5 w-3.5" aria-hidden /> {left === 0 ? 'Ends today' : `${left} day${left === 1 ? '' : 's'} left`}</p>}
        </div>

        <button
          type="button"
          onClick={() => open({ id: need.id, slug: need.slug, title: need.title, name: b.name })}
          disabled={funded}
          className="btn-primary pointer-events-auto relative z-20 mt-5 w-full"
        >
          {funded ? 'Fully funded' : 'Donate'}
        </button>
      </div>
    </article>
  );
}

export function NeedCardSkeleton() {
  return (
    <div className="card overflow-hidden" aria-hidden>
      <div className="skeleton aspect-[4/3] rounded-none" />
      <div className="space-y-3 p-5">
        <div className="skeleton h-10 w-2/3" />
        <div className="skeleton h-6 w-full" />
        <div className="skeleton h-12 w-full" />
        <div className="skeleton h-10 w-full rounded-full" />
      </div>
    </div>
  );
}
