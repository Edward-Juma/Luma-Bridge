'use client';

import { animate, useInView, useReducedMotion } from 'framer-motion';
import { BadgeCheck, Flame, Loader2 } from 'lucide-react';
import { forwardRef, useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { PRIORITY_LABEL } from '@/lib/format';
import type { Priority } from '@/lib/types';
import { cn } from '@/lib/utils';

export function VerifiedBadge({ id, className, compact }: { id?: string | null; className?: string; compact?: boolean }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full bg-accent-500/12 px-2.5 py-1 text-xs font-semibold text-accent-700 ring-1 ring-accent-500/25 dark:text-accent-400', className)}
      title={id ? `Verification ID ${id}` : 'Verified by Luma Bridge auditors'}
    >
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
      {compact ? 'Verified' : id ? `Verified · ${id}` : 'Verified'}
    </span>
  );
}

export function UrgencyBadge({ priority, className }: { priority: Priority; className?: string }) {
  if (priority === 'LOW' || priority === 'MEDIUM') return null;
  const critical = priority === 'CRITICAL';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
        critical ? 'bg-danger/12 text-danger ring-danger/25' : 'bg-warn/15 text-amber-700 ring-warn/30 dark:text-amber-400',
        className,
      )}
    >
      <Flame className="h-3.5 w-3.5" aria-hidden />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function ProgressBar({ percent, className, label }: { percent: number; className?: string; label?: string }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(p)}
      aria-label={label ?? 'Funding progress'}
      className={cn('h-2.5 w-full overflow-hidden rounded-full bg-sunken ring-1 ring-inset ring-line/70', className)}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand-600 to-accent-500 transition-[width] duration-1000 ease-out"
        style={{ width: `${p}%` }}
      />
    </div>
  );
}

export function Avatar({ src, name, size = 40, className }: { src?: string | null; name: string; size?: number; className?: string }) {
  const initials = name
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} className={cn('shrink-0 rounded-full object-cover ring-2 ring-surface', className)} style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800', className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} aria-hidden />;
}

/** Counts up from 0 the first time it scrolls into view. */
export function Counter({ value, prefix = '', suffix = '', compact, className }: { value: number; prefix?: string; suffix?: string; compact?: boolean; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? value : 0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setN(value);
      return;
    }
    const c = animate(0, value, { duration: 1.6, ease: [0.16, 1, 0.3, 1], onUpdate: setN });
    return () => c.stop();
  }, [inView, value, reduce]);

  const text = compact
    ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
    : Math.round(n).toLocaleString('en-US');
  return (
    <span ref={ref} className={cn('tabular-nums', className)} aria-label={`${prefix}${value.toLocaleString('en-US')}${suffix}`}>
      {prefix}
      {text}
      {suffix}
    </span>
  );
}

// ───────── Form primitives (work with react-hook-form's register) ─────────
interface FieldWrapProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: (p: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode;
  className?: string;
}

export function FieldWrap({ label, error, hint, required, children, className }: FieldWrapProps) {
  const id = useId();
  const desc = error ? `${id}-e` : hint ? `${id}-h` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden> *</span>}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': desc })}
      {error ? (
        <p id={`${id}-e`} role="alert" className="error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-h`} className="hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type BaseProps = { label: string; error?: string; hint?: string; wrapClass?: string };

export const Input = forwardRef<HTMLInputElement, BaseProps & InputHTMLAttributes<HTMLInputElement>>(function Input(
  { label, error, hint, wrapClass, required, className, ...rest },
  ref,
) {
  return (
    <FieldWrap label={label} error={error} hint={hint} required={required} className={wrapClass}>
      {(a) => <input ref={ref} {...a} required={false} className={cn('field', className)} {...rest} />}
    </FieldWrap>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { label, error, hint, wrapClass, required, className, ...rest },
  ref,
) {
  return (
    <FieldWrap label={label} error={error} hint={hint} required={required} className={wrapClass}>
      {(a) => <textarea ref={ref} {...a} className={cn('field min-h-[110px] resize-y', className)} {...rest} />}
    </FieldWrap>
  );
});

export const Select = forwardRef<HTMLSelectElement, BaseProps & SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { label, error, hint, wrapClass, required, className, children, ...rest },
  ref,
) {
  return (
    <FieldWrap label={label} error={error} hint={hint} required={required} className={wrapClass}>
      {(a) => (
        <select ref={ref} {...a} className={cn('field appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2.4' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...rest}>
          {children}
        </select>
      )}
    </FieldWrap>
  );
});

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-3xl border border-dashed border-line px-6 py-14 text-center">
      <p className="font-display text-xl font-semibold">{title}</p>
      <p className="mt-2 text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Section({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn('py-16 md:py-24', className)}>
      <div className="container">{children}</div>
    </section>
  );
}

export function SectionHead({ title, body, action, className }: { title: string; body?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-10 flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="max-w-2xl">
        <h2 className="text-3xl font-semibold md:text-[2.6rem] md:leading-[1.05]">{title}</h2>
        {body && <p className="mt-3 text-lg text-muted">{body}</p>}
      </div>
      {action}
    </div>
  );
}
