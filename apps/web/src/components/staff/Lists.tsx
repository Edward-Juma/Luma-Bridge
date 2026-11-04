'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { countryName, flag } from '@/lib/countries';
import { fmtDate, timeAgo } from '@/lib/format';
import { errMsg } from '@/lib/me';
import type { AuditRow, FraudAlertRow, ReportRow } from '@/lib/me-types';
import { cn } from '@/lib/utils';
import { PageLoader } from '../LottieLoader';
import { EmptyState } from '../ui';

const SEV: Record<string, string> = {
  CRITICAL: 'bg-danger/12 text-danger ring-danger/30',
  HIGH: 'bg-orange-500/12 text-orange-600 ring-orange-500/30',
  MEDIUM: 'bg-warn/15 text-amber-700 ring-warn/30 dark:text-amber-400',
  LOW: 'bg-sunken text-muted ring-line',
};

function Title({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-semibold">{children}</h1>{right}</div>;
}

export function Alerts() {
  const [resolved, setResolved] = useState(false);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['staff', 'alerts', resolved], queryFn: () => api<{ items: FraudAlertRow[] }>(`/api/staff/alerts?resolved=${resolved}`) });
  const res = useMutation({
    mutationFn: (id: string) => api(`/api/staff/alerts/${id}/resolve`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <>
      <Title right={<div className="flex rounded-full border border-line p-1 text-sm" role="group" aria-label="Filter">
        {[false, true].map((v) => <button key={String(v)} aria-pressed={resolved === v} onClick={() => setResolved(v)} className={cn('rounded-full px-4 py-1.5 font-medium', resolved === v ? 'bg-brand text-white' : 'text-muted')}>{v ? 'Resolved' : 'Open'}</button>)}
      </div>}>Fraud alerts</Title>
      {q.isLoading ? <PageLoader label="Loading alerts" /> : !q.data?.items.length ? <EmptyState title="No alerts" body={resolved ? 'Nothing has been resolved yet.' : 'No open fraud alerts. The system is quiet.'} /> : (
        <ul className="space-y-3">
          {q.data.items.map((a) => (
            <li key={a.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold ring-1', SEV[a.severity])}>{a.severity}</span>
                    <p className="font-semibold">{a.type.replaceAll('_', ' ').toLowerCase()}</p>
                    <span className="text-[13px] text-muted">score {a.score} · {timeAgo(a.createdAt)}</span>
                  </div>
                  {a.beneficiary && <p className="mt-1 text-[15px] text-muted">{a.beneficiary.fullName} · {flag(a.beneficiary.country)} {countryName(a.beneficiary.country)}</p>}
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[14px] text-ink/85">
                    {(a.details?.reasons ?? []).map((r) => <li key={r.code}>{r.detail}</li>)}
                  </ul>
                </div>
                <div className="flex gap-2">
                  {a.need && <Link href={`/staff/applications/${a.need.id}`} className="btn-ghost btn-sm">Review <ExternalLink className="h-3.5 w-3.5" aria-hidden /></Link>}
                  {!a.resolved && <button className="btn-primary btn-sm" disabled={res.isPending} onClick={() => res.mutate(a.id)}><Check className="h-3.5 w-3.5" aria-hidden /> Resolve</button>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function Reports() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['staff', 'reports'], queryFn: () => api<{ items: ReportRow[] }>('/api/staff/reports') });
  const set = useMutation({
    mutationFn: (v: { id: string; status: 'REVIEWING' | 'DISMISSED' | 'ACTIONED' }) => api(`/api/staff/reports/${v.id}`, { method: 'POST', json: { status: v.status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <>
      <Title>Community reports</Title>
      {q.isLoading ? <PageLoader label="Loading reports" /> : !q.data?.items.length ? <EmptyState title="No open reports" body="When someone reports a campaign it shows up here." /> : (
        <ul className="space-y-3">
          {q.data.items.map((r) => (
            <li key={r.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{r.reason.replaceAll('_', ' ').toLowerCase()} <span className="font-normal text-muted">· {r.status.toLowerCase()} · {timeAgo(r.createdAt)}</span></p>
                  <p className="mt-1 text-[15px]">Campaign: <Link className="font-medium text-brand underline-offset-4 hover:underline" href={`/staff/applications/${r.need.id}`}>{r.need.title}</Link></p>
                  {r.details && <p className="mt-2 rounded-2xl bg-sunken px-4 py-3 text-[15px]">{r.details}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.status === 'OPEN' && <button className="btn-ghost btn-sm" onClick={() => set.mutate({ id: r.id, status: 'REVIEWING' })}>Start review</button>}
                  <button className="btn-ghost btn-sm" onClick={() => set.mutate({ id: r.id, status: 'DISMISSED' })}>Dismiss</button>
                  <button className="btn-primary btn-sm" onClick={() => set.mutate({ id: r.id, status: 'ACTIONED' })}>Mark actioned</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function AuditLog() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const q = useQuery({
    queryKey: ['staff', 'audit', page, action],
    queryFn: () => api<{ total: number; items: AuditRow[] }>(`/api/staff/audit-log?page=${page}${action ? `&action=${encodeURIComponent(action)}` : ''}`),
  });
  return (
    <>
      <Title right={
        <div>
          <label className="sr-only" htmlFor="af">Filter by action</label>
          <select id="af" className="field w-auto" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
            <option value="">All activity</option>
            <option value="review.">Decisions</option>
            <option value="pii.">PII access</option>
            <option value="document.">Documents</option>
            <option value="account.">Account actions</option>
            <option value="auth.">Sign-ins</option>
          </select>
        </div>
      }>Activity log</Title>
      {q.isLoading ? <PageLoader label="Loading log" /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[14px]">
            <thead className="border-b border-line text-[13px] text-muted">
              <tr><th className="px-4 py-3 font-medium">When</th><th className="px-4 py-3 font-medium">Who</th><th className="px-4 py-3 font-medium">Action</th><th className="px-4 py-3 font-medium">Target</th><th className="px-4 py-3 font-medium">IP</th></tr>
            </thead>
            <tbody>
              {q.data?.items.map((r) => (
                <tr key={r.id} className="border-b border-line/60 last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted" title={new Date(r.createdAt).toLocaleString()}>{fmtDate(r.createdAt)} {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-4 py-2.5">{r.actor?.email ?? 'system'}</td>
                  <td className="px-4 py-2.5 font-mono text-[13px]">{r.action}</td>
                  <td className="px-4 py-2.5 text-muted">{r.entity}{r.entityId ? ` · ${r.entityId.slice(0, 8)}` : ''}</td>
                  <td className="px-4 py-2.5 font-mono text-[13px] text-muted">{r.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {q.data && q.data.total > 50 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button className="btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span className="text-sm text-muted">Page {page} of {Math.ceil(q.data.total / 50)}</span>
          <button className="btn-ghost btn-sm" disabled={page * 50 >= q.data.total} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </>
  );
}
