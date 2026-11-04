'use client';

import { useMutation } from '@tanstack/react-query';
import { BadgeCheck, FileText, Lock, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { DOC_LABEL, fmtDate } from '@/lib/format';
import { errMsg, useDashboard, useRefreshDashboard } from '@/lib/me';
import { PageLoader } from '../LottieLoader';
import { EmptyState, Select } from '../ui';
import { DashHeading } from './DashShell';
import { Upload } from './Upload';

const KINDS = Object.keys(DOC_LABEL);
const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function Documents() {
  const { data, isLoading } = useDashboard();
  const refresh = useRefreshDashboard();
  const [kind, setKind] = useState('IDENTITY');
  const [needId, setNeedId] = useState('');
  const del = useMutation({
    mutationFn: (id: string) => api(`/api/me/documents/${id}`, { method: 'DELETE' }),
    onSuccess: async () => { toast.success('Document removed'); await refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  if (isLoading || !data) return <PageLoader label="Loading documents" />;
  const locked = data.profile.verificationStatus === 'PENDING';
  return (
    <>
      <DashHeading title="Documents" body="Upload proof so auditors can verify your story. Only auditors can ever open these files, and they are stored privately." />
      <div className="card mb-6 flex items-start gap-3 bg-brand/5 p-5 text-[15px]">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
        <p>Documents are never shown to donors or the public. Every time an auditor opens one, it is written to a tamper-evident audit log.</p>
      </div>

      <section className="card p-6" aria-label="Add a document">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Document type" value={kind} onChange={(e) => setKind(e.target.value)}>
            {KINDS.map((k) => <option key={k} value={k}>{DOC_LABEL[k]}</option>)}
          </Select>
          <Select label="Relates to" value={needId} onChange={(e) => setNeedId(e.target.value)} hint="Optional">
            <option value="">My profile in general</option>
            {data.needs.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
          </Select>
        </div>
        <div className="mt-4">
          <Upload path="/api/me/documents" accept="application/pdf,image/jpeg,image/png,image/webp" fields={{ kind, needId }} label="Choose a file or drop it here" hint="PDF, JPG, PNG or WebP · up to 8 MB" disabled={locked} onDone={() => { toast.success('Document uploaded'); void refresh(); }} />
          {locked && <p className="hint">Documents are locked while your application is under review.</p>}
        </div>
      </section>

      <h2 className="mb-3 mt-10 text-xl font-semibold">Uploaded ({data.documents.length})</h2>
      {data.documents.length === 0 ? (
        <EmptyState title="No documents yet" body="Start with your national ID or passport." />
      ) : (
        <ul className="space-y-3">
          {data.documents.map((d) => (
            <li key={d.id} className="card flex items-center gap-4 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sunken"><FileText className="h-5 w-5 text-brand" aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{DOC_LABEL[d.kind] ?? d.kind}</p>
                <p className="text-[13px] text-muted">{kb(d.sizeBytes)} · {fmtDate(d.createdAt)}{d.needId ? ' · linked to a request' : ''}</p>
              </div>
              {d.verified && <span className="hidden items-center gap-1 text-sm font-semibold text-accent-700 sm:inline-flex dark:text-accent-400"><BadgeCheck className="h-4 w-4" aria-hidden /> Verified</span>}
              <button className="btn-quiet h-10 w-10 !p-0 text-muted hover:text-danger" aria-label={`Remove ${DOC_LABEL[d.kind] ?? 'document'}`} disabled={locked || del.isPending} onClick={() => { if (confirm('Remove this document?')) del.mutate(d.id); }}>
                <Trash2 className="h-[18px] w-[18px]" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
