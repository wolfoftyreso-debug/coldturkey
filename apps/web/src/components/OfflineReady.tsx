'use client';

import { useEffect, useState } from 'react';
import { useSession } from '../lib/session';

/**
 * Registers the service worker and shows a quiet banner when the network is
 * gone, so the person knows the plan they are looking at came from the device
 * rather than wondering whether it is stale.
 *
 * Registration is deliberately silent on failure: an unsupported browser or a
 * blocked worker should degrade to a normal online app, never to an error.
 */
export function OfflineReady() {
  const { t } = useSession();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }

    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="offline-banner" role="status">
      {t('offline.banner')}
    </div>
  );
}
