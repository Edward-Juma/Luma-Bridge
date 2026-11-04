'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider, useTheme } from '@/lib/theme';

function ThemedToaster() {
  const { resolved } = useTheme();
  return <Toaster theme={resolved} position="bottom-right" richColors closeButton toastOptions={{ style: { fontFamily: 'var(--font-sans, inherit)', borderRadius: 16 } }} />;
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: (n, e) => n < 2 && !(e as { status?: number })?.status } } }),
  );
  return (
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <AuthProvider>
          {/* reducedMotion="user" makes every framer-motion animation respect the OS setting */}
          <MotionConfig reducedMotion="user">{children}</MotionConfig>
          <ThemedToaster />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
