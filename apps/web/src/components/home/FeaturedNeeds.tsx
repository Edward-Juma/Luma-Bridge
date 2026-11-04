'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { FeedResponse, NeedCard as Need } from '@/lib/types';
import { NeedCard, NeedCardSkeleton } from '../NeedCard';

export function FeaturedNeeds({ initial }: { initial?: Need[] }) {
  const { data, isLoading } = useQuery({
    queryKey: ['needs', 'featured'],
    queryFn: async () => (await api<FeedResponse>('/api/needs?sort=urgent&pageSize=6', { auth: false })).items,
    initialData: initial?.length ? initial : undefined,
  });
  if (isLoading) return <div className="masonry">{Array.from({ length: 3 }, (_, i) => <NeedCardSkeleton key={i} />)}</div>;
  if (!data?.length) return <p className="text-muted">New campaigns appear here as soon as auditors approve them.</p>;
  return (
    <div className="masonry">
      {data.map((n, i) => <NeedCard key={n.id} need={n} priority={i < 3} />)}
    </div>
  );
}
