import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { StaffShell } from '@/components/staff/StaffShell';

export const metadata: Metadata = { title: 'Auditor console', robots: { index: false, follow: false } };

export default function StaffLayout({ children }: { children: ReactNode }) {
  return <StaffShell>{children}</StaffShell>;
}
