'use client';

import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { PAYMENT_LABEL } from '@/lib/format';
import { errMsg, useDashboard, useRefreshDashboard } from '@/lib/me';
import { PageLoader } from '../LottieLoader';
import { EmptyState, Input, Select, Spinner } from '../ui';
import { DashHeading } from './DashShell';

/** Which fields each payout type needs. Everything is encrypted at rest; only a masked hint is ever shown. */
const FIELDS: Record<string, { key: string; label: string; placeholder?: string }[]> = {
  BANK_ACCOUNT: [{ key: 'bankName', label: 'Bank name' }, { key: 'accountName', label: 'Account holder name' }, { key: 'accountNumber', label: 'Account number / IBAN' }],
  MOBILE_MONEY: [{ key: 'provider', label: 'Provider', placeholder: 'e.g. MTN, Airtel' }, { key: 'phone', label: 'Mobile number', placeholder: '+256 …' }],
  MPESA: [{ key: 'phone', label: 'M-Pesa number', placeholder: '+254 712 345 678' }, { key: 'accountName', label: 'Registered name' }],
  PAYPAL: [{ key: 'email', label: 'PayPal email' }],
  WISE: [{ key: 'email', label: 'Wise email' }, { key: 'handle', label: 'Wise tag (optional)', placeholder: '@yourname' }],
  STRIPE: [{ key: 'email', label: 'Stripe account email' }],
  USDT: [{ key: 'network', label: 'Network', placeholder: 'TRC20, ERC20…' }, { key: 'address', label: 'Wallet address' }],
  BITCOIN: [{ key: 'address', label: 'Bitcoin address' }],
  ETHEREUM: [{ key: 'address', label: 'Ethereum address' }],
  OTHER_WALLET: [{ key: 'walletName', label: 'Wallet name' }, { key: 'address', label: 'Wallet address / ID' }],
};

export function Payments() {
  const { data, isLoading } = useDashboard();
  const refresh = useRefreshDashboard();
  const [type, setType] = useState('MPESA');
  const [label, setLabel] = useState('');
  const [vals, setVals] = useState<Record<string, string>>({});
  const [display, setDisplay] = useState(true);

  const fields = FIELDS[type]!;
  const complete = label.trim().length > 0 && fields.filter((f) => !f.label.includes('optional')).every((f) => (vals[f.key] ?? '').trim());

  const add = useMutation({
    mutationFn: () => {
      const details = Object.fromEntries(fields.map((f) => [f.key, (vals[f.key] ?? '').trim()]).filter(([, v]) => v));
      return api('/api/me/payment-methods', { method: 'POST', json: { type, label: label.trim(), details, display } });
    },
    onSuccess: async () => { toast.success('Payment method added'); setVals({}); setLabel(''); await refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; display: boolean }) => api(`/api/me/payment-methods/${v.id}`, { method: 'PATCH', json: { display: v.display } }),
    onSuccess: () => refresh(),
    onError: (e) => toast.error(errMsg(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/me/payment-methods/${id}`, { method: 'DELETE' }),
    onSuccess: async () => { toast.success('Removed'); await refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });

  if (isLoading || !data) return <PageLoader label="Loading payment methods" />;
  return (
    <>
      <DashHeading title="Payment methods" body="Choose how supporters can reach you. You decide which methods are shown on your public page." />
      <div className="card mb-6 flex items-start gap-3 bg-accent-500/5 p-5 text-[15px]">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" aria-hidden />
        <p>Account details are encrypted (AES-256-GCM). Donors only ever see the method name and the last few characters, for example “M-Pesa · ••••5678”.</p>
      </div>

      {data.paymentMethods.length === 0 ? (
        <EmptyState title="No payment methods yet" body="Add at least one so auditors can verify where funds will go." />
      ) : (
        <ul className="space-y-3">
          {data.paymentMethods.map((m) => (
            <li key={m.id} className="card flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{m.label} <span className="font-normal text-muted">· {PAYMENT_LABEL[m.type] ?? m.type}</span></p>
                <p className="font-mono text-sm text-muted">{m.maskedHint}</p>
              </div>
              <button className="btn-ghost btn-sm" onClick={() => toggle.mutate({ id: m.id, display: !m.display })} aria-pressed={m.display}>
                {m.display ? <><Eye className="h-3.5 w-3.5" aria-hidden /> Shown publicly</> : <><EyeOff className="h-3.5 w-3.5" aria-hidden /> Hidden</>}
              </button>
              <button className="btn-quiet h-10 w-10 !p-0 text-muted hover:text-danger" aria-label={`Remove ${m.label}`} onClick={() => { if (confirm('Remove this payment method?')) remove.mutate(m.id); }}>
                <Trash2 className="h-[18px] w-[18px]" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <section className="card mt-8 p-6" aria-label="Add a payment method">
        <h2 className="text-xl font-semibold">Add a method</h2>
        <form className="mt-5 space-y-5" onSubmit={(e) => { e.preventDefault(); if (complete) add.mutate(); }}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Select label="Type" value={type} onChange={(e) => { setType(e.target.value); setVals({}); }}>
              {Object.keys(FIELDS).map((t) => <option key={t} value={t}>{PAYMENT_LABEL[t]}</option>)}
            </Select>
            <Input label="Nickname" placeholder="e.g. My M-Pesa" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {fields.map((f) => (
              <Input key={f.key} label={f.label} placeholder={f.placeholder} maxLength={300} autoComplete="off" value={vals[f.key] ?? ''} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} />
            ))}
          </div>
          <label className="flex items-center gap-3 text-[15px]">
            <input type="checkbox" className="h-4 w-4 accent-brand" checked={display} onChange={(e) => setDisplay(e.target.checked)} /> Show this method on my public page
          </label>
          <button className="btn-primary" disabled={!complete || add.isPending}>{add.isPending ? <Spinner /> : <><Plus className="h-4 w-4" aria-hidden /> Add method</>}</button>
        </form>
      </section>
    </>
  );
}
