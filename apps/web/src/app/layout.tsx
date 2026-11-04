import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { DonateProvider } from '@/components/DonateModal';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { Providers } from '@/components/Providers';
import { themeScript } from '@/lib/theme';
import './globals.css';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: 'Luma Bridge: giving that reaches the right hands', template: '%s · Luma Bridge' },
  description: 'Give directly to people in need whose identity, documents and story have been checked by human auditors. No account needed to donate.',
  icons: {
    icon: [{ url: '/luma-bridge-icon.svg', type: 'image/svg+xml' }],
    shortcut: '/luma-bridge-icon.svg',
    apple: '/luma-bridge-icon.svg',
  },
  openGraph: {
    type: 'website',
    siteName: 'Luma Bridge',
    title: 'Luma Bridge: giving that reaches the right hands',
    description: 'Every campaign is verified before it goes live. Every donation is on a public ledger.',
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F9FAFB' },
    { media: '(prefers-color-scheme: dark)', color: '#080D1B' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const shell = (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-brand focus:px-5 focus:py-3 focus:text-white">
        Skip to content
      </a>
      <Providers>
        <DonateProvider>
          <Header />
          <main id="main" tabIndex={-1} className="outline-none">
            {children}
          </main>
          <Footer />
        </DonateProvider>
      </Providers>
    </>
  );

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        {clerkPublishableKey ? <ClerkProvider publishableKey={clerkPublishableKey}>{shell}</ClerkProvider> : shell}
      </body>
    </html>
  );
}
