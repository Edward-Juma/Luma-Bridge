'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Check, Copy, EyeOff, Lock, ShieldCheck, UserRound, X } from 'lucide-react';
import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, api } from '@/lib/api';
import { countryOptions } from '@/lib/countries';
import { CURRENCIES, GATEWAY_LABEL, formatAmount, money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Spinner } from './ui';

export interface DonateTarget {
  id: string;
  slug: string;
  title: string;
  name: string;
}

const Ctx = createContext<{ open: (t: DonateTarget) => void } | null>(null);
export const useDonate = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDonate must be used inside <DonateProvider>');
  return v;
};

const PRESETS_USD = [10, 20, 50, 100, 500];

interface Rates { usdPerUnit: Record<string, number>; stale?: boolean }
interface Options { gateways: { id: string; label: string; native: boolean }[]; feePercent: number }
interface Quote { amountUsd: number; rate: number; feeUsd: number; netUsd: number; stale: boolean; feePercent: number }
interface Checkout {
  receiptToken: string;
  status: 'SUCCEEDED' | 'PENDING';
  checkoutUrl?: string;
  instructions?: string;
  payAddress?: string;
  payAmount?: string;
  payCurrency?: string;
  charged: { amount: number; currency: string };
  amountUsd: number;
  feeUsd: number;
}

/** Turn a USD preset into a tidy number of the chosen currency, e.g. $10 → KSh 1,290. */
function fromUsd(usd: number, cur: string, rates?: Record<string, number>): number {
  if (cur === 'USD' || cur === 'USDT') return usd;
  const r = rates?.[cur];
  if (!r) return usd;
  const raw = usd / r;
  if (cur === 'BTC' || cur === 'ETH') return Number(raw.toPrecision(2));
  if (['JPY', 'KES', 'NGN', 'INR'].includes(cur)) return Math.max(10, Math.round(raw / 10) * 10);
  return Math.max(1, Math.round(raw));
}

function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

async function celebrate() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const confetti = (await import('canvas-confetti')).default;
  const colors = ['#2563EB', '#10B981', '#93B9FD', '#A7F3D0', '#F59E0B'];
  const burst = (x: number, angle: number) => confetti({ particleCount: 70, spread: 70, startVelocity: 48, angle, origin: { x, y: 0.8 }, colors, ticks: 220, zIndex: 100 });
  burst(0.1, 60);
  burst(0.9, 120);
  setTimeout(() => confetti({ particleCount: 90, spread: 110, origin: { x: 0.5, y: 0.55 }, colors, zIndex: 100 }), 220);
}

export function DonateProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<DonateTarget | null>(null);
  const [open, setOpen] = useState(false);
  const openFn = useCallback((t: DonateTarget) => {
    setTarget(t);
    setOpen(true);
  }, []);
  const value = useMemo(() => ({ open: openFn }), [openFn]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <DonateDialog target={target} open={open} onOpenChange={setOpen} />
    </Ctx.Provider>
  );
}

function DonateDialog({ target, open, onOpenChange }: { target: DonateTarget | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && target && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-[60] bg-night/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby="donate-desc">
              <motion.div
                className="fixed inset-x-0 bottom-0 z-[61] mx-auto flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-4xl border border-line bg-surface shadow-lift outline-none md:inset-y-6 md:bottom-auto md:rounded-4xl"
                initial={{ opacity: 0, y: 40, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30 }}
                transition={{ type: 'spring', damping: 30, stiffness: 340 }}
              >
                <DonateFlow target={target} close={() => onOpenChange(false)} />
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function DonateFlow({ target, close }: { target: DonateTarget; close: () => void }) {
  const qc = useQueryClient();
  const [currency, setCurrency] = useState<string>('USD');
  const [amount, setAmount] = useState('50');
  const [anonymous, setAnonymous] = useState(true);
  const [donorName, setDonorName] = useState('');
  const [donorCountry, setDonorCountry] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gateway, setGateway] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; details?: Record<string, string> } | null>(null);
  const [result, setResult] = useState<Checkout | null>(null);
  const [done, setDone] = useState<{ amountUsd: number; amount: number; currency: string; token: string } | null>(null);
  const copied = useRef(false);

  const rates = useQuery({ queryKey: ['rates'], queryFn: () => api<Rates>('/api/donations/rates', { auth: false }), staleTime: 5 * 60_000 });
  const options = useQuery({ queryKey: ['donation-options', currency], queryFn: () => api<Options>(`/api/donations/options?currency=${currency}`, { auth: false }), staleTime: 60_000 });
  const num = Number(amount);
  const debounced = useDebounced(amount);
  const quote = useQuery({
    queryKey: ['quote', debounced, currency],
    queryFn: () => api<Quote>(`/api/donations/quote?amount=${encodeURIComponent(debounced)}&currency=${currency}`, { auth: false }),
    enabled: Number(debounced) > 0,
    staleTime: 30_000,
    placeholderData: (p) => p,
  });

  const gateways = options.data?.gateways ?? [];
  useEffect(() => {
    if (gateways.length && !gateways.some((g) => g.id === gateway)) setGateway(gateways[0]!.id);
  }, [gateways, gateway]);
  const selected = gateways.find((g) => g.id === gateway);

  const countries = useMemo(() => countryOptions(), []);

  const finish = useCallback(
    (d: { amountUsd: number; amount: number; currency: string; token: string }) => {
      setDone(d);
      void celebrate();
      void qc.invalidateQueries({ queryKey: ['need', target.slug] });
      void qc.invalidateQueries({ queryKey: ['needs'] });
      void qc.invalidateQueries({ queryKey: ['stats'] });
      void qc.invalidateQueries({ queryKey: ['ticker'] });
    },
    [qc, target.slug],
  );

  // Push / transfer style methods: wait for the payment to land.
  useEffect(() => {
    if (!result || result.status !== 'PENDING' || result.checkoutUrl) return;
    const t = setInterval(async () => {
      try {
        const r = await api<{ status: string; amount: number; currency: string; amountUsd: number }>(`/api/donations/receipt/${result.receiptToken}`, { auth: false });
        if (r.status === 'SUCCEEDED') {
          clearInterval(t);
          finish({ amountUsd: r.amountUsd, amount: r.amount, currency: r.currency, token: result.receiptToken });
        } else if (r.status === 'FAILED') {
          clearInterval(t);
          setResult(null);
          setError({ message: 'That payment did not go through. Nothing was charged. Try again or pick another method.' });
        }
      } catch {
        /* keep polling */
      }
    }, 4000);
    return () => clearInterval(t);
  }, [result, finish]);

  const presets = useMemo(() => PRESETS_USD.map((usd) => ({ usd, local: fromUsd(usd, currency, rates.data?.usdPerUnit) })), [currency, rates.data]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!(num > 0)) return setError({ message: 'Enter an amount to give.' });
    if (!anonymous && !donorName.trim()) return setError({ message: 'Add your name, or choose to give anonymously.', details: { donorName: 'Required' } });
    if (gateway === 'MPESA' && !phone.trim()) return setError({ message: 'Enter the M-Pesa number that should receive the payment prompt.', details: { donorPhone: 'Required' } });
    setBusy(true);
    try {
      const body: Record<string, unknown> = { needId: target.id, amount: num, currency, gateway, anonymous };
      if (!anonymous) {
        body.donorName = donorName.trim();
        if (donorCountry) body.donorCountry = donorCountry;
        if (message.trim()) body.message = message.trim();
      }
      if (email.trim()) body.donorEmail = email.trim();
      if (phone.trim()) body.donorPhone = phone.trim();
      const out = await api<Checkout>('/api/donations', { method: 'POST', json: body, auth: false });
      if (out.status === 'SUCCEEDED') {
        finish({ amountUsd: out.amountUsd, amount: num, currency, token: out.receiptToken });
      } else if (out.checkoutUrl) {
        setResult(out);
        window.location.assign(out.checkoutUrl);
      } else {
        setResult(out);
      }
    } catch (err) {
      setError(err instanceof ApiError ? { message: err.message, details: err.details } : { message: 'We could not start that payment. Nothing was charged.' });
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <div className="flex items-start justify-between gap-4 border-b border-line px-6 pb-4 pt-5">
      <div className="min-w-0">
        <Dialog.Title className="font-display text-2xl font-semibold leading-tight">{done ? 'Thank you' : `Give to ${target.name}`}</Dialog.Title>
        <Dialog.Description id="donate-desc" className="mt-1 truncate text-sm text-muted">
          {done ? 'Your gift is on its way.' : target.title}
        </Dialog.Description>
      </div>
      <Dialog.Close className="btn-quiet -mr-2 -mt-1 h-10 w-10 shrink-0 rounded-full !p-0" aria-label="Close">
        <X className="h-5 w-5" />
      </Dialog.Close>
    </div>
  );

  if (done) {
    return (
      <>
        {header}
        <div className="overflow-y-auto px-6 py-10 text-center">
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 14, stiffness: 220 }} className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-accent-500 text-white shadow-[0_16px_40px_-10px_rgb(16_185_129/0.7)]">
            <Check className="h-10 w-10" strokeWidth={3} />
          </motion.div>
          <p className="mt-6 font-display text-3xl font-semibold">{formatAmount(done.amount, done.currency)}</p>
          {done.currency !== 'USD' && <p className="text-muted">about {money(done.amountUsd, { decimals: 2 })}</p>}
          <p className="mx-auto mt-4 max-w-sm text-muted">
            {target.name} will see your gift on their dashboard. {anonymous ? 'Your name stays hidden.' : 'Your name and message are shown on the campaign.'}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href={`/donate/complete?r=${done.token}`} className="btn-ghost" onClick={close}>View receipt</Link>
            <button type="button" onClick={close} className="btn-primary">Done</button>
          </div>
        </div>
      </>
    );
  }

  if (result) {
    return (
      <>
        {header}
        <div className="overflow-y-auto px-6 py-8">
          {result.checkoutUrl ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <Spinner className="h-7 w-7 text-brand" />
              <p className="font-medium">Taking you to a secure checkout…</p>
              <a href={result.checkoutUrl} className="btn-ghost btn-sm">Continue manually</a>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl bg-brand-50 p-4 text-[15px] text-brand-900 dark:bg-brand-900/30 dark:text-brand-100">
                <p className="flex items-center gap-2 font-semibold"><Spinner /> Waiting for your payment</p>
                {result.instructions && <p className="mt-2">{result.instructions}</p>}
              </div>
              {result.payAddress && (
                <div className="space-y-2 rounded-2xl border border-line p-4">
                  <p className="text-sm text-muted">Send exactly</p>
                  <p className="font-display text-2xl font-semibold">{result.payAmount} {result.payCurrency}</p>
                  <p className="text-sm text-muted">to this address</p>
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 break-all rounded-xl bg-sunken px-3 py-2 text-[13px]">{result.payAddress}</code>
                    <button
                      type="button"
                      className="btn-ghost btn-sm shrink-0"
                      onClick={() => {
                        void navigator.clipboard?.writeText(result.payAddress!);
                        copied.current = true;
                      }}
                    >
                      <Copy className="h-4 w-4" /> Copy
                    </button>
                  </div>
                </div>
              )}
              <p className="text-sm text-muted">You can close this window. We confirm automatically and your receipt stays available at <Link className="text-brand underline" href={`/donate/complete?r=${result.receiptToken}`} onClick={close}>this link</Link>.</p>
            </div>
          )}
        </div>
      </>
    );
  }

  const label = num > 0 ? `Give ${formatAmount(num, currency)}` : 'Give';
  const e = error?.details ?? {};

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      {header}
      <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6">
        {/* Amount */}
        <fieldset>
          <legend className="label">Amount</legend>
          <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Preset amounts in US dollars">
            {presets.map((p) => {
              const active = Number(amount) === p.local;
              return (
                <button
                  key={p.usd}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setAmount(String(p.local))}
                  className={cn('rounded-2xl border px-1 py-2.5 text-center transition', active ? 'border-brand bg-brand-50 text-brand-800 ring-2 ring-brand/30 dark:bg-brand-900/30 dark:text-brand-100' : 'border-line hover:border-ink/30')}
                >
                  <span className="block font-display text-lg font-semibold">${p.usd}</span>
                  {currency !== 'USD' && <span className="block truncate text-[11px] text-muted">{formatAmount(p.local, currency)}</span>}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <div className="relative flex-1">
              <label htmlFor="d-amount" className="sr-only">Custom amount</label>
              <input
                id="d-amount"
                inputMode="decimal"
                autoComplete="off"
                className="field pr-3 font-display text-xl font-semibold"
                placeholder="Custom amount"
                value={amount}
                onChange={(ev) => setAmount(ev.target.value.replace(/[^0-9.]/g, '').slice(0, 14))}
              />
            </div>
            <div>
              <label htmlFor="d-cur" className="sr-only">Currency</label>
              <select id="d-cur" className="field w-28 font-semibold" value={currency} onChange={(ev) => { const next = ev.target.value; const usd = quote.data?.amountUsd; setCurrency(next); if (usd && rates.data) setAmount(String(fromUsd(Math.round(usd), next, rates.data.usdPerUnit))); }}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <p className="hint min-h-5" aria-live="polite">
            {quote.data && num > 0 && currency !== 'USD'
              ? `≈ ${money(quote.data.amountUsd, { decimals: 2 })} at today's rate${quote.data.stale ? ' (rate may be a few hours old)' : ''}`
              : currency === 'USD' ? 'Converted to the campaign\'s USD goal at the live rate when you pick another currency.' : ''}
          </p>
        </fieldset>

        {/* Identity */}
        <fieldset>
          <legend className="label">How should we show your gift?</legend>
          <div className="grid grid-cols-2 gap-3" role="radiogroup">
            {[
              { v: true, icon: EyeOff, title: 'Anonymous', body: 'Shown as “Anonymous donor”' },
              { v: false, icon: UserRound, title: 'Public', body: 'Name, country and message' },
            ].map((o) => (
              <label key={o.title} className={cn('flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand', anonymous === o.v ? 'border-brand bg-brand-50 ring-2 ring-brand/25 dark:bg-brand-900/30' : 'border-line hover:border-ink/30')}>
                <input type="radio" name="identity" className="sr-only" checked={anonymous === o.v} onChange={() => setAnonymous(o.v)} />
                <o.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
                <span>
                  <span className="block font-semibold">{o.title}</span>
                  <span className="block text-[13px] text-muted">{o.body}</span>
                </span>
              </label>
            ))}
          </div>
          <AnimatePresence initial={false}>
            {!anonymous && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="grid gap-3 pt-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="d-name" className="label">Name shown</label>
                    <input id="d-name" className="field" maxLength={80} value={donorName} onChange={(ev) => setDonorName(ev.target.value)} aria-invalid={Boolean(e.donorName)} autoComplete="name" />
                  </div>
                  <div>
                    <label htmlFor="d-country" className="label">Country</label>
                    <select id="d-country" className="field" value={donorCountry} onChange={(ev) => setDonorCountry(ev.target.value)}>
                      <option value="">Prefer not to say</option>
                      {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="d-msg" className="label">Message <span className="font-normal text-muted">(optional)</span></label>
                    <textarea id="d-msg" className="field min-h-[80px]" maxLength={500} value={message} onChange={(ev) => setMessage(ev.target.value)} placeholder={`A few words for ${target.name}`} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="mt-4">
            <label htmlFor="d-email" className="label">Email for your receipt <span className="font-normal text-muted">(optional, never shown)</span></label>
            <input id="d-email" type="email" autoComplete="email" className="field" value={email} onChange={(ev) => setEmail(ev.target.value)} />
          </div>
        </fieldset>

        {/* Payment method */}
        <fieldset>
          <legend className="label">Pay with</legend>
          {options.isLoading ? (
            <div className="skeleton h-16" />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
              {gateways.map((g) => (
                <label key={g.id} className={cn('flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand', gateway === g.id ? 'border-brand bg-brand-50 ring-2 ring-brand/25 dark:bg-brand-900/30' : 'border-line hover:border-ink/30')}>
                  <input type="radio" name="gateway" className="sr-only" checked={gateway === g.id} onChange={() => setGateway(g.id)} />
                  <span className="font-medium">{GATEWAY_LABEL[g.id] ?? g.label}</span>
                  {gateway === g.id && <Check className="h-4 w-4 text-brand" aria-hidden />}
                </label>
              ))}
            </div>
          )}
          {selected && !selected.native && (
            <p className="hint">{selected.label} can't take {currency} directly, so we charge the {currency === 'BTC' || currency === 'ETH' ? 'USDT' : 'USD'} equivalent at today's rate. You'll see the final amount before paying.</p>
          )}
          {gateway === 'MPESA' && (
            <div className="mt-3">
              <label htmlFor="d-phone" className="label">M-Pesa phone number</label>
              <input id="d-phone" inputMode="tel" autoComplete="tel" className="field" placeholder="+2547…" value={phone} onChange={(ev) => setPhone(ev.target.value)} aria-invalid={Boolean(e.donorPhone)} />
              <p className="hint">We'll send a payment prompt to this phone.</p>
            </div>
          )}
        </fieldset>

        {error && (
          <div role="alert" className="flex gap-2.5 rounded-2xl bg-danger/10 p-3.5 text-[15px] text-danger">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <p>{error.message}</p>
          </div>
        )}
      </div>

      <div className="border-t border-line bg-surface px-6 pb-5 pt-4">
        <dl className="mb-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Platform fee ({options.data?.feePercent ?? 0}%)</dt>
            <dd className="font-medium">{quote.data ? money(quote.data.feeUsd, { decimals: 2 }) : '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Reaches {target.name}</dt>
            <dd className="font-semibold">{quote.data && num > 0 ? money(quote.data.netUsd, { decimals: 2 }) : '—'}</dd>
          </div>
        </dl>
        <button type="submit" className="btn-accent btn-lg w-full" disabled={busy || !(num > 0) || !gateway}>
          {busy ? <><Spinner /> Processing…</> : <><Lock className="h-4 w-4" /> {label}</>}
        </button>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-accent-600" aria-hidden /> Card and wallet details never touch our servers.
        </p>
      </div>
    </form>
  );
}
