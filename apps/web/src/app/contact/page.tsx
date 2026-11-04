import type { Metadata } from 'next';
import { ContactForm } from '@/components/ContactForm';
import { PageHero } from '@/components/PageHero';

export const metadata: Metadata = { title: 'Contact us' };

export default function ContactPage() {
  return (
    <>
      <PageHero eyebrow="Contact" title="Talk to a real person." body="Questions, press, partnerships or feedback: write to us and we will reply within two working days." />
      <div className="container pb-10"><div className="max-w-2xl"><ContactForm /></div></div>
    </>
  );
}
