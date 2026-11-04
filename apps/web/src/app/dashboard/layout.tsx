import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { DashShell } from '@/components/dashboard/DashShell';

export const metadata: Metadata = { title: 'Your dashboard', robots: { index: false, follow: false } };

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashShell>{children}</DashShell>;
}
