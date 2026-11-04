import { ArrowRight, Copy, FileSearch, Fingerprint, KeyRound, Landmark, ScanText, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { Categories } from '@/components/home/Categories';
import { FeaturedNeeds } from '@/components/home/FeaturedNeeds';
import { Hero } from '@/components/home/Hero';
import { HowItWorks } from '@/components/home/HowItWorks';
import { Stats } from '@/components/home/Stats';
import { Section, SectionHead } from '@/components/ui';
import { serverApi } from '@/lib/api';
import type { FeedResponse, Stats as StatsT, TickerItem } from '@/lib/types';

// Live numbers: never bake the API's state into the build.
export const dynamic = 'force-dynamic';

const TRUST = [
  { icon: Fingerprint, title: 'Identity first', body: 'National ID or passport is checked and stored encrypted. No profile is public until it passes.' },
  { icon: FileSearch, title: 'Documents verified at the source', body: 'Auditors confirm medical reports, school letters and rent notices with the hospital, school or landlord.' },
  { icon: Copy, title: 'Duplicates caught automatically', body: 'The same ID, phone, document or device appearing twice raises a fraud alert before anyone is approved.' },
  { icon: ScanText, title: 'AI flags, humans decide', body: 'Document analysis scores every upload. A person makes every approval, and risky cases need an admin.' },
  { icon: UsersRound, title: 'Community reporting', body: 'Anyone can report a campaign. Reports feed the fraud score and trigger a manual review.' },
  { icon: Landmark, title: 'A public ledger', body: 'Every donation, currency, time and fee is visible. Audit dates appear on every profile.' },
];

export default async function HomePage() {
  const [stats, feed, ticker, all] = await Promise.all([
    serverApi<StatsT>('/api/stats', 20),
    serverApi<FeedResponse>('/api/needs?sort=urgent&pageSize=6', 20),
    serverApi<{ items: TickerItem[] }>('/api/ticker', 10),
    serverApi<FeedResponse>('/api/needs?pageSize=48', 60),
  ]);
  const featured = feed?.items.find((n) => n.coverUrl) ?? feed?.items[0];

  return (
    <>
      <Hero countries={(all?.items ?? []).map((n) => n.beneficiary.country)} featured={featured} ticker={ticker?.items} />
      <Stats initial={stats} />

      <Section>
        <SectionHead title="How Luma Bridge works" body="Two short journeys, one rule: nothing goes public until a person has checked it." />
        <HowItWorks />
      </Section>

      <Section className="!pt-0">
        <SectionHead
          title="People who need help now"
          body="The most urgent verified campaigns, newest audits first."
          action={<Link href="/needs" className="btn-ghost">See all campaigns <ArrowRight className="h-4 w-4" aria-hidden /></Link>}
        />
        <FeaturedNeeds initial={feed?.items} />
      </Section>

      <Section className="!pt-0">
        <SectionHead title="Give where it matters to you" />
        <Categories />
      </Section>

      <Section className="bg-sunken/70">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.5fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <h2 className="text-3xl font-semibold md:text-[2.6rem] md:leading-[1.05]">Why you can trust where your gift goes</h2>
            <p className="mt-4 max-w-md text-lg text-muted">Scams thrive when nobody checks. We built the checking into every step, and we publish the results.</p>
            <Link href="/transparency" className="btn-primary mt-7">Read the transparency report</Link>
          </div>
          <ul className="grid gap-x-10 gap-y-9 sm:grid-cols-2">
            {TRUST.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-surface text-brand shadow-soft ring-1 ring-line"><Icon className="h-5 w-5" aria-hidden /></span>
                <h3 className="font-sans text-lg font-semibold tracking-normal">{title}</h3>
                <p className="mt-1.5 text-[15px] text-muted">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <section className="container py-16 md:py-24">
        <div className="relative isolate overflow-hidden rounded-[2rem] px-7 py-14 text-white md:rounded-[2.75rem] md:px-16 md:py-20" style={{ background: 'radial-gradient(60% 90% at 100% 0%, rgb(16 185 129 / .55), transparent 60%), linear-gradient(135deg, #1E41AE, #2563EB 60%, #3B73F4)' }}>
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold text-white md:text-5xl md:leading-[1.05]">Need help, or know someone who does?</h2>
            <p className="mt-4 text-lg text-white/80">Applying takes about ten minutes. Your documents are encrypted and only auditors can open them.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="btn btn-lg bg-white text-brand-800 hover:bg-white/90">Request help</Link>
              <Link href="/become-an-auditor" className="btn glass btn-lg text-white hover:bg-white/20"><KeyRound className="h-4 w-4" aria-hidden /> Become an auditor</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
