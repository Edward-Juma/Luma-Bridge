import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NeedDetailView } from '@/components/need/NeedDetail';
import { serverApi } from '@/lib/api';
import { CATEGORY_LABEL, money } from '@/lib/format';
import type { NeedDetail } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const need = await serverApi<NeedDetail>(`/api/needs/${encodeURIComponent(slug)}`, 30);
  if (!need) return { title: 'Campaign not found' };
  const desc = `${need.summary} ${CATEGORY_LABEL[need.category]} · ${money(need.raisedUsd)} raised of ${money(need.goalUsd)}. Verified by Luma Bridge auditors.`;
  return {
    title: need.title,
    description: desc,
    openGraph: { title: need.title, description: desc, images: need.coverUrl ? [need.coverUrl] : undefined },
  };
}

export default async function NeedPage({ params }: Params) {
  const { slug } = await params;
  const need = await serverApi<NeedDetail>(`/api/needs/${encodeURIComponent(slug)}`, 15);
  if (!need) notFound();
  return <NeedDetailView slug={slug} initial={need} />;
}
