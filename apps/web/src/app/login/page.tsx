'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../lib/api';
import { useSession } from '../../lib/session';

export default function LoginPage() {
  const { t, signIn, signUp, user, loading } = useSession();
  const router = useRouter();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/home');
  }, [loading, user, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signIn') await signIn(email, password);
      else await signUp(email, password, displayName);
    } catch (caught) {
      if (caught instanceof ApiError) {
        const map: Record<string, string> = {
          weak_password: 'auth.weakPassword',
          email_taken: 'auth.emailTaken',
          unauthorized: 'auth.invalid',
        };
        setError(t(map[caught.code] ?? 'common.error'));
      } else {
        setError(t('common.error'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <span className="wordmark">{t('app.name')}</span>
      </header>

      <h1>{t('app.tagline')}</h1>
      <p className="lede">{t('app.subtitle')}</p>

      <div className="spacer" />

      <form onSubmit={submit} className="card">
        {error ? <div className="error-banner">{error}</div> : null}

        {mode === 'signUp' ? (
          <div className="field">
            <label htmlFor="displayName">{t('auth.displayName')}</label>
            <input
              id="displayName"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="nickname"
            />
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="email">{t('auth.email')}</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="field">
          <label htmlFor="password">{t('auth.password')}</label>
          <input
            id="password"
            type="password"
            required
            minLength={mode === 'signUp' ? 12 : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
          />
        </div>

        <button className="btn primary wide" type="submit" disabled={busy}>
          {busy ? t('common.loading') : t(mode === 'signIn' ? 'auth.signIn' : 'auth.signUp')}
        </button>
      </form>

      <p className="center muted">
        {t(mode === 'signIn' ? 'auth.noAccount' : 'auth.haveAccount')}{' '}
        <button
          type="button"
          className="pill"
          data-tone="accent"
          onClick={() => {
            setMode(mode === 'signIn' ? 'signUp' : 'signIn');
            setError(null);
          }}
        >
          {t(mode === 'signIn' ? 'auth.signUp' : 'auth.signIn')}
        </button>
      </p>

      <div className="spacer" />
      <p className="muted center">{t('safety.disclaimer')}</p>
    </main>
  );
}
