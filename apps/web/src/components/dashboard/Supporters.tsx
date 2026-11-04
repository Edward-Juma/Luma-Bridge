'use client';

import { useMutation } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { flag, countryName } from '@/lib/countries';
import { formatAmount, money, timeAgo } from '@/lib/format';
import { errMsg, useDashboard, useRefreshDashboard } from '@/lib/me';
import type { MyDonation } from '@/lib/me-types';
import { PageLoader } from '../LottieLoader';
import { EmptyState, Spinner } from '../ui';
import { DashHeading } from './DashShell';

function Row({ d }: { d: MyDonation }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const refresh = useRefreshDashboard();
  const thank = useMutation({
    mutationFn: () => api(`/api/me/donations/${d.id}/thank`, { method: 'POST', json: { note } }),
    onSuccess: async () => { toast.success('Thank-you sent'); setOpen(false); await refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <li className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{d.donorName}{d.donorCountry && <span className="ml-2 text-[15px] font-normal text-muted">{flag(d.donorCountry)} {countryName(d.donorCountry)}</span>}</p>
          <p className="text-[13px] text-muted">{d.needTitle} · {timeAgo(d.createdAt)}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl font-semibold tabular-nums">{formatAmount(d.amount, d.currency)}</p>
          {d.currency !== 'USD' && <p className="text-[13px] text-muted">≈ {money(d.amountUsd, { decimals: 2 })}</p>}
        </div>
      </div>
      {d.message && <p className="mt-3 rounded-2xl bg-sunken px-4 py-3 text-[15px] italic">“{d.message}”</p>}
      {d.thankYouNote ? (
        <p className="mt-3 flex gap-2 text-[15px] text-accent-700 dark:text-accent-400"><Heart className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> You wrote: {d.thankYouNote}</p>
      ) : open ? (
        <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (note.trim().length >= 2) thank.mutate(); }}>
          <label className="sr-only" htmlFor={`t-${d.id}`}>Thank-you note</label>
          <input id={`t-${d.id}`} className="field flex-1" maxLength={300} placeholder="Write a short thank-you…" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
          <button className="btn-primary btn-sm" disabled={thank.isPending || note.trim().length < 2}>{thank.isPending ? <Spinner /> : 'Send'}</button>
        </form>
      ) : (
        <button className="btn-ghost btn-sm mt-3" onClick={() => setOpen(true)}><Heart className="h-3.5 w-3.5" aria-hidden /> Say thank you</button>
      )}
    </li>
  );
}

export function Supporters() {
  const { data, isLoading } = useDashboard();
  if (isLoading || !data) return <PageLoader label="Loading supporters" />;
  const total = data.donations.reduce((s, d) => s + d.amountUsd, 0);
  return (
    <>
      <DashHeading title="Your supporters" body="Everyone who has given to your campaigns. Anonymous donors stay anonymous to you as well." />
      {data.donations.length === 0 ? (
        <EmptyState title="No donations yet" body="Once your campaign is live, gifts appear here in real time." />
      ) : (
        <>
          <p className="mb-5 text-[15px] text-muted">{data.donations.length} gifts · <b className="text-ink">{money(total)}</b> in total</p>
          <ul className="space-y-3">{data.donations.map((d) => <Row key={d.id} d={d} />)}</ul>
        </>
      )}
    </>
  );
}
