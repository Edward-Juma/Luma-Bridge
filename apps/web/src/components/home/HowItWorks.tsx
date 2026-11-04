import Link from 'next/link';
import { cn } from '@/lib/utils';

export const SEEKER_STEPS = [
  ['Create account', 'Sign up with your name, ID and phone. Your details stay private.'],
  ['Submit your need', 'Tell your story, set a goal and add the documents that prove it.'],
  ['Verification process', 'An auditor checks your identity, documents and need, and may call a hospital, school or leader.'],
  ['Approved profile goes public', 'You get a Verified badge and a unique verification ID. Declined applications stay private.'],
  ['Receive donations', 'Choose how you want to be paid. Post updates and thank your supporters.'],
] as const;

export const DONOR_STEPS = [
  ['Browse verified profiles', 'Filter by country, category, urgency or age.'],
  ['Choose someone', 'Read the story, see the audit date and the documents that were checked.'],
  ['Donate', 'Pick an amount in any of 16 currencies. We convert at the live rate.'],
  ['Select Anonymous or Public', 'Hide your name, or add your name, country and a message.'],
  ['Confirmation', 'Your receipt arrives at once and the campaign total updates live.'],
] as const;

function Steps({ title, intro, steps, tone, cta }: { title: string; intro: string; steps: readonly (readonly [string, string])[]; tone: 'brand' | 'accent'; cta: { href: string; label: string } }) {
  return (
    <div className="card flex flex-col p-7 md:p-9">
      <h3 className="text-2xl font-semibold">{title}</h3>
      <p className="mt-1.5 text-muted">{intro}</p>
      <ol className="mt-8 space-y-0">
        {steps.map(([t, b], i) => (
          <li key={t} className="relative flex gap-4 pb-7 last:pb-0">
            {i < steps.length - 1 && <span aria-hidden className="absolute left-[17px] top-9 h-[calc(100%-2.25rem)] w-px bg-line" />}
            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-[15px] font-semibold text-white', tone === 'brand' ? 'bg-brand' : 'bg-accent-600')}>{i + 1}</span>
            <div>
              <p className="font-semibold leading-snug">{t}</p>
              <p className="mt-0.5 text-[15px] text-muted">{b}</p>
            </div>
          </li>
        ))}
      </ol>
      <Link href={cta.href} className={cn('mt-8 self-start', tone === 'brand' ? 'btn-primary' : 'btn-accent')}>{cta.label}</Link>
    </div>
  );
}

export function HowItWorks() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Steps title="For people in need" intro="Five steps from application to a live, verified campaign." steps={SEEKER_STEPS} tone="brand" cta={{ href: '/register', label: 'Request help' }} />
      <Steps title="For donors" intro="No account, no forms. Give in under a minute." steps={DONOR_STEPS} tone="accent" cta={{ href: '/needs', label: 'Browse campaigns' }} />
    </div>
  );
}
