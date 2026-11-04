'use client';

import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, History, Siren, Flag, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { api } from '@/lib/api';
import { useRequireRole } from '@/lib/guard';
import type { StaffOverview } from '@/lib/me-types';
import { cn } from '@/lib/utils';
import { PageLoader } from '../LottieLoader';

export function useOverview() {
  return useQuery({ queryKey: ['staff', 'overview'], queryFn: () => api<StaffOverview>('/api/staff/overview'), refetchInterval: 60_000 });
}

export function StaffShell({ children }: { children: ReactNode }) {
  const { ready, user } = useRequireRole(['AUDITOR', 'ADMIN'], { mfa: true });
  const { data } = useOverview();
  const path = usePathname();
  if (!ready || !user) return <PageLoader label="Verifying your session" />;

  const links = [
    { href: '/staff', label: 'Review queue', Icon: ClipboardCheck, badge: data ? data.pending + data.needsInfo : 0, exact: true },
    { href: '/staff/alerts', label: 'Fraud alerts', Icon: Siren, badge: data?.alerts ?? 0, danger: (data?.criticalAlerts ?? 0) > 0 },
    { href: '/staff/reports', label: 'Community reports', Icon: Flag, badge: data?.reports ?? 0 },
    { href: '/staff/audit-log', label: 'Activity log', Icon: History, badge: 0 },
  ];
  return (
    <div className="container pb-16 pt-4 lg:pt-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-night text-white"><LayoutGrid className="h-5 w-5" aria-hidden /></span>
          <div>
            <p className="font-display text-xl font-semibold leading-tight">Auditor console</p>
            <p className="text-[13px] text-muted">{user.email} · {user.role === 'ADMIN' ? 'Admin' : 'Auditor'}</p>
          </div>
        </div>
        <nav aria-label="Console" className="no-scrollbar -mx-5 flex gap-1 overflow-x-auto px-5 md:mx-0 md:px-0">
          {links.map(({ href, label, Icon, badge, danger, exact }) => {
            const active = exact ? path === href || path.startsWith('/staff/applications') : path.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={cn('flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-[15px] font-medium transition', active ? 'bg-brand text-white' : 'text-ink/75 hover:bg-sunken')}>
                <Icon className="h-4 w-4" aria-hidden />{label}
                {badge > 0 && <span className={cn('rounded-full px-1.5 text-xs font-bold', active ? 'bg-white/25' : danger ? 'bg-danger text-white' : 'bg-sunken text-ink')}>{badge}</span>}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
