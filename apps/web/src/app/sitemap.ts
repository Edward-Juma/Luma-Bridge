import type { MetadataRoute } from 'next';
import { serverApi } from '@/lib/api';
import type { FeedResponse } from '@/lib/types';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statics = ['', '/needs', '/about', '/how-it-works', '/transparency', '/faq', '/support', '/contact', '/become-an-auditor', '/privacy', '/terms'];
  const feed = await serverApi<FeedResponse>('/api/needs?pageSize=48', 300);
  return [
    ...statics.map((p) => ({ url: `${SITE}${p}`, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.6 })),
    ...(feed?.items ?? []).map((n) => ({ url: `${SITE}/needs/${n.slug}`, lastModified: n.createdAt, changeFrequency: 'daily' as const, priority: 0.8 })),
  ];
}
