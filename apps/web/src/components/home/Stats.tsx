'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Stats as StatsT } from '@/lib/types';
import { Counter } from '../ui';

export function Stats({ initial }: { initial?: StatsT | null }) {
  const { data } = useQuery({ queryKey: ['stats'], queryFn: () => api<StatsT>('/api/stats', { auth: false }), initialData: initial ?? undefined, refetchInterval: 30_000 });
  const s = data ?? { totalRaisedUsd: 0, activeCampaigns: 0, countries: 0, verifiedFamilies: 0, successfulDonations: 0 };
  const items = [
    { label: 'Total raised', node: <Counter value={s.totalRaisedUsd} prefix="$" /> },
    { label: 'Active campaigns', node: <Counter value={s.activeCampaigns} /> },
    { label: 'Countries', node: <Counter value={s.countries} /> },
    { label: 'Verified families', node: <Counter value={s.verifiedFamilies} /> },
    { label: 'Successful donations', node: <Counter value={s.successfulDonations} /> },
  ];
  return (
    <section aria-label="Platform statistics" className="container">
      <dl className="grid grid-cols-2 gap-y-8 border-b border-line py-10 md:grid-cols-5 md:divide-x md:divide-line">
        {items.map((i) => (
          <div key={i.label} className="px-2 text-center md:px-6">
            <dd className="font-display text-4xl font-semibold md:text-[2.6rem]">{i.node}</dd>
            <dt className="mt-1 text-[15px] text-muted">{i.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
