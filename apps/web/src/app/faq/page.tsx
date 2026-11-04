import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';

export const metadata: Metadata = { title: 'FAQs', description: 'Answers about donating, verification, fees, anonymity, and requesting help.' };

const FAQ: { q: string; a: string }[] = [
  { q: 'Do I need an account to donate?', a: 'No. Choose a campaign, pick an amount, and pay. You can give anonymously or add your name and an optional message.' },
  { q: 'How do I know a campaign is real?', a: 'Every campaign was reviewed by a human auditor who checked identity, documents, location, the legitimacy of the need and income. Verified campaigns carry a badge and a unique verification ID, plus the date of the last audit.' },
  { q: 'What does “anonymous” hide?', a: 'Your name, country and message are hidden from the public and from the beneficiary. Our payment partners still process your payment details, and we keep your email only to send a receipt.' },
  { q: 'Which currencies and payment methods can I use?', a: 'USD, EUR, GBP, KES, CAD, AUD, JPY, CHF, AED, SAR, INR, NGN, ZAR, and BTC, ETH and USDT. Methods include cards, Apple Pay, Google Pay, PayPal, M-Pesa, Flutterwave, Paystack, Wise and crypto, depending on what is enabled in your region. Amounts are converted at a live rate before you pay.' },
  { q: 'Does Luma Bridge take a fee?', a: 'The fee, if any, is shown before you confirm and listed on the Transparency page. Payment processors may charge their own standard fees.' },
  { q: 'Can I get a refund?', a: 'Donations are gifts and are generally final. If something went wrong (for example a duplicate charge), contact support and we will help.' },
  { q: 'How do I ask for help?', a: 'Create an account, add your documents and payment details, then write your request. An auditor reviews it, and if approved it goes live with a Verified badge. You can track every step on your dashboard.' },
  { q: 'Why was my application not approved?', a: 'Auditors leave a note explaining what was missing or inconsistent. If they requested more information you can edit and resubmit. Rejected applications stay private.' },
  { q: 'What happens to my documents?', a: 'They are stored privately, encrypted in transit, and only auditors can open them. Every access is logged. They are never shown to donors.' },
  { q: 'How can I report a suspicious campaign?', a: 'Use the Report button on any campaign page. Reports raise the campaign’s risk score and send it to an auditor for manual review. Suspicious accounts can be suspended immediately.' },
  { q: 'Can I become an auditor?', a: 'Yes, we are always looking for careful, ethical people. See the Become an auditor page.' },
];

export default function FaqPage() {
  const ld = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
  return (
    <>
      <PageHero eyebrow="FAQs" title="Questions, answered plainly." />
      <div className="container pb-10">
        <div className="max-w-3xl divide-y divide-line rounded-3xl border border-line bg-surface">
          {FAQ.map((f) => (
            <details key={f.q} className="group px-6 py-5 open:bg-sunken/50">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                {f.q}
                <span aria-hidden className="text-2xl font-light text-muted transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-[17px] text-muted">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-muted">Still stuck? <Link className="font-semibold text-brand underline underline-offset-4" href="/contact">Contact us</Link>.</p>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
    </>
  );
}
