import type { Metadata } from 'next';
import { TwoFactor } from '@/components/staff/TwoFactor';

export const metadata: Metadata = { title: 'Two-step verification', robots: { index: false, follow: false } };

export default function TwoFactorPage() {
  return <TwoFactor />;
}
