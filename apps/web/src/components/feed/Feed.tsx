'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { BadgeCheck, Search, SlidersHorizontal, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { countryOptions } from '@/lib/countries';
import { CATEGORIES, CATEGORY_LABEL } from '@/lib/format';
import type { FeedResponse } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CATEGORY_ICON } from '../home/Categories';
import { NeedCard, NeedCardSkeleton } from '../NeedCard';
import { EmptyState, Spinner } from '../ui';

const SORTS = [
  ['recent', 'Recently added'],
  ['urgent', 'Most urgent'],
  ['nearly_funded', 'Nearly funded'],
  ['popular', 'Most supported'],
] as const;

const KEYS = ['q', 'country', 'city', 'category', 'gender', 'minAge', 'maxAge', 'urgency', 'sort'] as const;
type Key = (typeof KEYS)[number];

export function Feed() {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [panel, setPanel] = useState(false);
  const countries = useMemo(() => countryOptions(), []);

  const f = useMemo(() => Object.fromEntries(KEYS.map((k) => [k, sp.get(k) ?? ''])) as Record<Key, string>, [sp]);

  const set = useCallback(
    (patch: Partial<Record<Key, string>>) => {
      const next = new URLSearchParams(sp.toString());
      Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
      const qs = next.toString();
      router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
    },
    [sp, router, path],
  );

  // Text inputs are debounced into the URL so every keystroke isn't a request.
  const [q, setQ] = useState(f.q);
  const [city, setCity] = useState(f.city);
  useEffect(() => setQ(f.q), [f.q]);
  useEffect(() => setCity(f.city), [f.city]);
  useEffect(() => {
    if (q === f.q && city === f.city) return;
    const t = setTimeout(() => set({ q, city }), 400);
    return () => clearTimeout(t);
  }, [q, city, f.q, f.city, set]);

  const query = useInfiniteQuery({
    queryKey: ['needs', f],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const p = new URLSearchParams({ page: String(pageParam), pageSize: '12' });
      KEYS.forEach((k) => f[k] && p.set(k, f[k]));
      return api<FeedResponse>(`/api/needs?${p}`, { auth: false });
    },
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: (prev) => prev,
  });

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;
  const activeCount = KEYS.filter((k) => k !== 'sort' && f[k]).length;
  const clear = () => router.replace(path, { scroll: false });

  const filters = (
    <div className="space-y-5">
      <div>
        <label htmlFor="f-country" className="label">Country</label>
        <select id="f-country" className="field" value={f.country} onChange={(e) => set({ country: e.target.value })}>
          <option value="">Anywhere</option>
          {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-city" className="label">City</label>
        <input id="f-city" className="field" placeholder="e.g. Nairobi" value={city} onChange={(e) => setCity(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="f-min" className="label">Age from</label>
          <input id="f-min" type="number" min={0} max={120} inputMode="numeric" className="field" value={f.minAge} onChange={(e) => set({ minAge: e.target.value })} />
        </div>
        <div>
          <label htmlFor="f-max" className="label">Age to</label>
          <input id="f-max" type="number" min={0} max={120} inputMode="numeric" className="field" value={f.maxAge} onChange={(e) => set({ maxAge: e.target.value })} />
        </div>
      </div>
      <div>
        <label htmlFor="f-gender" className="label">Gender</label>
        <select id="f-gender" className="field" value={f.gender} onChange={(e) => set({ gender: e.target.value })}>
          <option value="">Any</option>
          <option value="FEMALE">Female</option>
          <option value="MALE">Male</option>
          <option value="OTHER">Other</option>
        </select>
      </div>
      <div>
        <label htmlFor="f-urg" className="label">Urgency</label>
        <select id="f-urg" className="field" value={f.urgency} onChange={(e) => set({ urgency: e.target.value })}>
          <option value="">Any</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">Urgent</option>
          <option value="MEDIUM">Standard</option>
          <option value="LOW">Ongoing</option>
        </select>
      </div>
      <div className="flex items-start gap-3 rounded-2xl bg-accent-500/10 p-3.5 text-[14px]">
        <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" aria-hidden />
        <p><span className="font-semibold">Verified only</span><br /><span className="text-muted">Always on. Unverified profiles are never shown on Luma Bridge.</span></p>
      </div>
      {activeCount > 0 && <button type="button" onClick={clear} className="btn-ghost btn-sm w-full">Clear all filters</button>}
    </div>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[270px_1fr] lg:gap-10">
      {/* Desktop filters */}
      <aside className="hidden lg:block" aria-label="Filters">
        <div className="sticky top-24 card p-5">{filters}</div>
      </aside>

      <div className="min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <label htmlFor="f-q" className="sr-only">Search campaigns</label>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
            <input id="f-q" type="search" className="field rounded-full py-3 pl-12" placeholder="Search by name, need or city" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <label htmlFor="f-sort" className="sr-only">Sort by</label>
            <select id="f-sort" className="field w-full rounded-full py-3 sm:w-[190px]" value={f.sort || 'recent'} onChange={(e) => set({ sort: e.target.value === 'recent' ? '' : e.target.value })}>
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button type="button" className="btn-ghost shrink-0 lg:hidden" onClick={() => setPanel(true)} aria-haspopup="dialog">
              <SlidersHorizontal className="h-4 w-4" aria-hidden /> Filters{activeCount ? ` (${activeCount})` : ''}
            </button>
          </div>
        </div>

        <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Categories">
          <button type="button" aria-pressed={!f.category} onClick={() => set({ category: '' })} className={cn('shrink-0 rounded-full border px-4 py-2 text-[15px] font-medium transition', !f.category ? 'border-brand bg-brand text-white' : 'border-line bg-surface hover:border-ink/30')}>All</button>
          {CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICON[c];
            const on = f.category === c;
            return (
              <button key={c} type="button" aria-pressed={on} onClick={() => set({ category: on ? '' : c })} className={cn('flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-[15px] font-medium transition', on ? 'border-brand bg-brand text-white' : 'border-line bg-surface hover:border-ink/30')}>
                <Icon className="h-4 w-4" aria-hidden /> {CATEGORY_LABEL[c]}
              </button>
            );
          })}
        </div>

        <p className="mb-5 mt-6 text-[15px] text-muted" aria-live="polite">
          {query.isLoading ? 'Loading…' : `${total} verified campaign${total === 1 ? '' : 's'}`}
          {query.isFetching && !query.isLoading && <Spinner className="ml-2 inline h-3.5 w-3.5" />}
        </p>

        {query.isLoading ? (
          <div className="masonry !columns-1 sm:!columns-2 xl:!columns-3">{Array.from({ length: 6 }, (_, i) => <NeedCardSkeleton key={i} />)}</div>
        ) : query.isError ? (
          <EmptyState title="We couldn't load campaigns" body="Check your connection and try again." action={<button className="btn-primary" onClick={() => void query.refetch()}>Try again</button>} />
        ) : items.length === 0 ? (
          <EmptyState title="No campaigns match those filters" body="Try a wider age range, another country, or clear the filters to see everyone." action={<button className="btn-primary" onClick={clear}>Clear filters</button>} />
        ) : (
          <>
            <div className="masonry !columns-1 sm:!columns-2 xl:!columns-3">
              {items.map((n, i) => <NeedCard key={n.id} need={n} priority={i < 3} />)}
            </div>
            {query.hasNextPage && (
              <div className="mt-8 flex justify-center">
                <button type="button" className="btn-ghost btn-lg" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                  {query.isFetchingNextPage ? <><Spinner /> Loading…</> : 'Show more campaigns'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Mobile filter sheet */}
      {panel && (
        <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <button type="button" className="absolute inset-0 bg-night/60 backdrop-blur-sm" aria-label="Close filters" onClick={() => setPanel(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-4xl bg-surface p-6 shadow-lift">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Filters</h2>
              <button type="button" className="btn-quiet h-10 w-10 !p-0" onClick={() => setPanel(false)} aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            {filters}
            <button type="button" className="btn-primary btn-lg mt-6 w-full" onClick={() => setPanel(false)}>Show {total} campaign{total === 1 ? '' : 's'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
