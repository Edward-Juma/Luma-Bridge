import { BadgeCheck, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { LogoMark } from '../Logo';
import { ThemeSwitcher } from '../ThemeSwitcher';

const POINTS = [
  { Icon: ShieldCheck, title: 'Human-verified', body: 'An auditor checks your identity and documents before anything goes public.' },
  { Icon: EyeOff, title: 'You stay in control', body: 'Only your first name, country and story are shown. Your ID and documents are never public.' },
  { Icon: Lock, title: 'Encrypted at rest', body: 'National IDs and payout details are encrypted with AES-256-GCM.' },
  { Icon: BadgeCheck, title: 'Your verification ID', body: 'Approved profiles get a unique ID donors can trust.' },
] as const;

/** Dark, focused auth layout with the trust details kept beside the form on wide screens. */
export function AuthShell({ title, subtitle, children, wide }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className="auth-theme relative min-h-[100svh] overflow-hidden bg-page text-ink">
      <div aria-hidden className="auth-theme-backdrop pointer-events-none absolute inset-0" />
      <div className="relative mx-auto flex min-h-[100svh] w-full max-w-[1440px] flex-col px-5 pb-6 pt-5 sm:px-8 lg:px-14">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" aria-label="Luma Bridge home" className="inline-flex min-h-11 items-center gap-3 rounded-lg">
            <LogoMark size={38} />
            <span className="font-display text-lg font-semibold tracking-normal text-ink">Luma Bridge</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeSwitcher />
            <Link href="/needs" className="auth-subtle-link hidden min-h-11 items-center rounded-lg px-3 text-sm font-medium sm:inline-flex">
              Browse campaigns
            </Link>
          </div>
        </header>

        <div className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.15fr)] lg:gap-16 lg:py-12">
          <aside aria-label="Why Luma Bridge" className="hidden lg:block">
            <div className="max-w-lg">
              <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-brand">A safer way to ask for help</p>
              <h1 className="font-display text-5xl font-semibold leading-[1.08] text-ink">{title}</h1>
              {subtitle && <p className="mt-5 max-w-md text-base leading-7 text-muted">{subtitle}</p>}
              <ul className="mt-10 space-y-6">
                {POINTS.map(({ Icon, title: t, body }) => (
                  <li key={t} className="flex gap-4">
                    <span className="auth-icon-box flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
                      <Icon className="h-5 w-5 text-accent-700 dark:text-accent-400" aria-hidden />
                    </span>
                    <div className="pt-0.5">
                      <p className="font-semibold text-ink">{t}</p>
                      <p className="mt-1 max-w-sm text-sm leading-6 text-muted">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <section aria-label={title} className="mx-auto w-full max-w-2xl lg:mx-0 lg:justify-self-end">
            <div className="mb-6 lg:hidden">
              <h1 className="font-display text-4xl font-semibold leading-tight text-ink">{title}</h1>
              {subtitle && <p className="mt-3 max-w-xl text-base leading-7 text-muted">{subtitle}</p>}
            </div>
            <div className={`auth-panel w-full ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>{children}</div>
            <p className="mt-5 text-center text-xs leading-5 text-muted lg:text-left">Your personal information stays private and is reviewed by real people.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
