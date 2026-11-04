'use client';

import { useMutation } from '@tanstack/react-query';
import { Facebook, Instagram, Linkedin, Twitter, Youtube } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError, api } from '@/lib/api';
import { Logo } from './Logo';
import { Spinner } from './ui';

const COLUMNS: { title: string; links: [string, string][] }[] = [
  { title: 'Luma Bridge', links: [['About', '/about'], ['How it works', '/how-it-works'], ['Transparency', '/transparency'], ['Become an auditor', '/become-an-auditor']] },
  { title: 'Help', links: [['FAQs', '/faq'], ['Support', '/support'], ['Contact', '/contact'], ['Request help', '/register']] },
  { title: 'Legal', links: [['Privacy', '/privacy'], ['Terms', '/terms']] },
];

const SOCIAL = [
  { label: 'X (Twitter)', href: 'https://x.com', Icon: Twitter },
  { label: 'Instagram', href: 'https://instagram.com', Icon: Instagram },
  { label: 'LinkedIn', href: 'https://linkedin.com', Icon: Linkedin },
  { label: 'Facebook', href: 'https://facebook.com', Icon: Facebook },
  { label: 'YouTube', href: 'https://youtube.com', Icon: Youtube },
];

export function Newsletter() {
  const [email, setEmail] = useState('');
  const sub = useMutation({
    mutationFn: () => api('/api/newsletter', { method: 'POST', json: { email }, auth: false }),
    onSuccess: () => {
      toast.success('You are subscribed. We send one short note a month.');
      setEmail('');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not subscribe. Please try again.'),
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        sub.mutate();
      }}
      className="flex w-full max-w-md flex-col gap-2 sm:flex-row"
    >
      <label htmlFor="nl-email" className="sr-only">Email address</label>
      <input id="nl-email" type="email" required placeholder="you@example.com" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field flex-1 rounded-full px-5" />
      <button type="submit" className="btn-primary" disabled={sub.isPending}>{sub.isPending ? <Spinner /> : 'Subscribe'}</button>
    </form>
  );
}

export function Footer() {
  const path = usePathname();

  if (path === '/login' || path === '/register') return null;

  return (
    <footer className="mt-24 border-t border-line bg-sunken/60">
      <div className="container grid gap-12 py-14 md:grid-cols-[1.4fr_2fr]">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-muted">Every campaign is checked by a human auditor before it goes live, and every gift is on a public ledger.</p>
          <p className="mb-2 mt-8 font-semibold">One short email a month</p>
          <Newsletter />
          <ul className="mt-6 flex gap-1.5" aria-label="Social media">
            {SOCIAL.map(({ label, href, Icon }) => (
              <li key={label}>
                <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="btn-quiet h-10 w-10 !p-0 text-muted hover:text-ink">
                  <Icon className="h-[18px] w-[18px]" />
                </a>
              </li>
            ))}
          </ul>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {COLUMNS.map((c) => (
            <div key={c.title}>
              <h2 className="font-sans text-sm font-semibold tracking-normal text-ink">{c.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {c.links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="text-muted transition hover:text-ink">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="border-t border-line">
        <div className="container flex flex-wrap items-center justify-between gap-3 py-5 text-sm text-muted">
          <p>© {new Date().getFullYear()} Luma Bridge. Donations are processed by regulated payment partners.</p>
          <p>Built for dignity: beneficiaries control what is shown about them.</p>
        </div>
      </div>
    </footer>
  );
}
