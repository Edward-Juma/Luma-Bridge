import type { Metadata } from 'next';
import { PageHero } from '@/components/PageHero';
import { Section, SectionHead } from '@/components/ui';
import { serverApi } from '@/lib/api';
import { countryName, flag } from '@/lib/countries';
import { GATEWAY_LABEL, fmtDate, money } from '@/lib/format';

export const metadata: Metadata = { title: 'Transparency', description: 'A live public report: money in, fees, verification outcomes and recent audits.' };
export const dynamic = 'force-dynamic';

interface Report {
  feePercent: number;
  donations: { count: number; grossUsd: number; feesUsd: number; deliveredUsd: number };
  byGateway: { gateway: string; count: number; usd: number }[];
  verification: { approved: number; rejected: number; needsInfo: number; pending: number; totalReviews: number; approvalRate: number | null };
  recentAudits: { date: string; verificationId: string | null; country: string }[];
}

export default async function TransparencyPage() {
  const r = await serverApi<Report>('/api/transparency', 30);
  return (
    <>
      <PageHero eyebrow="Transparency" title="Everything we can show, we show." body="These figures are generated live from the same database that powers the platform. Individual donations appear on each campaign’s ledger." />
      {!r ? (
        <Section><p className="text-muted">The report is temporarily unavailable. Please try again shortly.</p></Section>
      ) : (
        <>
          <Section className="!pt-6">
            <SectionHead title="Money" body={r.feePercent === 0 ? 'Luma Bridge currently takes no platform fee. Payment processors may charge their own standard fees.' : `Luma Bridge takes a ${r.feePercent}% platform fee, shown before every donation.`} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Gifts received', money(r.donations.grossUsd)],
                ['Platform fees', money(r.donations.feesUsd, { decimals: 2 })],
                ['Delivered to beneficiaries', money(r.donations.deliveredUsd)],
                ['Successful donations', r.donations.count.toLocaleString('en-US')],
              ].map(([k, v]) => (
                <div key={k} className="card p-6"><p className="text-sm font-medium text-muted">{k}</p><p className="mt-1 font-display text-3xl font-semibold tabular-nums">{v}</p></div>
              ))}
            </div>
            {r.byGateway.length > 0 && (
              <div className="card mt-6 overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-[15px]">
                  <caption className="sr-only">Donations by payment method</caption>
                  <thead className="border-b border-line text-[13px] text-muted"><tr><th className="px-5 py-3 font-medium">Payment method</th><th className="px-5 py-3 text-right font-medium">Gifts</th><th className="px-5 py-3 text-right font-medium">Value</th></tr></thead>
                  <tbody>{r.byGateway.map((g) => <tr key={g.gateway} className="border-b border-line/60 last:border-0"><td className="px-5 py-3">{GATEWAY_LABEL[g.gateway] ?? g.gateway}</td><td className="px-5 py-3 text-right tabular-nums">{g.count}</td><td className="px-5 py-3 text-right tabular-nums">{money(g.usd)}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </Section>

          <Section className="!pt-0">
            <SectionHead title="Verification" body="Outcomes of every audit so far. We publish rejections too, because a rigorous process says no." />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ['Approved', r.verification.approved], ['Rejected', r.verification.rejected], ['Awaiting info', r.verification.needsInfo], ['In review', r.verification.pending],
                ['Approval rate', r.verification.approvalRate === null ? '—' : `${r.verification.approvalRate}%`],
              ].map(([k, v]) => (
                <div key={String(k)} className="card p-6"><p className="text-sm font-medium text-muted">{k}</p><p className="mt-1 font-display text-3xl font-semibold tabular-nums">{v}</p></div>
              ))}
            </div>
          </Section>

          <Section className="!pt-0">
            <SectionHead title="Recent audits" body="The latest approvals, identified only by verification ID and country." />
            <ul className="grid gap-3 sm:grid-cols-2">
              {r.recentAudits.map((a, i) => (
                <li key={`${a.verificationId}-${i}`} className="card flex items-center justify-between p-5"><span className="font-mono text-[15px] font-semibold">{a.verificationId}</span><span className="text-[15px] text-muted">{flag(a.country)} {countryName(a.country)} · {fmtDate(a.date)}</span></li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </>
  );
}
