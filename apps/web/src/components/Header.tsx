'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { homeFor, useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';
import { ThemeSwitcher } from './ThemeSwitcher';

const NAV = [
  { href: '/needs', label: 'Browse campaigns' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/transparency', label: 'Transparency' },
];

export function Header() {
  const { user, logout, loading } = useAuth();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const onHero = path === '/';

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  if (path === '/login' || path === '/register') return null;

  return (
    <header className={cn('sticky top-0 z-50 transition-all duration-300', scrolled || open ? 'glass-light shadow-[0_1px_0_rgb(var(--line)/0.6)]' : 'bg-transparent')}>
      <div className="container flex h-[92px] items-center justify-between gap-4">
        <Link href="/" aria-label="Luma Bridge home" className="rounded-xl">
          <Logo />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={path === n.href ? 'page' : undefined} className={cn('rounded-full px-4 py-2 text-[15px] font-medium transition hover:bg-sunken', path === n.href ? 'text-brand' : 'text-ink/80')}>
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <ThemeSwitcher />
          <div className="hidden items-center gap-2 sm:flex">
            {user ? (
              <>
                <Link href={homeFor(user)} className="btn-ghost btn-sm"><LayoutDashboard className="h-4 w-4" /> {user.role === 'BENEFICIARY' ? 'My dashboard' : 'Auditor desk'}</Link>
                <button type="button" onClick={() => void logout()} className="btn-quiet btn-sm" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
              </>
            ) : (
              !loading && (
                <>
                  <Link href="/login" className="btn-quiet btn-sm">Sign in</Link>
                  <Link href="/register" className={cn('btn-sm', onHero && !scrolled ? 'btn-primary' : 'btn-primary')}>Request help</Link>
                </>
              )
            )}
          </div>
          <button type="button" className="btn-quiet h-10 w-10 !p-0 lg:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? 'Close menu' : 'Open menu'}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav id="mobile-nav" aria-label="Mobile" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden lg:hidden">
            <div className="container flex flex-col gap-1 pb-5 pt-1">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-2xl px-3 py-3 text-lg font-medium hover:bg-sunken">{n.label}</Link>
              ))}
              <div className="mt-3 flex flex-wrap gap-2">
                {user ? (
                  <>
                    <Link href={homeFor(user)} className="btn-primary">Open dashboard</Link>
                    <button type="button" onClick={() => void logout()} className="btn-ghost">Sign out</button>
                  </>
                ) : (
                  <>
                    <Link href="/register" className="btn-primary">Request help</Link>
                    <Link href="/login" className="btn-ghost">Sign in</Link>
                  </>
                )}
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
