'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useDashboard } from '@/lib/me';
import { CATEGORY_LABEL, money, fmtDate } from '@/lib/format';
import { PageLoader } from '../LottieLoader';
import { EmptyState, ProgressBar } from '../ui';
import { DashHeading } from './DashShell';
import { StatusPill } from './Overview';

export function CampaignList() {
  const { data, isLoading } = useDashboard();
  if (isLoading || !data) return <PageLoader label="Loading campaigns" />;
  return (
    <>
      <DashHeading
        title="Your campaigns"
        body="You can have up to three open requests at a time. Each is reviewed by an auditor before it appears publicly."
        action={<Link href="/dashboard/campaigns/new" className="btn-primary"><Plus className="h-4 w-4" aria-hidden /> New request</Link>}
      />
      {data.needs.length === 0 ? (
        <EmptyState title="No requests yet" body="Write your first request. You can save it as a draft and finish later." action={<Link href="/dashboard/campaigns/new" className="btn-primary">Start a request</Link>} />
      ) : (
        <ul className="space-y-4">
          {data.needs.map((n) => (
            <li key={n.id}>
              <Link href={`/dashboard/campaigns/${n.id}`} className="card block p-6 transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-muted">{CATEGORY_LABEL[n.category]} · created {fmtDate(n.createdAt)}</p>
                    <h2 className="mt-1 text-xl font-semibold">{n.title}</h2>
                    <p className="mt-1 line-clamp-2 text-[15px] text-muted">{n.summary}</p>
                  </div>
                  <StatusPill status={n.status} />
                </div>
                <div className="mt-5">
                  <ProgressBar percent={n.goalUsd ? (n.raisedUsd / n.goalUsd) * 100 : 0} />
                  <p className="mt-2 text-sm text-muted"><b className="text-ink">{money(n.raisedUsd)}</b> raised of {money(n.goalUsd)} · {n.donationCount} gifts</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
