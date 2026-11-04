'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BadgeCheck, CalendarCheck, Clock, EyeOff, Flag, HeartHandshake, MapPin, MessageCircle, Share2, Users, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError, api } from '@/lib/api';
import { countryName, flag } from '@/lib/countries';
import { CATEGORY_LABEL, DOC_LABEL, PAYMENT_LABEL, daysLeft, fmtDate, formatAmount, money, timeAgo } from '@/lib/format';
import type { NeedDetail } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CATEGORY_ICON } from '../home/Categories';
import { useDonate } from '../DonateModal';
import { Avatar, ProgressBar, Spinner, UrgencyBadge, VerifiedBadge } from '../ui';

export function NeedDetailView({ slug, initial }: { slug: string; initial: NeedDetail }) {
  const { data: need = initial } = useQuery({
    queryKey: ['need', slug],
    queryFn: () => api<NeedDetail>(`/api/needs/${encodeURIComponent(slug)}`, { auth: false }),
    initialData: initial,
    refetchInterval: 15_000,
  });
  const { open } = useDonate();
  const [active, setActive] = useState(0);
  const b = need.beneficiary;
  const gallery = [need.coverUrl, ...need.images].filter((x, i, a): x is string => Boolean(x) && a.indexOf(x) === i);
  const left = daysLeft(need.deadline);
  const funded = need.percent >= 100 || need.status === 'FUNDED';
  const Icon = CATEGORY_ICON[need.category];
  const donate = () => open({ id: need.id, slug: need.slug, title: need.title, name: b.name });

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: need.title, text: need.summary, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied');
      }
    } catch {
      /* user cancelled */
    }
  }

  return (
    <div className="container pb-16 pt-4 md:pt-8">
      <Link href="/needs" className="mb-5 inline-flex items-center gap-1.5 rounded-full text-[15px] font-medium text-muted transition hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All campaigns
      </Link>

      <div className="grid gap-10 lg:grid-cols-[1fr_390px] xl:gap-14">
        <article className="min-w-0">
          {/* Gallery */}
          <div className="overflow-hidden rounded-[2rem] border border-line bg-sunken">
            {gallery.length > 0 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={gallery[active]} alt={`${need.title}: photo ${active + 1} of ${gallery.length}`} className="aspect-[16/10] w-full object-cover" />
            ) : (
              <div className="aspect-[16/10]" />
            )}
          </div>
          {gallery.length > 1 && (
            <ul className="no-scrollbar mt-3 flex gap-2.5 overflow-x-auto" aria-label="Photo gallery">
              {gallery.map((g, i) => (
                <li key={g}>
                  <button type="button" onClick={() => setActive(i)} aria-label={`Show photo ${i + 1}`} aria-current={i === active} className={cn('block overflow-hidden rounded-2xl ring-2 ring-offset-2 ring-offset-page transition', i === active ? 'ring-brand' : 'ring-transparent opacity-70 hover:opacity-100')}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g} alt="" className="h-16 w-24 object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-2">
            <VerifiedBadge id={b.verificationId} />
            <UrgencyBadge priority={need.priority} />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sunken px-2.5 py-1 text-xs font-semibold text-muted ring-1 ring-line"><Icon className="h-3.5 w-3.5" aria-hidden /> {CATEGORY_LABEL[need.category]}</span>
          </div>
          <h1 className="mt-4 text-3xl font-semibold leading-[1.08] md:text-5xl">{need.title}</h1>

          <div className="mt-6 flex items-center gap-4 rounded-3xl border border-line bg-surface p-4">
            <Avatar src={b.photoUrl} name={b.name} size={60} />
            <div className="min-w-0">
              <p className="text-lg font-semibold leading-tight">{b.name}, {b.age}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[15px] text-muted">
                <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden /> {b.city}, {flag(b.country)} {countryName(b.country)}</span>
                <span>{need.occupation}</span>
                <span className="inline-flex items-center gap-1"><Users className="h-4 w-4" aria-hidden /> Family of {need.familySize}</span>
              </p>
            </div>
          </div>

          <section aria-labelledby="story" className="mt-10">
            <h2 id="story" className="text-2xl font-semibold">Their story</h2>
            <div className="prose-hb mt-4 whitespace-pre-line">{need.story}</div>
          </section>

          {/* Verification */}
          <section aria-labelledby="verified" className="mt-12 overflow-hidden rounded-3xl border border-accent-500/30 bg-accent-500/[0.06]">
            <div className="flex items-start gap-4 p-6">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-500 text-white"><BadgeCheck className="h-6 w-6" aria-hidden /></span>
              <div>
                <h2 id="verified" className="text-xl font-semibold">Verified by Luma Bridge auditors</h2>
                <p className="mt-1 text-[15px] text-muted">A person checked this application before it went public. Rejected applications never appear.</p>
              </div>
            </div>
            <dl className="grid gap-px border-t border-accent-500/20 bg-accent-500/20 sm:grid-cols-3">
              {[
                ['Verification ID', need.audit.verificationId ?? '—'],
                ['First verified', fmtDate(need.audit.verifiedAt)],
                ['Last audit', fmtDate(need.audit.lastAuditAt)],
              ].map(([k, v]) => (
                <div key={k} className="bg-surface px-6 py-4">
                  <dt className="text-sm text-muted">{k}</dt>
                  <dd className="mt-0.5 font-display text-lg font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            {need.audit.verifiedDocumentKinds.length > 0 && (
              <div className="border-t border-accent-500/20 bg-surface px-6 py-5">
                <p className="mb-2.5 text-sm font-medium">Documents checked</p>
                <ul className="flex flex-wrap gap-2">
                  {need.audit.verifiedDocumentKinds.map((k) => (
                    <li key={k} className="inline-flex items-center gap-1.5 rounded-full bg-accent-500/12 px-3 py-1 text-sm font-medium text-accent-700 dark:text-accent-400"><CalendarCheck className="h-3.5 w-3.5" aria-hidden /> {DOC_LABEL[k] ?? k}</li>
                  ))}
                </ul>
                <p className="mt-3 text-[13px] text-muted">The documents themselves stay private. Only auditors can open them.</p>
              </div>
            )}
          </section>

          {/* Timeline */}
          <section aria-labelledby="updates" className="mt-12">
            <h2 id="updates" className="text-2xl font-semibold">Updates</h2>
            {need.updates.length === 0 ? (
              <p className="mt-3 text-muted">No updates yet. {b.name} can post progress here once gifts arrive.</p>
            ) : (
              <ol className="mt-6 space-y-0">
                {need.updates.map((u, i) => (
                  <li key={u.id} className="relative flex gap-4 pb-8 last:pb-0">
                    {i < need.updates.length - 1 && <span aria-hidden className="absolute left-[7px] top-5 h-full w-px bg-line" />}
                    <span aria-hidden className="mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full border-[3px] border-brand bg-surface" />
                    <div>
                      <p className="text-sm text-muted">{fmtDate(u.createdAt)}</p>
                      <h3 className="mt-0.5 text-lg font-semibold">{u.title}</h3>
                      <p className="mt-1 whitespace-pre-line text-ink/85">{u.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Payment methods */}
          {need.paymentMethods.length > 0 && (
            <section aria-labelledby="pm" className="mt-12">
              <h2 id="pm" className="text-2xl font-semibold">How {b.name} receives funds</h2>
              <p className="mt-2 text-muted">Payment details were verified by auditors and are shown masked. You give through Luma Bridge, never by sending money to these directly.</p>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {need.paymentMethods.map((m) => (
                  <li key={m.id} className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
                    <span className="font-medium">{PAYMENT_LABEL[m.type] ?? m.label}</span>
                    <span className="font-mono text-sm text-muted">{m.maskedHint}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Comments slug={slug} need={need} />
        </article>

        {/* Sticky donate column */}
        <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Donate">
          <div className="card p-6 shadow-lift">
            <p className="font-display text-4xl font-semibold tabular-nums">{money(need.raisedUsd)}</p>
            <p className="mt-0.5 text-muted">raised of {money(need.goalUsd)} goal</p>
            <ProgressBar percent={need.percent} className="mt-4" label={`${need.percent}% of goal raised`} />
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-sunken px-2 py-3"><dd className="font-display text-xl font-semibold">{need.percent}%</dd><dt className="text-[12.5px] text-muted">funded</dt></div>
              <div className="rounded-2xl bg-sunken px-2 py-3"><dd className="font-display text-xl font-semibold">{need.donationCount}</dd><dt className="text-[12.5px] text-muted">gifts</dt></div>
              <div className="rounded-2xl bg-sunken px-2 py-3"><dd className="font-display text-xl font-semibold">{left === null ? '∞' : left}</dd><dt className="text-[12.5px] text-muted">{left === null ? 'no deadline' : 'days left'}</dt></div>
            </dl>
            <p className="mt-4 text-[15px]">
              <span className="font-semibold">{money(need.remainingUsd)}</span> <span className="text-muted">still needed</span>
            </p>
            <button type="button" onClick={donate} disabled={funded} className="btn-accent btn-lg mt-5 w-full">
              <HeartHandshake className="h-5 w-5" aria-hidden /> {funded ? 'Fully funded, thank you' : 'Donate'}
            </button>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button type="button" onClick={share} className="btn-ghost btn-sm"><Share2 className="h-4 w-4" aria-hidden /> Share</button>
              <ReportButton slug={slug} />
            </div>
            <p className="mt-5 flex items-start gap-2 text-[13px] text-muted">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Platform fee: {need.feePercent}%. {need.feePercent === 0 ? 'Every dollar reaches the campaign.' : 'Shown before you pay.'}
            </p>
          </div>

          <div className="mt-5 card p-6">
            <h2 className="text-lg font-semibold">Recent gifts</h2>
            {need.recentDonations.length === 0 ? (
              <p className="mt-2 text-[15px] text-muted">Be the first to give to {b.name}.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {need.recentDonations.slice(0, 8).map((d) => (
                  <li key={d.id} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="flex min-w-0 items-center gap-2 font-medium">
                        {d.anonymous ? <EyeOff className="h-4 w-4 shrink-0 text-muted" aria-hidden /> : <span aria-hidden>{d.donorCountry ? flag(d.donorCountry) : '💚'}</span>}
                        <span className="truncate">{d.donorName}</span>
                      </p>
                      <p className="shrink-0 font-semibold">{formatAmount(d.amount, d.currency)}</p>
                    </div>
                    <p className="text-[13px] text-muted">{timeAgo(d.createdAt)}{d.currency !== 'USD' && ` · ${money(d.amountUsd, { decimals: 2 })}`}</p>
                    {d.message && <p className="mt-1.5 rounded-xl bg-sunken px-3 py-2 text-[14px]">“{d.message}”</p>}
                  </li>
                ))}
              </ul>
            )}
            <Link href="/transparency" className="mt-3 inline-block text-[14px] font-medium text-brand underline underline-offset-4">How every gift is tracked</Link>
          </div>
        </aside>
      </div>

      {/* Mobile sticky donate bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line glass-light p-3 lg:hidden">
        <div className="container flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-semibold">{money(need.raisedUsd)} <span className="text-sm font-normal text-muted">of {money(need.goalUsd)}</span></p>
            <ProgressBar percent={need.percent} className="mt-1 h-1.5" />
          </div>
          <button type="button" onClick={donate} disabled={funded} className="btn-accent shrink-0">Donate</button>
        </div>
      </div>
    </div>
  );
}

function Comments({ slug, need }: { slug: string; need: NeedDetail }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const m = useMutation({
    mutationFn: () => api(`/api/needs/${encodeURIComponent(slug)}/comments`, { method: 'POST', json: { authorName: name.trim(), body: body.trim() }, auth: false }),
    onSuccess: () => {
      setBody('');
      toast.success('Comment posted');
      void qc.invalidateQueries({ queryKey: ['need', slug] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not post your comment.'),
  });
  return (
    <section aria-labelledby="comments" className="mt-12">
      <h2 id="comments" className="flex items-center gap-2 text-2xl font-semibold"><MessageCircle className="h-6 w-6 text-brand" aria-hidden /> Words of support</h2>
      <form
        className="mt-5 space-y-3 rounded-3xl border border-line bg-surface p-5"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <div>
          <label htmlFor="c-name" className="label">Your name</label>
          <input id="c-name" className="field" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
        <div>
          <label htmlFor="c-body" className="label">Message</label>
          <textarea id="c-body" className="field min-h-[90px]" required minLength={2} maxLength={600} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write something kind. Links are not allowed." />
        </div>
        <button type="submit" className="btn-primary" disabled={m.isPending}>{m.isPending ? <Spinner /> : 'Post comment'}</button>
      </form>
      {need.comments.length > 0 && (
        <ul className="mt-6 space-y-5">
          {need.comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar name={c.authorName} size={38} />
              <div>
                <p className="text-[15px]"><span className="font-semibold">{c.authorName}</span> <span className="text-muted">· {timeAgo(c.createdAt)}</span></p>
                <p className="mt-0.5 text-ink/90">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const REASONS = [
  ['SUSPECTED_FRAUD', 'I suspect this is a scam'],
  ['FALSE_INFORMATION', 'The information looks false'],
  ['DUPLICATE_PROFILE', 'This person has more than one profile'],
  ['INAPPROPRIATE', 'Inappropriate content'],
  ['OTHER', 'Something else'],
] as const;

function ReportButton({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>('SUSPECTED_FRAUD');
  const [details, setDetails] = useState('');
  const [email, setEmail] = useState('');
  const m = useMutation({
    mutationFn: () => api(`/api/needs/${encodeURIComponent(slug)}/report`, { method: 'POST', json: { reason, details: details.trim() || undefined, reporterEmail: email.trim() || undefined }, auth: false }),
    onSuccess: () => {
      toast.success('Report sent. Auditors will review it.');
      setOpen(false);
      setDetails('');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not send your report.'),
  });
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className="btn-ghost btn-sm"><Flag className="h-4 w-4" aria-hidden /> Report</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-night/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[61] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-line bg-surface p-6 shadow-lift outline-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-display text-2xl font-semibold">Report this campaign</Dialog.Title>
              <Dialog.Description className="mt-1 text-[15px] text-muted">Reports are read by auditors and count towards the fraud score. Your email is optional and never shown.</Dialog.Description>
            </div>
            <Dialog.Close className="btn-quiet -mr-2 -mt-1 h-10 w-10 shrink-0 !p-0" aria-label="Close"><X className="h-5 w-5" /></Dialog.Close>
          </div>
          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              m.mutate();
            }}
          >
            <div>
              <label htmlFor="r-reason" className="label">What's wrong?</label>
              <select id="r-reason" className="field" value={reason} onChange={(e) => setReason(e.target.value)}>
                {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="r-details" className="label">Details <span className="font-normal text-muted">(optional)</span></label>
              <textarea id="r-details" className="field" maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} />
            </div>
            <div>
              <label htmlFor="r-email" className="label">Your email <span className="font-normal text-muted">(optional)</span></label>
              <input id="r-email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={m.isPending}>{m.isPending ? <Spinner /> : 'Send report'}</button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
