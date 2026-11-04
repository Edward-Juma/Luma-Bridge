import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageLoader } from '@/components/LottieLoader';
import { Receipt } from './Receipt';

export const metadata: Metadata = { title: 'Your receipt', robots: { index: false } };

export default function CompletePage() {
  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-12">
      <Suspense fallback={<PageLoader label="Checking your payment" />}>
        <Receipt />
      </Suspense>
    </div>
  );
}
