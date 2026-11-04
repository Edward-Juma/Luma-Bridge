import type { Metadata } from 'next';
import { PageHero, Prose } from '@/components/PageHero';

export const metadata: Metadata = { title: 'Privacy policy' };

export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Privacy policy" body="Last updated 30 October 2026. This is a plain-language summary of how Luma Bridge handles personal data." />
      <Prose>
        <h2>What we collect</h2>
        <ul>
          <li><b>Donors:</b> amount, currency, time and the payment method used. If you give publicly, your name, country and message. An email address only if you want a receipt.</li>
          <li><b>Beneficiaries:</b> identity details, contact details, location, income, household information, photos, supporting documents and payout details, provided so auditors can verify your request.</li>
          <li><b>Everyone:</b> technical data such as IP address and device information for security and fraud prevention.</li>
        </ul>
        <h2>How we use it</h2>
        <ul>
          <li>To process donations and deliver them to verified beneficiaries.</li>
          <li>To verify applicants and prevent fraud, including automated document checks, duplicate detection and risk scoring. Automated scores only flag cases; people make decisions.</li>
          <li>To send receipts, account notices and, if you opt in, a short monthly newsletter.</li>
        </ul>
        <h2>What is public</h2>
        <p>For beneficiaries: first name and last initial, age, country, city, photo, story, payment method names with masked endings, and audit dates. For donors who choose public giving: name, country and message. Documents, national ID numbers, addresses, phone numbers and income details are never public.</p>
        <h2>Protection</h2>
        <p>National IDs and payout details are encrypted at rest. Documents are private and viewable only by authenticated auditors with two-step verification. Every access is logged. Connections use HTTPS, and we rate-limit and monitor for abuse.</p>
        <h2>Sharing</h2>
        <p>We share data only with payment processors needed to move money, infrastructure providers that host the service under contract, and authorities where the law requires it. We do not sell personal data.</p>
        <h2>Retention</h2>
        <p>Donation records are kept as long as financial regulations require. Rejected applications stay private and are deleted on request unless needed to prevent repeat fraud. You can ask us to delete your account at any time.</p>
        <h2>Your rights</h2>
        <p>Depending on where you live, you may have the right to access, correct, export or delete your data, and to object to certain processing. Contact us through the <a href="/contact">contact page</a>.</p>
        <p className="text-sm text-muted">This summary is provided for convenience. Have it reviewed by counsel for your jurisdictions (for example GDPR and the Kenya Data Protection Act) before launch.</p>
      </Prose>
    </>
  );
}
