import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/AuthShell';
import { RegisterForm } from '@/components/auth/RegisterForm';

export const metadata: Metadata = {
  title: 'Request help',
  description: 'Create a confidential account, tell us what you need and let our auditors verify your request.',
};

export default function RegisterPage() {
  return (
    <AuthShell wide title="Request help" subtitle="It takes about five minutes. Nothing is public until an auditor has verified your request.">
      <RegisterForm />
    </AuthShell>
  );
}
