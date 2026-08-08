import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { OfflineReady } from '../components/OfflineReady';
import { SessionProvider } from '../lib/session';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cleat',
  description: 'Lämna beroendet. Bygg tillbaka livet. Ingen skam. Ingen religion.',
  // The app deals in addiction history; keep it out of search indexes entirely.
  robots: { index: false, follow: false },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#0a0b0d',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sv">
      <body>
        <SessionProvider>
          <OfflineReady />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
