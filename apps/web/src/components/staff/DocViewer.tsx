'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchBlobUrl } from '@/lib/api';
import { DOC_LABEL } from '@/lib/format';
import { Spinner } from '../ui';

/** Fetches the protected file with the auditor's token (access is audit-logged server-side) and previews it. */
export function DocViewer({ doc, onClose }: { doc: { id: string; kind: string; mime: string } | null; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!doc) return;
    let alive = true;
    let made: string | null = null;
    setUrl(null);
    setErr(null);
    fetchBlobUrl(`/api/staff/documents/${doc.id}/file`)
      .then((u) => {
        made = u;
        if (alive) setUrl(u);
      })
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
      if (made?.startsWith('blob:')) URL.revokeObjectURL(made);
    };
  }, [doc]);

  return (
    <Dialog.Root open={Boolean(doc)} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-night/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-3 top-[4vh] z-[90] mx-auto flex h-[92vh] max-w-4xl flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-lift outline-none">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
            <Dialog.Title className="font-sans text-base font-semibold">{doc ? DOC_LABEL[doc.kind] ?? doc.kind : ''}</Dialog.Title>
            <Dialog.Description className="sr-only">Private document preview. This view is recorded in the audit log.</Dialog.Description>
            <Dialog.Close className="btn-quiet h-9 w-9 !p-0" aria-label="Close"><X className="h-5 w-5" /></Dialog.Close>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center bg-sunken">
            {err ? <p className="px-6 text-center text-danger">{err}</p>
              : !url ? <Spinner className="h-6 w-6 text-brand" />
              : doc?.mime === 'application/pdf' ? <iframe title="Document" src={url} className="h-full w-full" />
              // eslint-disable-next-line @next/next/no-img-element
              : <img src={url} alt="Uploaded document" className="max-h-full max-w-full object-contain" />}
          </div>
          <p className="border-t border-line px-5 py-2 text-[13px] text-muted">Viewing is recorded in the audit log.</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
