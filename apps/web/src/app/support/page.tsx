import type { Metadata } from 'next';
import { HeartHandshake, KeyRound, ShieldAlert, Wallet } from 'lucide-react';
import Link from 'next/link';
import { ContactForm } from '@/components/ContactForm';
import { PageHero } from '@/components/PageHero';

export const metadata: Metadata = { title: 'Support' };

const TOPICS = [
  { Icon: Wallet, title: 'A payment problem', body: 'Charged twice, payment pending, or wrong currency? Include the receipt number from your confirmation.' },
  { Icon: HeartHandshake, title: 'My application', body: 'Track every step from your dashboard. Auditors leave notes there if they need anything.' },
  { Icon: KeyRound, title: 'Sign-in or 2FA', body: 'Locked out or lost your authenticator? Tell us your account email and we will verify you.' },
  { Icon: ShieldAlert, title: 'Report a campaign', body: 'Use the Report button on the campaign page so it goes straight to an auditor.' },
];

export default function SupportPage() {
  return (
    <>
      <PageHero eyebrow="Support" title="We’re here to help." body="Pick what is closest, or send us a message." />
      <div className="container grid gap-10 pb-10 lg:grid-cols-[1fr_1.1fr]">
        <ul className="space-y-4">
          {TOPICS.map(({ Icon, title, body }) => (
            <li key={title} className="card flex gap-4 p-6">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand"><Icon className="h-5 w-5" aria-hidden /></span>
              <div><p className="font-semibold">{title}</p><p className="mt-1 text-[15px] text-muted">{body}</p></div>
            </li>
          ))}
          <li className="px-1 text-[15px] text-muted">Looking for quick answers? <Link href="/faq" className="font-semibold text-brand underline underline-offset-4">Read the FAQs</Link>.</li>
        </ul>
        <ContactForm defaultSubject="Support request" />
      </div>
    </>
  );
}
