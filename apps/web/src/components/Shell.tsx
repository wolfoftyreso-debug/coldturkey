'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useSession } from '../lib/session';

const TABS = [
  { href: '/home', key: 'nav.home' },
  { href: '/coach', key: 'nav.coach' },
  { href: '/checkin', key: 'nav.checkin' },
  { href: '/patterns', key: 'nav.stats' },
  { href: '/plan', key: 'nav.plan' },
];

export function Shell({ children, title }: { children: ReactNode; title?: string }) {
  const { t } = useSession();
  const pathname = usePathname();

  return (
    <>
      <main className="shell">
        <header className="topbar">
          <span className="wordmark">{t('app.name')}</span>
          <Link href="/settings" className="muted">
            {t('nav.settings')}
          </Link>
        </header>
        {title ? <h1>{title}</h1> : null}
        {children}
      </main>
      <nav className="tabbar">
        {TABS.map((tab) => (
          <Link key={tab.href} href={tab.href} data-active={pathname === tab.href}>
            {t(tab.key)}
          </Link>
        ))}
      </nav>
    </>
  );
}

export function Loading() {
  const { t } = useSession();
  return (
    <main className="shell">
      <p className="muted">{t('common.loading')}</p>
    </main>
  );
}
