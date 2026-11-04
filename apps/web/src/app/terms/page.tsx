import type { Metadata } from 'next';
import { PageHero, Prose } from '@/components/PageHero';

export const metadata: Metadata = { title: 'Terms of use' };

export default function TermsPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Terms of use" body="Last updated 30 October 2026. By using Luma Bridge you agree to these terms." />
      <Prose>
        <h2>What Luma Bridge is</h2>
        <p>Luma Bridge is a platform that connects donors with people in need whose identity and circumstances have been reviewed by auditors. We are not a bank, and donations are processed by regulated third-party payment partners.</p>
        <h2>Donations</h2>
        <ul>
          <li>Donations are voluntary gifts and are generally non-refundable, except where required by law or in cases of error or fraud.</li>
          <li>Amounts are converted at the rate shown before you pay. Processor fees and any platform fee are shown before you confirm.</li>
          <li>Verification reduces risk but cannot eliminate it. Luma Bridge does not guarantee how funds are used after delivery.</li>
        </ul>
        <h2>Beneficiaries</h2>
        <ul>
          <li>You must be 18 or older, or apply through a guardian, and provide accurate and complete information.</li>
          <li>You must not submit forged documents, duplicate accounts, or false claims. We may suspend or permanently ban accounts and report fraud to authorities.</li>
          <li>Approved requests are locked from major edits so donors are not misled. Post an update to share changes.</li>
          <li>You are responsible for any taxes that apply to funds you receive.</li>
        </ul>
        <h2>Auditors</h2>
        <p>Auditors must act honestly, protect personal data, use two-step verification and never accept payment for a decision. All activity is logged.</p>
        <h2>Prohibited use</h2>
        <p>No fraud, money laundering, harassment, scraping of personal data, attempts to bypass security, or posting of unlawful content. Public comments may not contain links.</p>
        <h2>Liability</h2>
        <p>The service is provided “as is”. To the extent allowed by law, Luma Bridge is not liable for indirect or consequential losses, or for the actions of users.</p>
        <h2>Changes</h2>
        <p>We may update these terms. Material changes will be announced on the site. Continued use means you accept them.</p>
        <p className="text-sm text-muted">These terms are a starting template. Have them reviewed by counsel in the jurisdictions where you operate before launch.</p>
      </Prose>
    </>
  );
}
