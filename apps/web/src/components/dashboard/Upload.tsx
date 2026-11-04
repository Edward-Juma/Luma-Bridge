'use client';

import { UploadCloud } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { errMsg } from '@/lib/me';
import { cn } from '@/lib/utils';
import { Spinner } from '../ui';

/** Click-or-drop uploader. Posts multipart to `path` and reports the JSON result. */
export function Upload<T>({
  path, accept, fields, label, hint, onDone, disabled, compact,
}: {
  path: string;
  accept: string;
  fields?: Record<string, string | undefined>;
  label: string;
  hint?: string;
  onDone: (r: T) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  async function send(file: File) {
    if (file.size > 8 * 1024 * 1024) return toast.error('Files can be up to 8 MB.');
    const form = new FormData();
    for (const [k, v] of Object.entries(fields ?? {})) if (v) form.set(k, v);
    form.set('file', file);
    setBusy(true);
    try {
      onDone(await api<T>(path, { method: 'POST', form }));
    } catch (e) {
      toast.error(errMsg(e, 'Upload failed. Please try again.'));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div>
      <label
        htmlFor={id}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f && !disabled) void send(f); }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed text-center transition',
          compact ? 'gap-1 px-4 py-5' : 'gap-2 px-6 py-9',
          over ? 'border-brand bg-brand/5' : 'border-line hover:border-brand/50 hover:bg-sunken',
          (disabled || busy) && 'pointer-events-none opacity-60',
        )}
      >
        {busy ? <Spinner className="h-5 w-5 text-brand" /> : <UploadCloud className="h-6 w-6 text-brand" aria-hidden />}
        <span className="font-semibold">{busy ? 'Uploading…' : label}</span>
        {hint && <span className="text-[13px] text-muted">{hint}</span>}
      </label>
      <input ref={input} id={id} type="file" accept={accept} className="sr-only" disabled={disabled || busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void send(f); }} />
    </div>
  );
}
