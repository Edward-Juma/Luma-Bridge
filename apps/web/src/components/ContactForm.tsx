'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError, api } from '@/lib/api';
import { Input, Spinner, Textarea } from './ui';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(100),
  email: z.string().trim().email('Enter a valid email address'),
  subject: z.string().trim().min(3, 'Add a short subject').max(150),
  body: z.string().trim().min(10, 'Write at least a sentence').max(4000),
});

export function ContactForm({ defaultSubject = '', placeholder }: { defaultSubject?: string; placeholder?: string }) {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError, reset } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { name: '', email: '', subject: defaultSubject, body: '' } });

  async function onSubmit(v: z.infer<typeof schema>) {
    try {
      await api('/api/contact', { method: 'POST', json: v, auth: false });
      setSent(true);
      reset();
    } catch (e) {
      setError('body', { message: e instanceof ApiError ? e.message : 'Could not send your message. Please try again.' });
    }
  }

  if (sent) {
    return (
      <div role="status" className="card flex flex-col items-center gap-3 p-10 text-center">
        <CheckCircle2 className="h-10 w-10 text-accent-500" aria-hidden />
        <p className="font-display text-2xl font-semibold">Message received</p>
        <p className="text-muted">Thank you. A real person on our team will reply, usually within two working days.</p>
        <button className="btn-ghost mt-2" onClick={() => setSent(false)}>Send another</button>
      </div>
    );
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5 p-6 md:p-8" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Input label="Your name" autoComplete="name" required error={errors.name?.message} {...register('name')} />
        <Input label="Email" type="email" autoComplete="email" required error={errors.email?.message} {...register('email')} />
      </div>
      <Input label="Subject" required error={errors.subject?.message} {...register('subject')} />
      <Textarea label="Message" rows={6} required placeholder={placeholder} error={errors.body?.message} {...register('body')} />
      <button className="btn-primary" disabled={isSubmitting}>{isSubmitting ? <Spinner /> : 'Send message'}</button>
    </form>
  );
}
