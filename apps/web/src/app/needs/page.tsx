import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Feed } from '@/components/feed/Feed';
import { PageLoader } from '@/components/LottieLoader';

export const metadata: Metadata = {
  title: 'Browse verified campaigns',
  description: 'Every campaign here has been checked by an auditor. Filter by country, category, age and urgency, then give directly.',
};

export default function NeedsPage() {
  return (
    <div className="container pb-10 pt-6 md:pt-10">
      <header className="mb-8 max-w-2xl">
        <h1 className="text-4xl font-semibold md:text-5xl">Verified campaigns</h1>
        <p className="mt-3 text-lg text-muted">Each person below was checked by a human auditor. Rejected applications never appear.</p>
      </header>
      <Suspense fallback={<PageLoader label="Loading campaigns" />}>
        <Feed />
      </Suspense>
    </div>
  );
}
