'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useSession } from '../../lib/session';

/**
 * Where the email verification link lands.
 *
 * Same gap as `/reset`: the mail pointed here and the page did not exist. A
 * confirmed address is what makes a password reset possible at all, so an
 * unreachable verification link quietly removes the only way back into an
 * account.
 *
 * The endpoint is idempotent — a second click is not an error — so this screen
 * has exactly two outcomes and no retry button.
 */
export default function VerifyEmailPage() {
  const { t } = useSession();
  const [state, setState] = useState<'working' | 'done' | 'invalid'>('working');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setState('invalid');
      return;
    }
    api
      .post('/v1/auth/verify-email', { token })
      .then(() => setState('done'))
      .catch(() => setState('invalid'));
  }, []);

  return (
    <main className="shell">
      <header className="topbar">
        <span className="wordmark">{t('app.name')}</span>
      </header>

      <h1>{t('auth.verifyTitle')}</h1>

      <div className={state === 'invalid' ? 'card warning' : 'card accent'}>
        <p className="lede">
          {state === 'working'
            ? t('auth.verifyWorking')
            : state === 'done'
              ? t('auth.verifyDone')
              : t('auth.verifyInvalid')}
        </p>
      </div>

      <Link className="btn primary wide" href="/login">
        {t('auth.backToSignIn')}
      </Link>

      <div className="spacer" />
      <p className="muted center">{t('safety.disclaimer')}</p>
    </main>
  );
}
