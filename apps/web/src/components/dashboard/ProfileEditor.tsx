'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { api } from '@/lib/api';
import { countryName, flag } from '@/lib/countries';
import { errMsg, useDashboard, useRefreshDashboard } from '@/lib/me';
import { PageLoader } from '../LottieLoader';
import { Avatar, Input, Select, Spinner, Textarea } from '../ui';
import { DashHeading } from './DashShell';
import { Upload } from './Upload';

const phone = z.string().trim().regex(/^\+?[0-9\s\-()]{7,20}$/, 'Enter a valid phone number');
const schema = z.object({
  city: z.string().trim().min(1, 'Required').max(100),
  address: z.string().trim().max(300),
  occupation: z.string().trim().min(1, 'Required').max(120),
  incomeLevel: z.enum(['NONE', 'VERY_LOW', 'LOW', 'LOWER_MIDDLE', 'MIDDLE']),
  familySize: z.string().regex(/^\d+$/, 'Enter a number').refine((n) => Number(n) >= 1 && Number(n) <= 40, 'Between 1 and 40'),
  emergencyContactName: z.string().trim().min(2, 'Required').max(120),
  emergencyContactPhone: phone,
  about: z.string().trim().min(30, 'Write at least 30 characters').max(3000),
});
type Values = z.infer<typeof schema>;

export function ProfileEditor() {
  const { data, isLoading } = useDashboard();
  const refresh = useRefreshDashboard();
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  const p = data?.profile;

  useEffect(() => {
    if (!p) return;
    form.reset({ city: p.city, address: p.address ?? '', occupation: p.occupation, incomeLevel: p.incomeLevel, familySize: String(p.familySize), emergencyContactName: p.emergencyContactName, emergencyContactPhone: p.emergencyContactPhone, about: p.about });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id]);

  const save = useMutation({
    mutationFn: (v: Values) => api('/api/me/profile', { method: 'PATCH', json: { ...v, familySize: Number(v.familySize) } }),
    onSuccess: async () => { toast.success('Profile updated'); await refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (isLoading || !p) return <PageLoader label="Loading profile" />;
  const locked = p.verificationStatus === 'PENDING';
  const { register, formState: { errors, isDirty } } = form;

  return (
    <>
      <DashHeading title="Your profile" body="Donors see your first name, last initial, age, country and city. Everything else stays private." />

      <section className="card mb-6 flex flex-wrap items-center gap-6 p-6" aria-label="Profile photo">
        <Avatar src={p.photoUrl} name={p.fullName} size={88} />
        <div className="min-w-[220px] flex-1">
          <Upload<{ url: string }> path="/api/me/photo" accept="image/jpeg,image/png,image/webp" label={p.photoUrl ? 'Replace photo' : 'Add a profile photo'} hint="A clear, recent photo of you · up to 8 MB" onDone={() => { toast.success('Photo updated'); void refresh(); }} compact />
        </div>
      </section>

      <section className="card mb-6 p-6" aria-label="Identity">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Lock className="h-4 w-4 text-muted" aria-hidden /> Locked identity details</h2>
        <p className="mt-1 text-[15px] text-muted">These were checked during verification and cannot be edited. Contact support if something is wrong.</p>
        <dl className="mt-4 grid gap-4 text-[15px] sm:grid-cols-2">
          <div><dt className="text-[13px] text-muted">Full name</dt><dd className="font-semibold">{p.fullName}</dd></div>
          <div><dt className="text-[13px] text-muted">National ID / passport</dt><dd className="font-mono font-semibold">{p.nationalIdMasked}</dd></div>
          <div><dt className="text-[13px] text-muted">Phone</dt><dd className="font-semibold">{p.phone}</dd></div>
          <div><dt className="text-[13px] text-muted">Country</dt><dd className="font-semibold">{flag(p.country)} {countryName(p.country)}</dd></div>
        </dl>
      </section>

      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="card space-y-5 p-6 md:p-8" noValidate>
        {locked && <p className="rounded-2xl bg-brand/5 p-4 text-[15px]">Your application is under review, so editing is paused. You can edit again if auditors ask for changes.</p>}
        <fieldset disabled={locked} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Input label="City / town" error={errors.city?.message} {...register('city')} />
            <Input label="Occupation" error={errors.occupation?.message} {...register('occupation')} />
          </div>
          <Input label="Address or neighbourhood" hint="Never shown publicly." error={errors.address?.message} {...register('address')} />
          <div className="grid gap-5 sm:grid-cols-2">
            <Input label="People in your household" type="number" min={1} max={40} error={errors.familySize?.message} {...register('familySize')} />
            <Select label="Household income" error={errors.incomeLevel?.message} {...register('incomeLevel')}>
              <option value="NONE">No income</option>
              <option value="VERY_LOW">Very low</option>
              <option value="LOW">Low</option>
              <option value="LOWER_MIDDLE">Lower-middle</option>
              <option value="MIDDLE">Middle</option>
            </Select>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input label="Emergency contact name" error={errors.emergencyContactName?.message} {...register('emergencyContactName')} />
            <Input label="Emergency contact phone" type="tel" error={errors.emergencyContactPhone?.message} {...register('emergencyContactPhone')} />
          </div>
          <Textarea label="About you" rows={5} error={errors.about?.message} {...register('about')} />
        </fieldset>
        <button className="btn-primary" disabled={locked || !isDirty || save.isPending}>{save.isPending ? <Spinner /> : 'Save changes'}</button>
      </form>
    </>
  );
}
