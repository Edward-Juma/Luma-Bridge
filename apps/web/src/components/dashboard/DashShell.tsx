'use client';

import { Bell, FileText, HandCoins, HeartHandshake, LayoutDashboard, UserRound, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useRequireRole } from '@/lib/guard';
import { useDashboard } from '@/lib/me';
import { cn } from '@/lib/utils';
import { PageLoader } from '../LottieLoader';
import { Avatar } from '../ui';

const LINKS = [
  { href: '/dashboard', label: 'Overview', Icon: LayoutDashboard, exact: true },
  { href: '/dashboard/campaigns', label: 'Campaigns', Icon: HeartHandshake },
  { href: '/dashboard/donations', label: 'Supporters', Icon: HandCoins },
  { href: '/dashboard/documents', label: 'Documents', Icon: FileText },
  { href: '/dashboard/payments', label: 'Payment methods', Icon: Wallet },
  { href: '/dashboard/profile', label: 'Profile', Icon: UserRound },
  { href: '/dashboard/notifications', label: 'Notifications', Icon: Bell },
] as const;

export function DashShell({ children }: { children: ReactNode }) {
  const { ready } = useRequireRole(['BENEFICIARY']);
  const { data } = useDashboard();
  const path = usePathname();

  if (!ready) return <PageLoader label="Opening your dashboard" />;

  const unread = data?.unreadNotifications ?? 0;
  return (
    <div className="container grid gap-8 pb-16 pt-4 lg:grid-cols-[250px_1fr] lg:pt-8">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        {data && (
          <div className="mb-4 hidden items-center gap-3 rounded-2xl border border-line bg-surface p-3 lg:flex">
            <Avatar src={data.profile.photoUrl} name={data.profile.fullName} size={44} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{data.profile.fullName}</p>
              <p className="truncate text-[13px] text-muted">{data.profile.verificationId ?? 'Not yet verified'}</p>
            </div>
          </div>
        )}
        <nav aria-label="Dashboard" className="no-scrollbar -mx-5 flex gap-1 overflow-x-auto px-5 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
          {LINKS.map(({ href, label, Icon, ...rest }) => {
            const active = 'exact' in rest ? path === href : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-full px-4 py-2.5 text-[15px] font-medium transition lg:rounded-xl',
                  active ? 'bg-brand text-white shadow-soft' : 'text-ink/75 hover:bg-sunken',
                )}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden />
                {label}
                {label === 'Notifications' && unread > 0 && (
                  <span className={cn('ml-auto rounded-full px-2 text-xs font-bold', active ? 'bg-white/25' : 'bg-danger text-white')}>{unread}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function DashHeading({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold md:text-4xl">{title}</h1>
        {body && <p className="mt-2 max-w-2xl text-muted">{body}</p>}
      </div>
      {action}
    </div>
  );
}
