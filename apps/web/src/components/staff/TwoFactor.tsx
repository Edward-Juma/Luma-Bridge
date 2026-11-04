'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ApiError, api, type SessionResponse } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useRequireRole } from '@/lib/guard';
import { PageLoader } from '../LottieLoader';
import { Input, Spinner } from '../ui';

const schema = z.object({ code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code') });

interface Setup { secret: string; otpauth: string; qr: string }

/** Staff must hold a TOTP-verified session. New staff enrol here; returning staff re-authenticate at /login. */
export function TwoFactor() {
  const { ready, user } = useRequireRole(['AUDITOR', 'ADMIN']);
  const { applySession, logout } = useAuth();
  const router = useRouter();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [starting, setStarting] = useState(false);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { code: '' } });

  if (!ready || !user) return <PageLoader label="Checking your session" />;
  if (!user.needsMfaSetup && user.mfaVerified) {
    router.replace('/staff');
    return <PageLoader label="Opening console" />;
  }

  async function start() {
    setStarting(true);
    try {
      setSetup(await api<Setup>('/api/auth/2fa/setup', { method: 'POST' }));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not start setup.');
    } finally {
      setStarting(false);
    }
  }

  async function enable(v: z.infer<typeof schema>) {
    try {
      const s = await api<SessionResponse>('/api/auth/2fa/enable', { method: 'POST', json: { code: v.code } });
      applySession(s);
      toast.success('Two-step verification is on');
      router.replace('/staff');
    } catch (e) {
      form.setError('code', { message: e instanceof ApiError ? e.message : 'That code did not work.' });
    }
  }

  return (
    <div className="container flex justify-center pb-20 pt-8">
      <div className="card w-full max-w-lg p-6 md:p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand"><ShieldCheck className="h-6 w-6" aria-hidden /></span>
        <h1 className="mt-4 text-3xl font-semibold">Two-step verification</h1>

        {user.needsMfaSetup ? (
          <>
            <p className="mt-2 text-muted">Auditors can open private documents, so a second factor is required. Scan the code with an authenticator app such as Google Authenticator, 1Password or Authy.</p>
            {!setup ? (
              <button className="btn-primary mt-6" onClick={() => void start()} disabled={starting}>{starting ? <Spinner /> : 'Set up authenticator'}</button>
            ) : (
              <div className="mt-6 space-y-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={setup.qr} alt="QR code to add Luma Bridge to your authenticator app" width={220} height={220} className="mx-auto rounded-2xl border border-line bg-white p-2" />
                <p className="text-center text-[13px] text-muted">Can’t scan? Enter this key manually:<br /><code className="select-all break-all font-mono text-[13px] text-ink">{setup.secret}</code></p>
                <form onSubmit={form.handleSubmit(enable)} className="space-y-4" noValidate>
                  <Input label="Code from your app" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" className="text-center font-mono text-2xl tracking-[0.4em]" error={form.formState.errors.code?.message} {...form.register('code')} />
                  <button className="btn-primary w-full" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? <Spinner /> : 'Turn on and continue'}</button>
                </form>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="mt-2 text-muted">This session has not completed the two-step check. Sign in again and enter the code from your authenticator app.</p>
            <button className="btn-primary mt-6" onClick={async () => { await logout(); router.replace('/login?next=/staff'); }}>Sign in again</button>
          </>
        )}
      </div>
    </div>
  );
}
