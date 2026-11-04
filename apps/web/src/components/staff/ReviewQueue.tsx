'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronRight, ShieldAlert, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { countryName, flag } from '@/lib/countries';
import { CATEGORY_LABEL, money, timeAgo } from '@/lib/format';
import { errMsg } from '@/lib/me';
import type { QueueItem } from '@/lib/me-types';
import { cn } from '@/lib/utils';
import { PageLoader } from '../LottieLoader';
import { EmptyState, Input, Spinner, UrgencyBadge } from '../ui';
import { useOverview } from './StaffShell';

const TABS = [
  { key: 'PENDING', label: 'Awaiting review' },
  { key: 'NEEDS_INFO', label: 'Waiting on applicant' },
  { key: 'ACTIVE', label: 'Live' },
  { key: 'SUSPENDED', label: 'Suspended' },
  { key: 'REJECTED', label: 'Rejected' },
] as const;

export function RiskChip({ score }: { score: number }) {
  const tone = score >= 80 ? 'bg-danger/12 text-danger ring-danger/30' : score >= 60 ? 'bg-orange-500/12 text-orange-600 ring-orange-500/30' : score >= 40 ? 'bg-warn/15 text-amber-700 ring-warn/30 dark:text-amber-400' : 'bg-accent-500/12 text-accent-700 ring-accent-500/25 dark:text-accent-400';
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ring-1', tone)}>{score >= 60 && <ShieldAlert className="h-3.5 w-3.5" aria-hidden />}Risk {score}</span>;
}

export function ReviewQueue() {
  const { user } = useAuth();
  const [status, setStatus] = useState<(typeof TABS)[number]['key']>('PENDING');
  const [page, setPage] = useState(1);
  const ov = useOverview();
  const q = useQuery({
    queryKey: ['staff', 'queue', status, page],
    queryFn: () => api<{ total: number; items: QueueItem[] }>(`/api/staff/queue?status=${status}&page=${page}`),
  });

  const stats = [
    { label: 'Awaiting review', value: ov.data?.pending },
    { label: 'Open alerts', value: ov.data?.alerts, danger: (ov.data?.criticalAlerts ?? 0) > 0 },
    { label: 'Community reports', value: ov.data?.reports },
    { label: 'Decided in 24h', value: ov.data?.decidedToday },
    { label: 'Suspended accounts', value: ov.data?.suspended },
  ];

  return (
    <>
      <section aria-label="Overview" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className={cn('card p-5', s.danger && 'border-danger/40')}>
            <p className="text-[13px] font-medium text-muted">{s.label}</p>
            <p className={cn('mt-1 font-display text-3xl font-semibold tabular-nums', s.danger && 'text-danger')}>{s.value ?? '–'}</p>
          </div>
        ))}
      </section>

      <div role="tablist" aria-label="Queue" className="no-scrollbar mt-8 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={status === t.key} onClick={() => { setStatus(t.key); setPage(1); }} className={cn('-mb-px whitespace-nowrap border-b-2 px-4 py-3 text-[15px] font-medium transition', status === t.key ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink')}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6" role="tabpanel">
        {q.isLoading ? (
          <PageLoader label="Loading applications" />
        ) : !q.data?.items.length ? (
          <EmptyState title="Nothing here" body={status === 'PENDING' ? 'The review queue is clear. Nice work.' : 'No applications in this state.'} />
        ) : (
          <ul className="space-y-3">
            {q.data.items.map((a) => (
              <li key={a.needId}>
                <Link href={`/staff/applications/${a.needId}`} className="card group flex flex-wrap items-center gap-x-6 gap-y-3 p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
                  <div className="min-w-[220px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{a.title}</p>
                      <UrgencyBadge priority={a.priority} />
                      {a.returning && <span className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">Returning</span>}
                    </div>
                    <p className="mt-1 text-[15px] text-muted">{a.applicant.name} · {a.applicant.city}, {flag(a.applicant.country)} {countryName(a.applicant.country)} · {CATEGORY_LABEL[a.category]}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted">
                    <span className="font-semibold text-ink">{money(a.goalUsd)}</span>
                    <span>{a.documentCount} docs{a.lowestDocScore !== null && ` · lowest AI ${Math.round(a.lowestDocScore * 100)}%`}</span>
                    {a.reports > 0 && <span className="inline-flex items-center gap-1 font-semibold text-danger"><AlertTriangle className="h-3.5 w-3.5" aria-hidden />{a.reports} report{a.reports > 1 ? 's' : ''}</span>}
                    <span>{timeAgo(a.submittedAt)}</span>
                    <RiskChip score={a.fraudScore} />
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted transition group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {q.data && q.data.total > 20 && (
          <div className="mt-6 flex items-center justify-center gap-3">
            <button className="btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <span className="text-sm text-muted">Page {page} of {Math.ceil(q.data.total / 20)}</span>
            <button className="btn-ghost btn-sm" disabled={page * 20 >= q.data.total} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        )}
      </div>

      {user?.role === 'ADMIN' && <AddAuditor />}
    </>
  );
}

function AddAuditor() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const m = useMutation({
    mutationFn: () => api('/api/staff/auditors', { method: 'POST', json: { email, password } }),
    onSuccess: () => { toast.success('Auditor created. They will set up two-step verification at first sign-in.'); setEmail(''); setPassword(''); },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <section className="card mt-12 p-6" aria-label="Add an auditor">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><UserPlus className="h-5 w-5 text-brand" aria-hidden /> Add an auditor <span className="rounded-full bg-sunken px-2 py-0.5 text-xs font-semibold text-muted">Admin only</span></h2>
      <form className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
        <Input label="Work email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Temporary password" type="password" autoComplete="new-password" hint="10+ chars, mixed case and a number" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn-primary" disabled={!email || password.length < 10 || m.isPending}>{m.isPending ? <Spinner /> : 'Create'}</button>
      </form>
    </section>
  );
}
