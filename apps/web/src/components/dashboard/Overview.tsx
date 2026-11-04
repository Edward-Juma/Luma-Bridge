'use client';

import { AlertTriangle, ArrowRight, Check, CircleDashed, Clock, MessageCircleHeart, Plus } from 'lucide-react';
import Link from 'next/link';
import type { DashboardData, NeedStatus } from '@/lib/me-types';
import { useDashboard } from '@/lib/me';
import { formatAmount, fmtDate, money, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageLoader } from '../LottieLoader';
import { ProgressBar, VerifiedBadge } from '../ui';
import { DashHeading } from './DashShell';

export const NEED_STATUS: Record<NeedStatus, { label: string; tone: string }> = {
  DRAFT: { label: 'Draft', tone: 'bg-sunken text-muted' },
  PENDING: { label: 'Under review', tone: 'bg-brand/10 text-brand' },
  NEEDS_INFO: { label: 'More info needed', tone: 'bg-warn/15 text-amber-700 dark:text-amber-400' },
  ACTIVE: { label: 'Live', tone: 'bg-accent-500/15 text-accent-700 dark:text-accent-400' },
  FUNDED: { label: 'Fully funded', tone: 'bg-accent-500/15 text-accent-700 dark:text-accent-400' },
  CLOSED: { label: 'Closed', tone: 'bg-sunken text-muted' },
  REJECTED: { label: 'Not approved', tone: 'bg-danger/10 text-danger' },
  SUSPENDED: { label: 'Suspended', tone: 'bg-danger/10 text-danger' },
};

export function StatusPill({ status }: { status: NeedStatus }) {
  const s = NEED_STATUS[status];
  return <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold', s.tone)}>{s.label}</span>;
}

function journey(d: DashboardData) {
  const needs = d.needs;
  const anySubmitted = needs.some((n) => n.status !== 'DRAFT');
  const underReview = needs.some((n) => n.status === 'PENDING' || n.status === 'NEEDS_INFO');
  const live = needs.some((n) => n.status === 'ACTIVE' || n.status === 'FUNDED');
  const verified = d.profile.verificationStatus === 'APPROVED';
  return [
    { label: 'Account created', done: true },
    { label: 'Request written', done: needs.length > 0 },
    { label: 'Submitted for review', done: anySubmitted },
    { label: 'Verified by auditors', done: verified, active: underReview },
    { label: 'Receiving donations', done: live },
  ];
}

function nextSteps(d: DashboardData) {
  const todo: { label: string; href: string }[] = [];
  const kinds = d.documents.map((x) => x.kind);
  if (!d.profile.photoUrl) todo.push({ label: 'Add a profile photo', href: '/dashboard/profile' });
  if (!kinds.some((k) => k === 'IDENTITY' || k === 'GOVERNMENT_DOCUMENT')) todo.push({ label: 'Upload your ID or passport', href: '/dashboard/documents' });
  if (!kinds.some((k) => k !== 'IDENTITY' && k !== 'GOVERNMENT_DOCUMENT')) todo.push({ label: 'Upload a supporting document (medical report, school letter, rent notice…)', href: '/dashboard/documents' });
  if (!d.paymentMethods.length) todo.push({ label: 'Add how you want to receive donations', href: '/dashboard/payments' });
  if (!d.needs.length) todo.push({ label: 'Write your request', href: '/dashboard/campaigns/new' });
  else if (d.needs.every((n) => n.status === 'DRAFT')) todo.push({ label: 'Submit your request for review', href: `/dashboard/campaigns/${d.needs[0]!.id}` });
  return todo;
}

function Ring({ value }: { value: number }) {
  const r = 34, c = 2 * Math.PI * r;
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" role="img" aria-label={`Profile ${value}% complete`}>
      <circle cx="44" cy="44" r={r} fill="none" strokeWidth="8" className="stroke-sunken" />
      <circle cx="44" cy="44" r={r} fill="none" strokeWidth="8" strokeLinecap="round" stroke="url(#g)" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} transform="rotate(-90 44 44)" style={{ transition: 'stroke-dashoffset 1s ease' }} />
      <defs>
        <linearGradient id="g" x1="0" x2="1"><stop offset="0" stopColor="#2563EB" /><stop offset="1" stopColor="#10B981" /></linearGradient>
      </defs>
      <text x="44" y="50" textAnchor="middle" className="fill-ink font-display text-[20px] font-semibold">{value}%</text>
    </svg>
  );
}

export function Overview() {
  const { data, isLoading, error } = useDashboard();
  if (isLoading) return <PageLoader label="Loading your dashboard" />;
  if (error || !data) return <p className="card p-6 text-danger">We could not load your dashboard. Please refresh.</p>;

  const { profile, feedback } = data;
  const steps = journey(data);
  const todo = nextSteps(data);
  const raised = data.needs.reduce((s, n) => s + n.raisedUsd, 0);
  const supporters = data.donations.length;
  const withMessage = data.donations.filter((d) => d.message).slice(0, 4);

  return (
    <>
      <DashHeading
        title={`Hello, ${profile.fullName.split(' ')[0]}`}
        body="Here is where your request stands and what to do next."
        action={<Link href="/dashboard/campaigns/new" className="btn-primary"><Plus className="h-4 w-4" aria-hidden /> New request</Link>}
      />

      {feedback && (
        <div role="status" className={cn('mb-6 flex gap-4 rounded-3xl border p-5', feedback.decision === 'REJECT' ? 'border-danger/30 bg-danger/5' : 'border-warn/40 bg-warn/10')}>
          <AlertTriangle className={cn('mt-0.5 h-5 w-5 shrink-0', feedback.decision === 'REJECT' ? 'text-danger' : 'text-amber-600')} aria-hidden />
          <div>
            <p className="font-semibold">{feedback.decision === 'REJECT' ? 'An auditor could not approve your request' : 'Auditors need a little more information'}</p>
            <p className="mt-1 text-[15px] text-ink/80">{feedback.notes}</p>
            <p className="mt-2 text-[13px] text-muted">{timeAgo(feedback.at)}</p>
          </div>
        </div>
      )}

      <section aria-label="Verification progress" className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Verification journey</h2>
          {profile.verificationStatus === 'APPROVED' ? <VerifiedBadge id={profile.verificationId} /> : <span className="text-sm text-muted">Nothing is public until an auditor approves it.</span>}
        </div>
        <ol className="mt-6 grid gap-4 sm:grid-cols-5">
          {steps.map((s, i) => (
            <li key={s.label} className="flex items-center gap-3 sm:flex-col sm:items-start">
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1', s.done ? 'bg-accent-500 text-white ring-accent-500' : s.active ? 'bg-brand/10 text-brand ring-brand/40' : 'bg-sunken text-muted ring-line')}>
                {s.done ? <Check className="h-4 w-4" aria-hidden /> : s.active ? <Clock className="h-4 w-4" aria-hidden /> : <CircleDashed className="h-4 w-4" aria-hidden />}
              </span>
              <span className={cn('text-[15px] font-medium', s.done ? 'text-ink' : 'text-muted')}>
                <span className="sr-only">Step {i + 1}: </span>{s.label}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_1.1fr]">
        <section className="card flex items-start gap-5 p-6" aria-label="Profile completion">
          <Ring value={profile.profileCompletion} />
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">{todo.length ? 'Next steps' : 'All set'}</h2>
            {todo.length ? (
              <ul className="mt-3 space-y-2">
                {todo.map((t) => (
                  <li key={t.label}>
                    <Link href={t.href} className="group flex items-start gap-2 text-[15px] text-ink/85 hover:text-brand">
                      <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 transition group-hover:translate-x-0.5" aria-hidden />{t.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[15px] text-muted">Your profile is complete. Keep supporters updated by posting progress on your campaign.</p>
            )}
          </div>
        </section>

        <section className="grid grid-cols-3 gap-3" aria-label="Totals">
          {[
            { label: 'Raised', value: money(raised) },
            { label: 'Still needed', value: money(data.remainingUsd) },
            { label: 'Supporters', value: String(supporters) },
          ].map((s) => (
            <div key={s.label} className="card flex flex-col justify-center p-5">
              <p className="text-[13px] font-medium text-muted">{s.label}</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums md:text-3xl">{s.value}</p>
            </div>
          ))}
        </section>
      </div>

      <section className="mt-10" aria-label="Your requests">
        <h2 className="mb-4 text-xl font-semibold">Your requests</h2>
        {data.needs.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-line p-10 text-center">
            <p className="font-display text-lg font-semibold">You have not written a request yet</p>
            <p className="mx-auto mt-1 max-w-md text-muted">Tell your story, set a goal, and submit it. Auditors take it from there.</p>
            <Link href="/dashboard/campaigns/new" className="btn-primary mt-5">Write my request</Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {data.needs.map((n) => (
              <li key={n.id}>
                <Link href={`/dashboard/campaigns/${n.id}`} className="card block p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{n.title}</p>
                    <StatusPill status={n.status} />
                  </div>
                  {(n.status === 'ACTIVE' || n.status === 'FUNDED') && (
                    <div className="mt-4">
                      <ProgressBar percent={n.goalUsd ? (n.raisedUsd / n.goalUsd) * 100 : 0} />
                      <p className="mt-2 text-sm text-muted"><b className="text-ink">{money(n.raisedUsd)}</b> of {money(n.goalUsd)} · {n.donationCount} gifts</p>
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {withMessage.length > 0 && (
        <section className="mt-10" aria-label="Messages from supporters">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold"><MessageCircleHeart className="h-5 w-5 text-accent-600" aria-hidden /> Messages from supporters</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {withMessage.map((d) => (
              <li key={d.id} className="card p-5">
                <p className="text-[15px] italic text-ink/85">“{d.message}”</p>
                <p className="mt-3 text-[13px] text-muted">{d.donorName} · {formatAmount(d.amount, d.currency)} · {fmtDate(d.createdAt)}</p>
              </li>
            ))}
          </ul>
          <Link href="/dashboard/donations" className="mt-4 inline-flex items-center gap-1 font-semibold text-brand">Thank your supporters <ArrowRight className="h-4 w-4" aria-hidden /></Link>
        </section>
      )}
    </>
  );
}
