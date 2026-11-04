import type { Metadata } from 'next';
import Link from 'next/link';
import { HowItWorks } from '@/components/home/HowItWorks';
import { PageHero } from '@/components/PageHero';
import { Section, SectionHead } from '@/components/ui';

export const metadata: Metadata = { title: 'How it works', description: 'How donors give, how beneficiaries are verified, and what happens to every donation.' };

const CHECKS = [
  ['Identity', 'National ID or passport matched to the applicant. Stored encrypted and never shown.'],
  ['Documents', 'Medical reports, school letters and rent notices are analysed for tampering and confirmed with the issuer.'],
  ['Location', 'Address and city are confirmed, by phone, community leader or a field visit where needed.'],
  ['Need legitimacy', 'The request, the amount and the story must add up.'],
  ['Income', 'Declared income is checked against occupation and household size.'],
  ['References', 'NGOs, employers, hospitals, schools or community leaders vouch for the applicant.'],
  ['Duplicate detection', 'The same ID, phone, document or device appearing twice raises an alert before approval.'],
  ['Video interview or field visit', 'For higher-risk or high-value requests, an auditor meets the person.'],
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero eyebrow="How it works" title="Two simple journeys. One strict rule." body="Nothing goes public until a human auditor has checked it." />
      <Section className="!pt-6"><HowItWorks /></Section>
      <Section className="!pt-0">
        <SectionHead title="What auditors check" body="Every application goes through the same checklist. Approval needs all five core checks to pass." />
        <dl className="grid gap-4 md:grid-cols-2">
          {CHECKS.map(([t, b]) => (
            <div key={t} className="card p-6"><dt className="font-display text-xl font-semibold">{t}</dt><dd className="mt-2 text-muted">{b}</dd></div>
          ))}
        </dl>
      </Section>
      <Section className="!pt-0">
        <SectionHead title="After you give" />
        <ol className="max-w-3xl space-y-5 text-[17px]">
          <li><b>1. You get a receipt.</b> The gift appears on the campaign page and the public ledger within moments, in the currency you chose, with its live USD value.</li>
          <li><b>2. The beneficiary is notified.</b> If you gave publicly and left a message, they see it and can thank you.</li>
          <li><b>3. They post updates.</b> Funded campaigns share progress on a timeline, so you see what your gift did.</li>
        </ol>
        <div className="mt-10 flex flex-wrap gap-3"><Link href="/needs" className="btn-primary btn-lg">Donate now</Link><Link href="/register" className="btn-ghost btn-lg">Request help</Link></div>
      </Section>
    </>
  );
}
