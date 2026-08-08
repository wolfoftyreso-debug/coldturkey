'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useSession } from '../lib/session';

/**
 * The tab bar carries the three calm modes plus the coach.
 *
 * Reset (I'm craving) and Now (I'm struggling) are deliberately absent: they are
 * acute states reached from the enormous buttons on the home screen, not places
 * you browse to. Putting a craving button in permanent chrome would also mean it
 * is on screen when someone is doing fine, which is its own kind of suggestion.
 */
const TABS = [
  { href: '/home', key: 'nav.home' },
  { href: '/plan', key: 'nav.plan' },
  { href: '/patterns', key: 'nav.stats' },
  { href: '/rebuild', key: 'nav.rebuild' },
  { href: '/coach', key: 'nav.coach' },
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
