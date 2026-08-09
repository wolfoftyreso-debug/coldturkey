'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from '../lib/session';

/**
 * Sends a signed-in visitor to the app.
 *
 * Split out so the landing page itself stays a server component: the crisis
 * numbers on it must render without JavaScript, and a page that needs a
 * client bundle to show a phone number is a page that fails on the connection
 * where it matters. This renders nothing and only ever redirects.
 */
export function LandingRedirect() {
  const { user, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace('/home');
  }, [user, loading, router]);

  return null;
}
