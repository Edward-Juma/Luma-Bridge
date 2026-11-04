'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Check, CircleDashed, ExternalLink, Send } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { api } from '@/lib/api';
import { CATEGORIES, CATEGORY_LABEL, PRIORITY_LABEL, money } from '@/lib/format';
import { errMsg, useDashboard, useRefreshDashboard } from '@/lib/me';
import type { DashboardData, MyNeed } from '@/lib/me-types';
import type { Category, Priority } from '@/lib/types';
import { PageLoader } from '../LottieLoader';
import { Input, ProgressBar, Select, Spinner, Textarea } from '../ui';
import { DashHeading } from './DashShell';
import { StatusPill } from './Overview';
import { Upload } from './Upload';

const schema = z.object({
  title: z.string().trim().min(8, 'Give it a clear title (8+ characters)').max(120),
  summary: z.string().trim().min(20, 'A one or two sentence summary (20+ characters)').max(240, 'Keep the summary under 240 characters'),
  story: z.string().trim().min(200, 'Tell your story in at least 200 characters so donors understand').max(8000),
  category: z.enum(CATEGORIES as [Category, ...Category[]]),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  goalUsd: z.string().refine((v) => Number(v) >= 10 && Number(v) <= 250_000, 'Enter an amount between $10 and $250,000'),
  deadline: z.string().optional().refine((v) => !v || new Date(v).getTime() > Date.now(), 'Choose a date in the future'),
});
type Values = z.infer<typeof schema>;

function NeedFields({ form }: { form: ReturnType<typeof useForm<Values>> }) {
  const { register, formState: { errors }, watch } = form;
  const story = watch('story') ?? '';
  return (
    <div className="space-y-5">
      <Input label="Title" required placeholder="e.g. School fees for my daughter's final year" error={errors.title?.message} {...register('title')} />
      <Textarea label="Short summary" required rows={2} hint="Shown on the campaign card. Keep it to one or two sentences." error={errors.summary?.message} {...register('summary')} />
      <Textarea label="Your story" required rows={9} hint={`${story.length}/8000. Be specific and honest: what happened, what you need, and what the money will be used for.`} error={errors.story?.message} {...register('story')} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Select label="Category" required error={errors.category?.message} {...register('category')}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </Select>
        <Select label="Priority" required hint="Be honest. Auditors confirm urgency." error={errors.priority?.message} {...register('priority')}>
          {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
        </Select>
        <Input label="Amount needed (USD)" required type="number" inputMode="decimal" min={10} step="1" error={errors.goalUsd?.message} {...register('goalUsd')} />
        <Input label="Deadline" type="date" hint="Optional. When do you need the funds by?" error={errors.deadline?.message} {...register('deadline')} />
      </div>
    </div>
  );
}

const toBody = (v: Values) => ({
  title: v.title, summary: v.summary, story: v.story, category: v.category, priority: v.priority,
  goalUsd: Number(v.goalUsd), ...(v.deadline ? { deadline: new Date(v.deadline).toISOString() } : {}),
});

export function NewNeed() {
  const router = useRouter();
  const refresh = useRefreshDashboard();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { title: '', summary: '', story: '', category: 'EDUCATION', priority: 'MEDIUM', goalUsd: '', deadline: '' } });
  const create = useMutation({
    mutationFn: (v: Values) => api<{ id: string }>('/api/me/needs', { method: 'POST', json: toBody(v) }),
    onSuccess: async (r) => {
      await refresh();
      toast.success('Draft saved. Add photos, then submit it for review.');
      router.push(`/dashboard/campaigns/${r.id}`);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <>
      <Link href="/dashboard/campaigns" className="mb-4 inline-flex items-center gap-1.5 text-[15px] font-medium text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" aria-hidden /> All campaigns</Link>
      <DashHeading title="Write your request" body="Save it as a draft first. Nothing is shared until you submit it and an auditor approves it." />
      <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="card space-y-6 p-6 md:p-8" noValidate>
        <NeedFields form={form} />
        <button className="btn-primary" disabled={create.isPending}>{create.isPending ? <Spinner /> : 'Save draft'}</button>
      </form>
    </>
  );
}

const EDITABLE = ['DRAFT', 'NEEDS_INFO', 'REJECTED'];

function Readiness({ data }: { data: DashboardData }) {
  const kinds = data.documents.map((d) => d.kind);
  const items = [
    { ok: Boolean(data.profile.photoUrl), label: 'Profile photo', href: '/dashboard/profile' },
    { ok: kinds.some((k) => k === 'IDENTITY' || k === 'GOVERNMENT_DOCUMENT'), label: 'Identity document', href: '/dashboard/documents' },
    { ok: data.documents.length >= 2, label: 'At least one supporting document', href: '/dashboard/documents' },
    { ok: data.paymentMethods.length > 0, label: 'At least one payment method', href: '/dashboard/payments' },
  ];
  return { items, ready: items.every((i) => i.ok) };
}

export function ManageNeed({ id }: { id: string }) {
  const { data, isLoading } = useDashboard();
  const need = data?.needs.find((n) => n.id === id);
  if (isLoading) return <PageLoader label="Loading request" />;
  if (!data || !need) {
    return (
      <div className="card p-8 text-center">
        <p className="font-display text-xl font-semibold">We could not find that request</p>
        <Link href="/dashboard/campaigns" className="btn-primary mt-5">Back to campaigns</Link>
      </div>
    );
  }
  return <NeedView need={need} data={data} />;
}

function NeedView({ need, data }: { need: MyNeed; data: DashboardData }) {
  const refresh = useRefreshDashboard();
  const router = useRouter();
  const editable = EDITABLE.includes(need.status);
  const live = need.status === 'ACTIVE' || need.status === 'FUNDED';
  const { items, ready } = Readiness({ data });

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { title: need.title, summary: need.summary, story: need.story, category: need.category, priority: need.priority, goalUsd: String(need.goalUsd), deadline: need.deadline ? need.deadline.slice(0, 10) : '' },
  });
  useEffect(() => {
    form.reset({ title: need.title, summary: need.summary, story: need.story, category: need.category, priority: need.priority, goalUsd: String(need.goalUsd), deadline: need.deadline ? need.deadline.slice(0, 10) : '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [need.id, need.status]);

  const save = useMutation({
    mutationFn: (v: Values) => api(`/api/me/needs/${need.id}`, { method: 'PATCH', json: toBody(v) }),
    onSuccess: async () => { await refresh(); toast.success('Saved'); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const submit = useMutation({
    mutationFn: async () => {
      // Persist any unsaved edits first so auditors review exactly what the applicant sees.
      const ok = await form.trigger();
      if (!ok) throw new Error('Please fix the highlighted fields first.');
      await api(`/api/me/needs/${need.id}`, { method: 'PATCH', json: toBody(form.getValues()) });
      return api(`/api/me/needs/${need.id}/submit`, { method: 'POST' });
    },
    onSuccess: async () => { await refresh(); toast.success('Submitted. Auditors will review it shortly.'); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const close = useMutation({
    mutationFn: () => api(`/api/me/needs/${need.id}/close`, { method: 'POST' }),
    onSuccess: async () => { await refresh(); toast.success('Campaign closed'); router.push('/dashboard/campaigns'); },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <>
      <Link href="/dashboard/campaigns" className="mb-4 inline-flex items-center gap-1.5 text-[15px] font-medium text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" aria-hidden /> All campaigns</Link>
      <DashHeading
        title={need.title}
        action={<div className="flex items-center gap-3"><StatusPill status={need.status} />{live && <Link href={`/needs/${need.slug}`} className="btn-ghost btn-sm">View public page <ExternalLink className="h-3.5 w-3.5" aria-hidden /></Link>}</div>}
      />

      {data.feedback && (need.status === 'NEEDS_INFO' || need.status === 'REJECTED') && (
        <div role="status" className="mb-6 rounded-3xl border border-warn/40 bg-warn/10 p-5">
          <p className="font-semibold">{data.feedback.decision === 'REJECT' ? 'Auditor note' : 'What auditors need from you'}</p>
          <p className="mt-1 text-[15px]">{data.feedback.notes}</p>
        </div>
      )}

      {live && (
        <section className="card mb-6 p-6" aria-label="Funding progress">
          <ProgressBar percent={need.goalUsd ? (need.raisedUsd / need.goalUsd) * 100 : 0} />
          <p className="mt-3 text-[15px] text-muted"><b className="text-ink">{money(need.raisedUsd)}</b> of {money(need.goalUsd)} · {need.donationCount} gifts · {money(Math.max(0, need.goalUsd - need.raisedUsd))} to go</p>
        </section>
      )}

      {need.status === 'PENDING' && (
        <div className="card mb-6 flex items-start gap-3 bg-brand/5 p-5">
          <Spinner className="mt-1 text-brand" />
          <p className="text-[15px]">Your request is with our auditors. It is locked while they review it, and we will notify you the moment there is news. Reviews usually take a few days.</p>
        </div>
      )}

      {editable ? (
        <>
          <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="card space-y-6 p-6 md:p-8" noValidate>
            <NeedFields form={form} />
            <button className="btn-ghost" disabled={save.isPending}>{save.isPending ? <Spinner /> : 'Save changes'}</button>
          </form>

          <section className="card mt-6 p-6 md:p-8" aria-label="Photos">
            <h2 className="text-xl font-semibold">Photos</h2>
            <p className="mt-1 text-[15px] text-muted">Show your situation honestly. Faces of children are never required. Up to 8 images.</p>
            {need.images.length > 0 && (
              <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {need.images.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <li key={src}><img src={src} alt="" className="aspect-square w-full rounded-2xl object-cover" /></li>
                ))}
              </ul>
            )}
            <div className="mt-4">
              <Upload<{ url: string }> path={`/api/me/needs/${need.id}/images`} accept="image/jpeg,image/png,image/webp" label="Add a photo" hint="JPG, PNG or WebP · up to 8 MB" disabled={need.images.length >= 8} onDone={() => { toast.success('Photo added'); void refresh(); }} compact />
            </div>
          </section>

          <section className="card mt-6 p-6 md:p-8" aria-label="Submit for review">
            <h2 className="text-xl font-semibold">Ready to submit?</h2>
            <ul className="mt-4 space-y-2.5">
              {items.map((i) => (
                <li key={i.label} className="flex items-center gap-3 text-[15px]">
                  {i.ok ? <Check className="h-5 w-5 rounded-full bg-accent-500 p-1 text-white" aria-label="Done" /> : <CircleDashed className="h-5 w-5 text-muted" aria-label="To do" />}
                  <span className={i.ok ? 'text-ink' : 'text-muted'}>{i.label}</span>
                  {!i.ok && <Link href={i.href} className="font-semibold text-brand underline-offset-4 hover:underline">Add</Link>}
                </li>
              ))}
            </ul>
            <button type="button" className="btn-primary mt-6" disabled={!ready || submit.isPending} onClick={() => submit.mutate()}>
              {submit.isPending ? <Spinner /> : <><Send className="h-4 w-4" aria-hidden /> Submit for verification</>}
            </button>
            {!ready && <p className="hint">Complete the checklist above to enable submission.</p>}
          </section>
        </>
      ) : (
        !live && (
          <section className="card space-y-3 p-6">
            <p className="text-[15px] text-muted">{need.summary}</p>
            <p className="whitespace-pre-line text-[15px]">{need.story}</p>
          </section>
        )
      )}

      {live && <PostUpdate needId={need.id} />}
      {live && (
        <section className="mt-6 rounded-3xl border border-line p-6">
          <h2 className="text-lg font-semibold">Close this campaign</h2>
          <p className="mt-1 text-[15px] text-muted">Close it once your need is met, or if circumstances changed. Donors will no longer see it as active.</p>
          <button type="button" className="btn-ghost mt-4" disabled={close.isPending} onClick={() => { if (confirm('Close this campaign? This cannot be undone.')) close.mutate(); }}>{close.isPending ? <Spinner /> : 'Close campaign'}</button>
        </section>
      )}
    </>
  );
}

function PostUpdate({ needId }: { needId: string }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const refresh = useRefreshDashboard();
  const post = useMutation({
    mutationFn: () => api(`/api/me/needs/${needId}/updates`, { method: 'POST', json: { title, body } }),
    onSuccess: async () => { toast.success('Update posted to your timeline'); setTitle(''); setBody(''); await refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const valid = title.trim().length >= 3 && body.trim().length >= 10;
  return (
    <section className="card mt-6 p-6 md:p-8" aria-label="Post an update">
      <h2 className="text-xl font-semibold">Post an update</h2>
      <p className="mt-1 text-[15px] text-muted">Tell supporters how things are going. Updates appear on your public timeline.</p>
      <form className="mt-5 space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid) post.mutate(); }}>
        <Input label="Headline" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        <Textarea label="What happened?" value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} />
        <button className="btn-primary" disabled={!valid || post.isPending}>{post.isPending ? <Spinner /> : 'Post update'}</button>
      </form>
    </section>
  );
}
