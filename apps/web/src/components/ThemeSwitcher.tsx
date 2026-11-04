'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
] as const;

export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div role="group" aria-label="Color theme" className={cn('inline-flex items-center gap-0.5 rounded-xl border border-line bg-surface/80 p-1', className)}>
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-label={`${label} theme`}
          aria-pressed={theme === value}
          title={`${label} theme`}
          onClick={() => setTheme(value)}
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-lg transition-colors focus-visible:outline-offset-2',
            theme === value ? 'bg-brand text-white shadow-soft' : 'text-muted hover:bg-sunken hover:text-ink',
          )}
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </button>
      ))}
    </div>
  );
}