'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Ban, Check, CheckCircle2, Eye, FileSearch, MessageSquareWarning, PauseCircle, PlayCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { countryName, flag } from '@/lib/countries';
import { CATEGORY_LABEL, DOC_LABEL, PAYMENT_LABEL, fmtDate, money, timeAgo } from '@/lib/format';
import { errMsg } from '@/lib/me';
import type { ApplicationDetail, Checklist } from '@/lib/me-types';
import { cn } from '@/lib/utils';
import { PageLoader } from '../LottieLoader';
import { Avatar, Textarea, Spinner, UrgencyBadge } from '../ui';
import { DocViewer } from './DocViewer';
import { RiskChip } from './ReviewQueue';

const CORE: { key: keyof Checklist; label: string }[] = [
  { key: 'identity', label: 'Identity confirmed' },
  { key: 'documents', label: 'Documents authentic' },
  { key: 'location', label: 'Location verified' },
  { key: 'legitimacy', label: 'Need is legitimate' },
  { key: 'income', label: 'Income consistent' },
  { key: 'references', label: 'References checked' },
];
const EXTRA: { key: keyof Checklist; label: string }[] = [
  { key: 'videoInterview', label: 'Video interview' },
  { key: 'fieldVisit', label: 'Field visit' },
  { key: 'governmentVerified', label: 'Government document verified' },
  { key: 'ngoVerified', label: 'NGO verified' },
  { key: 'communityLeader', label: 'Community leader verified' },
  { key: 'employer', label: 'Employer verified' },
  { key: 'hospital', label: 'Hospital verified' },
  { key: 'school', label: 'School verified' },
];
const EMPTY: Checklist = { identity: false, documents: false, location: false, legitimacy: false, income: false, references: false, videoInterview: false, fieldVisit: false, governmentVerified: false, ngoVerified: false, communityLeader: false, employer: false, hospital: false, school: false };

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('card p-5 md:p-6', className)}>
      <h2 className="mb-4 font-sans text-base font-semibold tracking-normal">{title}</h2>
      {children}
    </section>
  );
}
const KV = ({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) => (
  <div><dt className="text-[13px] text-muted">{k}</dt><dd className={cn('break-words font-medium', mono && 'font-mono text-[14px]')}>{v || '—'}</dd></div>
);

export function ApplicationReview({ needId }: { needId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [viewing, setViewing] = useState<{ id: string; kind: string; mime: string } | null>(null);
  const key = ['staff', 'application', needId];
  const q = useQuery({ queryKey: key, queryFn: () => api<ApplicationDetail>(`/api/staff/applications/${needId}`), staleTime: 0 });
  const invalidate = () => Promise.all([qc.invalidateQueries({ queryKey: key }), qc.invalidateQueries({ queryKey: ['staff'] })]);

  const resolve = useMutation({
    mutationFn: (id: string) => api(`/api/staff/alerts/${id}/resolve`, { method: 'POST' }),
    onSuccess: invalidate,
    onError: (e) => toast.error(errMsg(e)),
  });

  if (q.isLoading) return <PageLoader label="Opening application" />;
  if (q.error || !q.data) return <div className="card p-8 text-center"><p className="font-display text-xl font-semibold">Application not found</p><Link href="/staff" className="btn-primary mt-4">Back to queue</Link></div>;

  const d = q.data;
  const a = d.applicant;
  const reviewable = d.need.status === 'PENDING' || d.need.status === 'NEEDS_INFO';
  const openAlerts = d.alerts.filter((x) => !x.resolved);

  return (
    <>
      <Link href="/staff" className="mb-4 inline-flex items-center gap-1.5 text-[15px] font-medium text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" aria-hidden /> Review queue</Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Avatar src={a.photoUrl} name={a.fullName} size={64} />
          <div>
            <h1 className="text-2xl font-semibold md:text-3xl">{d.need.title}</h1>
            <p className="mt-1 text-muted">{a.fullName} · {a.city}, {flag(a.country)} {countryName(a.country)} · {CATEGORY_LABEL[d.need.category]} · goal <b className="text-ink">{money(d.need.goalUsd)}</b></p>
            <div className="mt-2 flex flex-wrap gap-2"><UrgencyBadge priority={d.need.priority} /><RiskChip score={d.risk.score} /><span className="rounded-full bg-sunken px-2.5 py-1 text-xs font-semibold">{d.need.status.replace('_', ' ')}</span></div>
          </div>
        </div>
      </header>

      {(d.risk.score >= 40 || d.related.length > 0 || d.reports.length > 0) && (
        <section role="alert" className="mb-6 rounded-3xl border border-warn/40 bg-warn/10 p-5">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden /> Review flags</p>
          <ul className="mt-3 list-disc space-y-1.5 pl-6 text-[15px]">
            {d.risk.reasons.map((r) => <li key={r.code}><b>{r.code.replaceAll('_', ' ').toLowerCase()}</b> (+{r.weight}): {r.detail}</li>)}
            {d.related.map((r) => <li key={r.id}>Shares an identifier with <b>{r.fullName}</b> ({countryName(r.country)}, {r.verificationStatus.toLowerCase()})</li>)}
            {d.reports.map((r) => <li key={r.id}>Community report: <b>{r.reason.replaceAll('_', ' ').toLowerCase()}</b>{r.details ? ` — ${r.details}` : ''}</li>)}
          </ul>
          {openAlerts.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {openAlerts.map((al) => (
                <button key={al.id} className="btn-ghost btn-sm" onClick={() => resolve.mutate(al.id)} disabled={resolve.isPending}>
                  <Check className="h-3.5 w-3.5" aria-hidden /> Resolve {al.type.replaceAll('_', ' ').toLowerCase()} ({al.severity.toLowerCase()})
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card title="Their story">
            <p className="font-medium">{d.need.summary}</p>
            <p className="mt-3 whitespace-pre-line text-[15px] text-ink/85">{d.need.story}</p>
            {d.need.images.length > 0 && (
              <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {d.need.images.map((s) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <li key={s}><img src={s} alt="" className="aspect-square w-full rounded-xl object-cover" /></li>
                ))}
              </ul>
            )}
            {d.need.deadline && <p className="mt-4 text-[13px] text-muted">Needed by {fmtDate(d.need.deadline)}</p>}
          </Card>

          <Card title={`Documents (${d.documents.length})`}>
            {d.documents.length === 0 ? <p className="text-muted">No documents uploaded.</p> : (
              <ul className="divide-y divide-line">
                {d.documents.map((doc) => (
                  <li key={doc.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{DOC_LABEL[doc.kind] ?? doc.kind}</p>
                      <p className="text-[13px] text-muted">{fmtDate(doc.createdAt)} · {Math.max(1, Math.round(doc.sizeBytes / 1024))} KB</p>
                      {doc.aiNotes && <p className="mt-1 text-[13px] text-muted">AI: {doc.aiNotes}</p>}
                    </div>
                    {doc.aiScore !== null && (
                      <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold ring-1', doc.aiScore >= 0.7 ? 'bg-accent-500/12 text-accent-700 ring-accent-500/25 dark:text-accent-400' : doc.aiScore >= 0.5 ? 'bg-warn/15 text-amber-700 ring-warn/30 dark:text-amber-400' : 'bg-danger/12 text-danger ring-danger/30')}>
                        AI {Math.round(doc.aiScore * 100)}%
                      </span>
                    )}
                    <button className="btn-ghost btn-sm" onClick={() => setViewing({ id: doc.id, kind: doc.kind, mime: doc.mime })}><Eye className="h-3.5 w-3.5" aria-hidden /> Open</button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Payout methods (decrypted)">
            {d.paymentMethods.length === 0 ? <p className="text-muted">None added.</p> : (
              <ul className="space-y-3">
                {d.paymentMethods.map((p) => (
                  <li key={p.id} className="rounded-2xl bg-sunken p-4 text-[15px]">
                    <p className="font-semibold">{p.label} <span className="font-normal text-muted">· {PAYMENT_LABEL[p.type] ?? p.type}</span></p>
                    <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                      {Object.entries(p.details).map(([k, v]) => <div key={k} className="flex gap-2"><dt className="text-muted">{k}:</dt><dd className="break-all font-mono text-[13px]">{v}</dd></div>)}
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Review history">
            {d.history.length === 0 ? <p className="text-muted">No previous decisions.</p> : (
              <ol className="space-y-4">
                {d.history.map((h) => (
                  <li key={h.id} className="border-l-2 border-line pl-4">
                    <p className="text-[15px] font-semibold">{h.decision.replace('_', ' ').toLowerCase()} <span className="font-normal text-muted">· {h.auditor} · {timeAgo(h.createdAt)}</span></p>
                    <p className="mt-1 text-[15px] text-ink/85">{h.notes}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <DecisionPanel needId={needId} reviewable={reviewable} blockedByRisk={d.risk.score >= 80 && user?.role !== 'ADMIN'} onDone={invalidate} />

          <Card title="Applicant (private)">
            <dl className="grid gap-4 text-[15px] sm:grid-cols-2">
              <KV k="Full name" v={a.fullName} />
              <KV k="National ID / passport" v={a.nationalId} mono />
              <KV k="Date of birth" v={fmtDate(a.dateOfBirth)} />
              <KV k="Gender" v={a.gender.toLowerCase()} />
              <KV k="Phone" v={a.phone} />
              <KV k="Email" v={a.email} />
              <KV k="Address" v={a.address} />
              <KV k="Occupation" v={a.occupation} />
              <KV k="Income level" v={a.incomeLevel.replace('_', ' ').toLowerCase()} />
              <KV k="Household" v={`${a.familySize} people`} />
              <KV k="Emergency contact" v={`${a.emergencyContactName} · ${a.emergencyContactPhone}`} />
              <KV k="Joined" v={fmtDate(a.joinedAt)} />
              <KV k="Signup IP" v={a.signupIp} mono />
              <KV k="Last IP" v={a.lastIp} mono />
            </dl>
            <p className="mt-4 rounded-2xl bg-sunken p-3 text-[15px]">{a.about}</p>
            <p className="mt-3 flex items-center gap-1.5 text-[13px] text-muted"><FileSearch className="h-3.5 w-3.5" aria-hidden /> Viewing this record was written to the audit log.</p>
          </Card>

          <AccountActions beneficiaryId={a.id} status={a.accountStatus} isAdmin={user?.role === 'ADMIN'} onDone={invalidate} />
        </div>
      </div>

      <DocViewer doc={viewing} onClose={() => setViewing(null)} />
    </>
  );
}

function DecisionPanel({ needId, reviewable, blockedByRisk, onDone }: { needId: string; reviewable: boolean; blockedByRisk: boolean; onDone: () => Promise<unknown> }) {
  const [list, setList] = useState<Checklist>(EMPTY);
  const [notes, setNotes] = useState('');
  const core = CORE.slice(0, 5).every((c) => list[c.key]);
  const m = useMutation({
    mutationFn: (decision: 'APPROVE' | 'REJECT' | 'REQUEST_INFO') => api(`/api/staff/applications/${needId}/review`, { method: 'POST', json: { decision, notes, checklist: list } }),
    onSuccess: async (_r, decision) => {
      toast.success(decision === 'APPROVE' ? 'Approved. The campaign is now live.' : decision === 'REJECT' ? 'Application rejected.' : 'Requested more information.');
      await onDone();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const notesOk = notes.trim().length >= 10;
  const act = (d: 'APPROVE' | 'REJECT' | 'REQUEST_INFO') => {
    if (d === 'REJECT' && !confirm('Reject this application? The applicant will be told your note.')) return;
    m.mutate(d);
  };

  return (
    <section className="card p-5 md:p-6" aria-label="Decision">
      <h2 className="mb-1 font-sans text-base font-semibold tracking-normal">Verification checklist</h2>
      <p className="mb-4 text-[13px] text-muted">The first five checks are required to approve.</p>
      <fieldset disabled={!reviewable || m.isPending} className="space-y-4">
        <legend className="sr-only">Checklist</legend>
        <div className="grid gap-2">
          {CORE.map((c) => (
            <label key={c.key} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-[15px] hover:bg-sunken">
              <input type="checkbox" className="h-4 w-4 accent-brand" checked={list[c.key]} onChange={(e) => setList({ ...list, [c.key]: e.target.checked })} /> {c.label}
            </label>
          ))}
        </div>
        <details className="rounded-xl border border-line px-3 py-2">
          <summary className="cursor-pointer text-[15px] font-medium">Additional verification</summary>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            {EXTRA.map((c) => (
              <label key={c.key} className="flex cursor-pointer items-center gap-2.5 py-1 text-[14px]">
                <input type="checkbox" className="h-4 w-4 accent-brand" checked={list[c.key]} onChange={(e) => setList({ ...list, [c.key]: e.target.checked })} /> {c.label}
              </label>
            ))}
          </div>
        </details>
        <Textarea label="Notes for the record" rows={4} hint="Shared with the applicant when you reject or request information. Min 10 characters." value={notes} onChange={(e) => setNotes(e.target.value)} />
        {!reviewable && <p className="text-[13px] text-muted">This application is not awaiting a decision.</p>}
        {blockedByRisk && <p className="text-[13px] font-medium text-danger">Critical risk score: only an admin can approve.</p>}
        <div className="grid gap-2">
          <button type="button" className="btn-accent" disabled={!core || !notesOk || blockedByRisk} onClick={() => act('APPROVE')}>{m.isPending ? <Spinner /> : <><CheckCircle2 className="h-4 w-4" aria-hidden /> Approve and verify</>}</button>
          <button type="button" className="btn-ghost" disabled={!notesOk} onClick={() => act('REQUEST_INFO')}><MessageSquareWarning className="h-4 w-4" aria-hidden /> Request more information</button>
          <button type="button" className="btn-ghost !text-danger" disabled={!notesOk} onClick={() => act('REJECT')}><XCircle className="h-4 w-4" aria-hidden /> Reject</button>
        </div>
      </fieldset>
    </section>
  );
}

function AccountActions({ beneficiaryId, status, isAdmin, onDone }: { beneficiaryId: string; status: string; isAdmin: boolean; onDone: () => Promise<unknown> }) {
  const [reason, setReason] = useState('');
  const [days, setDays] = useState('14');
  const m = useMutation({
    mutationFn: (action: 'SUSPEND' | 'BAN' | 'REINSTATE') => api(`/api/staff/beneficiaries/${beneficiaryId}/account`, { method: 'POST', json: { action, reason, ...(action === 'SUSPEND' && days ? { days: Number(days) } : {}) } }),
    onSuccess: async () => { toast.success('Account updated'); setReason(''); await onDone(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const ok = reason.trim().length >= 5;
  return (
    <section className="card p-5 md:p-6" aria-label="Account actions">
      <h2 className="mb-1 font-sans text-base font-semibold tracking-normal">Account status: <span className={cn(status !== 'ACTIVE' && 'text-danger')}>{status.toLowerCase()}</span></h2>
      <p className="mb-4 text-[13px] text-muted">Suspending hides live campaigns and signs the user out immediately.</p>
      <label className="label" htmlFor="acct-reason">Reason (recorded)</label>
      <input id="acct-reason" className="field" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {status === 'ACTIVE' ? (
          <>
            <label className="sr-only" htmlFor="days">Days</label>
            <input id="days" type="number" min={1} max={365} className="field w-20" value={days} onChange={(e) => setDays(e.target.value)} />
            <span className="text-sm text-muted">days</span>
            <button className="btn-ghost btn-sm" disabled={!ok || m.isPending} onClick={() => m.mutate('SUSPEND')}><PauseCircle className="h-3.5 w-3.5" aria-hidden /> Suspend</button>
            {isAdmin && <button className="btn-ghost btn-sm !text-danger" disabled={!ok || m.isPending} onClick={() => { if (confirm('Permanently ban this account?')) m.mutate('BAN'); }}><Ban className="h-3.5 w-3.5" aria-hidden /> Ban permanently</button>}
          </>
        ) : status === 'SUSPENDED' ? (
          <button className="btn-ghost btn-sm" disabled={!ok || m.isPending} onClick={() => m.mutate('REINSTATE')}><PlayCircle className="h-3.5 w-3.5" aria-hidden /> Reinstate</button>
        ) : <p className="text-sm text-muted">Permanently banned.</p>}
      </div>
    </section>
  );
}
