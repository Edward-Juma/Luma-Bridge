import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthShell } from '@/components/auth/AuthShell';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to manage your campaign. Auditors will be asked for a two-step code.">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
