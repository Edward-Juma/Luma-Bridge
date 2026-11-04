'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useForm, type FieldPath } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { countryOptions } from '@/lib/countries';
import { cn } from '@/lib/utils';
import { Input, Select, Spinner, Textarea } from '../ui';

const phone = z.string().trim().regex(/^\+?[0-9\s\-()]{7,20}$/, 'Enter a valid phone number, e.g. +254 712 345 678');

const schema = z
  .object({
    email: z.string().trim().toLowerCase().email('Enter a valid email address'),
    password: z
      .string()
      .min(10, 'Use at least 10 characters')
      .refine((p) => /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p), 'Include upper and lower case letters and a number'),
    confirm: z.string(),
    fullName: z.string().trim().min(2, 'Enter your full legal name').max(120),
    nationalId: z.string().trim().min(4, 'Enter your ID or passport number').max(40),
    dateOfBirth: z
      .string()
      .min(1, 'Enter your date of birth')
      .refine((d) => (Date.now() - new Date(d).getTime()) / (365.25 * 86_400_000) >= 18, 'Applicants must be 18 or older. Guardians can apply on behalf of a minor.'),
    gender: z.enum(['FEMALE', 'MALE', 'OTHER', 'UNDISCLOSED']),
    phone,
    country: z.string().length(2, 'Choose your country'),
    city: z.string().trim().min(1, 'Enter your city or town').max(100),
    address: z.string().trim().max(300).optional(),
    occupation: z.string().trim().min(1, 'Tell us what you do, or "Unemployed"').max(120),
    incomeLevel: z.enum(['NONE', 'VERY_LOW', 'LOW', 'LOWER_MIDDLE', 'MIDDLE']),
    familySize: z.string().regex(/^\d+$/, 'Enter a number').refine((n) => Number(n) >= 1 && Number(n) <= 40, 'Between 1 and 40'),
    emergencyContactName: z.string().trim().min(2, 'Enter a name').max(120),
    emergencyContactPhone: phone,
    about: z.string().trim().min(30, 'Write at least a couple of sentences (30+ characters)').max(3000),
    consent: z.literal(true, { errorMap: () => ({ message: 'Please confirm to continue' }) }),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

type Values = z.infer<typeof schema>;

const STEPS: { title: string; fields: FieldPath<Values>[] }[] = [
  { title: 'Account', fields: ['email', 'password', 'confirm'] },
  { title: 'About you', fields: ['fullName', 'nationalId', 'dateOfBirth', 'gender', 'phone'] },
  { title: 'Your situation', fields: ['country', 'city', 'address', 'occupation', 'incomeLevel', 'familySize'] },
  { title: 'Your story', fields: ['emergencyContactName', 'emergencyContactPhone', 'about', 'consent'] },
];

function strength(p: string) {
  let s = 0;
  if (p.length >= 10) s++;
  if (p.length >= 14) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  return s;
}

export function RegisterForm() {
  const { register: signUp } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const countries = useMemo(() => countryOptions(), []);

  const f = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { gender: 'UNDISCLOSED', incomeLevel: 'LOW', familySize: '1', country: '', consent: false as unknown as true },
  });
  const { register, formState: { errors, isSubmitting }, watch } = f;
  const pw = watch('password') ?? '';
  const score = strength(pw);

  async function next() {
    const ok = await f.trigger(STEPS[step]!.fields);
    if (ok) setStep((s) => s + 1);
  }

  async function onSubmit(v: Values) {
    try {
      const { confirm: _c, consent: _k, familySize, ...rest } = v;
      await signUp({ ...rest, familySize: Number(familySize), address: rest.address || undefined });
      toast.success('Account created. Next, tell us about your need.');
      router.replace('/dashboard');
    } catch (e) {
      if (e instanceof ApiError) {
        // Map server-side validation messages back onto their fields and jump to the right step.
        const keys = Object.keys(e.details ?? {}) as FieldPath<Values>[];
        keys.forEach((k) => f.setError(k, { message: e.details![k] }));
        const target = STEPS.findIndex((s) => s.fields.some((x) => keys.includes(x)));
        if (target >= 0) setStep(target);
        if (!keys.length) toast.error(e.message);
        else toast.error('Please check the highlighted fields.');
        if (e.status === 409) {
          setStep(0);
          f.setError('email', { message: e.message });
        }
      } else toast.error('Something went wrong. Please try again.');
    }
  }

  return (
    <form
      onSubmit={f.handleSubmit(onSubmit, (errs) => {
        const bad = STEPS.findIndex((s) => s.fields.some((x) => errs[x as keyof typeof errs]));
        if (bad >= 0) setStep(bad);
      })}
      noValidate
      className="card p-6 md:p-8"
    >
      <ol className="mb-8 flex items-center gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex flex-1 items-center gap-2" aria-current={i === step ? 'step' : undefined}>
            <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition', i < step ? 'bg-accent-500 text-white' : i === step ? 'bg-brand text-white' : 'bg-sunken text-muted')}>
              {i < step ? <Check className="h-4 w-4" aria-label="completed" /> : i + 1}
            </span>
            <span className={cn('hidden text-sm font-medium sm:block', i === step ? 'text-ink' : 'text-muted')}>{s.title}</span>
            {i < STEPS.length - 1 && <span aria-hidden className={cn('h-px flex-1', i < step ? 'bg-accent-500' : 'bg-line')} />}
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }} className="space-y-5">
          {step === 0 && (
            <>
              <Input label="Email" type="email" autoComplete="email" required error={errors.email?.message} hint="We use this for sign-in and verification updates." {...register('email')} />
              <div>
                <Input label="Password" type="password" autoComplete="new-password" required error={errors.password?.message} {...register('password')} />
                <div className="mt-2 flex gap-1" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors', i < score ? (score >= 3 ? 'bg-accent-500' : score === 2 ? 'bg-warn' : 'bg-danger') : 'bg-sunken')} />
                  ))}
                </div>
                <p className="hint">At least 10 characters with upper and lower case letters and a number.</p>
              </div>
              <Input label="Confirm password" type="password" autoComplete="new-password" required error={errors.confirm?.message} {...register('confirm')} />
            </>
          )}

          {step === 1 && (
            <>
              <Input label="Full legal name" autoComplete="name" required error={errors.fullName?.message} hint="Exactly as it appears on your ID. Donors only see your first name and last initial." {...register('fullName')} />
              <Input label="National ID / passport number" autoComplete="off" required error={errors.nationalId?.message} hint="Encrypted on arrival. Only auditors can see it, and every view is logged." {...register('nationalId')} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Input label="Date of birth" type="date" autoComplete="bday" required max={new Date().toISOString().slice(0, 10)} error={errors.dateOfBirth?.message} {...register('dateOfBirth')} />
                <Select label="Gender" error={errors.gender?.message} {...register('gender')}>
                  <option value="FEMALE">Female</option>
                  <option value="MALE">Male</option>
                  <option value="OTHER">Other</option>
                  <option value="UNDISCLOSED">Prefer not to say</option>
                </Select>
              </div>
              <Input label="Phone number" type="tel" autoComplete="tel" required placeholder="+254 712 345 678" error={errors.phone?.message} hint="Auditors may call to confirm your details." {...register('phone')} />
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <Select label="Country" required autoComplete="country" error={errors.country?.message} {...register('country')}>
                  <option value="">Choose…</option>
                  {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </Select>
                <Input label="City / town" autoComplete="address-level2" required error={errors.city?.message} {...register('city')} />
              </div>
              <Input label="Address or neighbourhood" autoComplete="street-address" error={errors.address?.message} hint="Optional. Never shown publicly. Helps auditors confirm your location." {...register('address')} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Input label="Occupation" required error={errors.occupation?.message} {...register('occupation')} />
                <Input label="People in your household" type="number" min={1} max={40} inputMode="numeric" required error={errors.familySize?.message} {...register('familySize')} />
              </div>
              <Select label="Household income" required error={errors.incomeLevel?.message} hint="Used only to help auditors understand your situation." {...register('incomeLevel')}>
                <option value="NONE">No income</option>
                <option value="VERY_LOW">Very low</option>
                <option value="LOW">Low</option>
                <option value="LOWER_MIDDLE">Lower-middle</option>
                <option value="MIDDLE">Middle</option>
              </Select>
            </>
          )}

          {step === 3 && (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <Input label="Emergency contact name" required error={errors.emergencyContactName?.message} {...register('emergencyContactName')} />
                <Input label="Emergency contact phone" type="tel" required error={errors.emergencyContactPhone?.message} {...register('emergencyContactPhone')} />
              </div>
              <Textarea label="About you and your situation" required rows={5} error={errors.about?.message} hint="A short, honest summary. You will write the full story of your need in the next step." {...register('about')} />
              <div>
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-sunken p-4 text-[15px]">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-brand" aria-invalid={Boolean(errors.consent)} {...register('consent')} />
                  <span>
                    I confirm the information is true, I agree to the <Link href="/terms" className="font-semibold text-brand underline underline-offset-4" target="_blank">Terms</Link> and <Link href="/privacy" className="font-semibold text-brand underline underline-offset-4" target="_blank">Privacy Policy</Link>, and I understand auditors may contact people who can vouch for me.
                  </span>
                </label>
                {errors.consent && <p role="alert" className="error">{errors.consent.message}</p>}
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex items-center justify-between gap-3">
        {step > 0 ? (
          <button type="button" className="btn-ghost" onClick={() => setStep((s) => s - 1)}><ArrowLeft className="h-4 w-4" aria-hidden /> Back</button>
        ) : (
          <span className="text-[15px] text-muted">Already registered? <Link href="/login" className="font-semibold text-brand underline-offset-4 hover:underline">Sign in</Link></span>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn-primary" onClick={next}>Continue <ArrowRight className="h-4 w-4" aria-hidden /></button>
        ) : (
          <button type="submit" className="btn-primary" disabled={isSubmitting}>{isSubmitting ? <Spinner /> : 'Create my account'}</button>
        )}
      </div>
    </form>
  );
}
