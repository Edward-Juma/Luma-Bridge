import type { Metadata } from 'next';
import { ContactForm } from '@/components/ContactForm';
import { PageHero } from '@/components/PageHero';

export const metadata: Metadata = { title: 'Become an auditor', description: 'Help verify the people who ask for help. Join the Luma Bridge auditor network.' };

const ROLE = [
  'Review identity, documents, location, income and references for new applications',
  'Contact hospitals, schools, NGOs, employers and community leaders to confirm claims',
  'Run video interviews, and field visits where you are local to the applicant',
  'Document every decision so it can be audited in turn',
];
const LOOK = ['Careful, sceptical and kind in equal measure', 'Experience in social work, NGOs, compliance, journalism, banking or community leadership', 'Fluency in the languages of the region you cover', 'Comfort with handling sensitive personal data responsibly'];

export default function BecomeAuditorPage() {
  return (
    <>
      <PageHero eyebrow="Join us" title="Be the reason a gift is trusted." body="Auditors are the heart of Luma Bridge. Every campaign is only public because one of them said yes." />
      <div className="container grid gap-10 pb-10 lg:grid-cols-2">
        <div className="space-y-8">
          <section><h2 className="text-2xl font-semibold">What you would do</h2><ul className="mt-4 list-disc space-y-2 pl-6 text-[17px] text-ink/85">{ROLE.map((r) => <li key={r}>{r}</li>)}</ul></section>
          <section><h2 className="text-2xl font-semibold">Who we look for</h2><ul className="mt-4 list-disc space-y-2 pl-6 text-[17px] text-ink/85">{LOOK.map((r) => <li key={r}>{r}</li>)}</ul></section>
          <p className="rounded-2xl bg-sunken p-5 text-[15px] text-muted">Auditor accounts require two-step verification, are limited to what the role needs, and every action is written to a tamper-evident log. Accounts are created by an admin after a background and reference check.</p>
        </div>
        <ContactForm defaultSubject="Auditor application" placeholder="Tell us about your background, the region and languages you cover, and why you want to help." />
      </div>
    </>
  );
}
