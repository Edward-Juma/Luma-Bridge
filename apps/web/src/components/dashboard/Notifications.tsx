'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { useRefreshDashboard } from '@/lib/me';
import type { Notice } from '@/lib/me-types';
import { cn } from '@/lib/utils';
import { PageLoader } from '../LottieLoader';
import { EmptyState } from '../ui';
import { DashHeading } from './DashShell';

export function Notifications() {
  const refresh = useRefreshDashboard();
  const q = useQuery({ queryKey: ['me', 'notifications'], queryFn: () => api<{ items: Notice[] }>('/api/me/notifications') });
  const read = useMutation({
    mutationFn: () => api('/api/me/notifications/read', { method: 'POST' }),
    onSuccess: async () => { await q.refetch(); await refresh(); },
  });
  if (q.isLoading) return <PageLoader label="Loading notifications" />;
  const items = q.data?.items ?? [];
  const unread = items.filter((i) => !i.read).length;
  return (
    <>
      <DashHeading title="Notifications" action={unread > 0 ? <button className="btn-ghost btn-sm" onClick={() => read.mutate()}>Mark all as read</button> : undefined} />
      {items.length === 0 ? (
        <EmptyState title="Nothing yet" body="Updates from auditors and supporters will appear here." />
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <li key={n.id} className={cn('card p-5', !n.read && 'border-brand/40 bg-brand/[0.04]')}>
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold">{!n.read && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-brand" aria-label="Unread" />}{n.title}</p>
                <span className="shrink-0 text-[13px] text-muted">{timeAgo(n.createdAt)}</span>
              </div>
              <p className="mt-1 text-[15px] text-ink/80">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
