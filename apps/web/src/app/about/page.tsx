import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { Section } from '@/components/ui';

export const metadata: Metadata = { title: 'About', description: 'Why Luma Bridge exists: to make giving as trustworthy as it is generous.' };

const PRINCIPLES = [
  ['Trust before traffic', 'We would rather list fewer people and be certain about every one of them than grow quickly and let a single scam through.'],
  ['Dignity always', 'People asking for help are neighbours, not case studies. We show first names, never documents, and beneficiaries decide what is public.'],
  ['Radical transparency', 'Every gift, every fee and every audit date is on a public ledger. If we ever take a fee, you see it before you give.'],
  ['Humans decide', 'Software flags suspicious patterns. A trained auditor makes every approval, and risky cases need a second, senior review.'],
];

export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="About Luma Bridge" title="Giving should reach the right hands." body="Most people want to help. Fewer trust that their gift arrives. Luma Bridge exists to close that gap with verification you can see." />
      <Section className="!pt-6">
        <div className="grid gap-5 md:grid-cols-2">
          {PRINCIPLES.map(([t, b]) => (
            <div key={t} className="card p-7"><h2 className="text-2xl font-semibold">{t}</h2><p className="mt-3 text-[17px] text-muted">{b}</p></div>
          ))}
        </div>
      </Section>
      <section className="container pb-10">
        <div className="relative overflow-hidden rounded-4xl bg-night p-8 text-white md:p-14">
          <div aria-hidden className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand/40 blur-3xl" />
          <h2 className="relative max-w-2xl text-3xl font-semibold !text-white md:text-4xl">A direct line between two verified people.</h2>
          <p className="relative mt-4 max-w-2xl text-lg text-white/75">Donors need no account and can stay anonymous. Beneficiaries are checked on identity, documents, location, need and income before they appear. Nothing sits in between except the payment network.</p>
          <div className="relative mt-8 flex flex-wrap gap-3">
            <Link href="/needs" className="btn-accent btn-lg">Browse campaigns</Link>
            <Link href="/transparency" className="btn btn-lg border border-white/25 text-white hover:bg-white/10">See the ledger</Link>
          </div>
        </div>
      </section>
    </>
  );
}
