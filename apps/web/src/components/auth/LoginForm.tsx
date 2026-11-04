'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, KeyRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ApiError } from '@/lib/api';
import { homeFor, useAuth } from '@/lib/auth';
import { safeNext } from '@/lib/guard';
import { Input, Spinner } from '../ui';

const credSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});
const codeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code') });

export function LoginForm() {
  const { user, loading, login, verifyMfa } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const [challenge, setChallenge] = useState<string | null>(null);

  // Already signed in (e.g. opened /login in a second tab): go straight to the right home.
  useEffect(() => {
    if (!loading && user && !challenge) router.replace(next ?? homeFor(user));
  }, [loading, user, challenge, next, router]);

  const cred = useForm<z.infer<typeof credSchema>>({ resolver: zodResolver(credSchema), defaultValues: { email: '', password: '' } });
  const code = useForm<z.infer<typeof codeSchema>>({ resolver: zodResolver(codeSchema), defaultValues: { code: '' } });

  async function onCreds(v: z.infer<typeof credSchema>) {
    try {
      const r = await login(v.email, v.password);
      if (r.mfaChallenge) return setChallenge(r.mfaChallenge);
      router.replace(next ?? homeFor(r.user!));
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'We could not sign you in. Please try again.';
      cred.setError('password', { message: msg });
    }
  }

  async function onCode(v: z.infer<typeof codeSchema>) {
    try {
      const u = await verifyMfa(challenge!, v.code);
      toast.success('Signed in securely');
      router.replace(next && next.startsWith('/staff') ? next : homeFor(u));
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'That code did not work.';
      if (e instanceof ApiError && e.status === 401 && /expired/i.test(msg)) {
        setChallenge(null);
        toast.error(msg);
      } else code.setError('code', { message: msg });
    }
  }

  if (challenge) {
    return (
      <form onSubmit={code.handleSubmit(onCode)} className="card space-y-5 p-6 md:p-8" noValidate>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/10 text-brand"><KeyRound className="h-5 w-5" aria-hidden /></span>
          <div>
            <h2 className="text-xl font-semibold">Two-step verification</h2>
            <p className="text-[15px] text-muted">Enter the 6-digit code from your authenticator app.</p>
          </div>
        </div>
        <Input label="Authenticator code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" autoFocus className="text-center font-mono text-2xl tracking-[0.4em]" error={code.formState.errors.code?.message} {...code.register('code')} />
        <button className="btn-primary w-full" disabled={code.formState.isSubmitting}>{code.formState.isSubmitting ? <Spinner /> : 'Verify and continue'}</button>
        <button type="button" className="btn-quiet w-full" onClick={() => setChallenge(null)}><ArrowLeft className="h-4 w-4" aria-hidden /> Back</button>
      </form>
    );
  }

  return (
    <form onSubmit={cred.handleSubmit(onCreds)} className="card space-y-5 p-6 md:p-8" noValidate>
      <Input label="Email" type="email" autoComplete="email" placeholder="you@example.com" error={cred.formState.errors.email?.message} {...cred.register('email')} />
      <Input label="Password" type="password" autoComplete="current-password" error={cred.formState.errors.password?.message} {...cred.register('password')} />
      <button className="btn-primary w-full" disabled={cred.formState.isSubmitting}>{cred.formState.isSubmitting ? <Spinner /> : 'Sign in'}</button>
      <p className="text-center text-[15px] text-muted">
        Need help from the community? <Link href="/register" className="font-semibold text-brand underline-offset-4 hover:underline">Create an account</Link>
      </p>
      <p className="text-center text-[13px] text-muted">Donors never need an account. <Link href="/needs" className="underline underline-offset-4">Browse campaigns</Link></p>
    </form>
  );
}
