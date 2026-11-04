'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Check, Clock, Printer } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { PageLoader } from '@/components/LottieLoader';
import { ApiError, api } from '@/lib/api';
import { GATEWAY_LABEL, fmtDate, formatAmount, money } from '@/lib/format';

interface ReceiptData {
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
  amount: number;
  currency: string;
  amountUsd: number;
  feeUsd: number;
  gateway: string;
  anonymous: boolean;
  donorName: string | null;
  createdAt: string;
  confirmedAt: string | null;
  need: { title: string; slug: string };
}

export function Receipt() {
  const sp = useSearchParams();
  const token = sp.get('r');
  // PayPal returns the order id as `token`; hosted checkouts return nothing extra.
  const orderId = sp.get('token') ?? undefined;
  const celebrated = useRef(false);

  const q = useQuery({
    queryKey: ['receipt', token],
    enabled: Boolean(token),
    queryFn: async () => {
      const base = await api<ReceiptData>(`/api/donations/receipt/${token}`, { auth: false });
      if (base.status !== 'PENDING') return base;
      return api<ReceiptData>(`/api/donations/receipt/${token}/finalize`, { method: 'POST', json: { orderId }, auth: false });
    },
    refetchInterval: (query) => (query.state.data?.status === 'PENDING' ? 4000 : false),
    retry: false,
  });

  const d = q.data;
  useEffect(() => {
    if (d?.status !== 'SUCCEEDED' || celebrated.current) return;
    celebrated.current = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    void import('canvas-confetti').then(({ default: c }) => c({ particleCount: 120, spread: 80, origin: { y: 0.4 }, colors: ['#2563EB', '#10B981', '#93B9FD', '#A7F3D0'] }));
  }, [d?.status]);

  if (!token) return <p className="text-muted">This receipt link is incomplete.</p>;
  if (q.isLoading) return <PageLoader label="Checking your payment" />;
  if (q.isError) {
    return (
      <div className="card max-w-md p-8 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-danger" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold">We couldn't find that receipt</h1>
        <p className="mt-2 text-muted">{q.error instanceof ApiError ? q.error.message : 'Check the link and try again.'}</p>
        <Link href="/needs" className="btn-primary mt-6">Browse campaigns</Link>
      </div>
    );
  }
  if (!d) return null;

  const state = {
    SUCCEEDED: { icon: Check, tone: 'bg-accent-500', title: 'Thank you for giving', body: 'Your gift has been confirmed and added to the campaign.' },
    PENDING: { icon: Clock, tone: 'bg-warn', title: 'Waiting for confirmation', body: 'Your payment is still processing. This page updates by itself.' },
    FAILED: { icon: AlertCircle, tone: 'bg-danger', title: 'The payment did not go through', body: 'Nothing was charged. You can try again with another method.' },
    REFUNDED: { icon: AlertCircle, tone: 'bg-muted', title: 'This gift was refunded', body: 'The amount has been returned to your payment method.' },
  }[d.status];
  const Icon = state.icon;

  return (
    <div className="card w-full max-w-lg overflow-hidden shadow-lift">
      <div className="px-8 pb-6 pt-10 text-center">
        <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-white ${state.tone}`}><Icon className="h-8 w-8" strokeWidth={2.6} aria-hidden /></span>
        <h1 className="mt-5 text-3xl font-semibold">{state.title}</h1>
        <p className="mt-2 text-muted">{state.body}</p>
      </div>
      <dl className="mx-8 divide-y divide-line border-y border-line text-[15px]">
        {[
          ['Campaign', <Link key="n" href={`/needs/${d.need.slug}`} className="text-brand underline underline-offset-4">{d.need.title}</Link>],
          ['Amount', <span key="a" className="font-semibold">{formatAmount(d.amount, d.currency)}</span>],
          ...(d.currency !== 'USD' ? [['Value in USD', money(d.amountUsd, { decimals: 2 })] as [string, string]] : []),
          ['Platform fee', money(d.feeUsd, { decimals: 2 })],
          ['Paid with', GATEWAY_LABEL[d.gateway] ?? d.gateway],
          ['Shown as', d.anonymous ? 'Anonymous donor' : d.donorName ?? '—'],
          ['Date', fmtDate(d.confirmedAt ?? d.createdAt)],
        ].map(([k, v], i) => (
          <div key={i} className="flex items-center justify-between gap-4 py-3">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap justify-center gap-3 px-8 py-7">
        <button type="button" className="btn-ghost" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden /> Print receipt</button>
        <Link href="/needs" className="btn-primary">Give to someone else</Link>
      </div>
    </div>
  );
}
