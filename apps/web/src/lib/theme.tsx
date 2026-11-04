'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';
const Ctx = createContext<{ theme: Theme; resolved: 'light' | 'dark'; setTheme: (t: Theme) => void } | null>(null);

/** Runs before hydration so there is never a flash of the wrong theme. */
export const themeScript = `(function(){try{var t=localStorage.getItem('hb-theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();`;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');

  const apply = useCallback((t: Theme) => {
    const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    setResolved(dark ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    let t: Theme = 'system';
    try {
      t = (localStorage.getItem('hb-theme') as Theme) || 'system';
    } catch {
      /* storage blocked */
    }
    setThemeState(t);
    apply(t);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply((localStorage.getItem('hb-theme') as Theme) || 'system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [apply]);

  const setTheme = useCallback(
    (t: Theme) => {
      setThemeState(t);
      try {
        localStorage.setItem('hb-theme', t);
      } catch {
        /* ignore */
      }
      apply(t);
    },
    [apply],
  );

  return <Ctx.Provider value={{ theme, resolved, setTheme }}>{children}</Ctx.Provider>;
}

export const useTheme = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme must be used inside <ThemeProvider>');
  return v;
};
