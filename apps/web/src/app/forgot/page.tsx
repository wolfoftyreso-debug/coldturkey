'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import { useSession } from '../../lib/session';

/**
 * Asking for a password reset link.
 *
 * The endpoint behind this has existed since account recovery was built, and
 * nothing in either client pointed at it. Forgetting a password therefore meant
 * losing the account — and with it the streak, the relapse autopsies, the
 * pattern history and the coach transcript. That is a worse loss here than in
 * most products, and it was silent.
 *
 * The answer is the same whether or not the address has an account. Who is in
 * recovery is exactly the sort of thing this product must never confirm to
 * somebody typing addresses into a form.
 */
export default function ForgotPasswordPage() {
  const { t } = useSession();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post('/v1/auth/forgot-password', { email: email.trim() });
    } catch {
      // Also silent on failure, and deliberately so. A rate limit, an unknown
      // address and a mail relay outage must be indistinguishable from here,
      // or this form becomes a way to ask whether somebody has an account.
    } finally {
      setSent(true);
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <span className="wordmark">{t('app.name')}</span>
      </header>

      <h1>{t('auth.forgotTitle')}</h1>

      {sent ? (
        <>
          <div className="card accent">
            <p className="lede">{t('auth.forgotSent')}</p>
          </div>
          <p className="center">
            <Link className="btn wide" href="/login">
              {t('auth.backToSignIn')}
            </Link>
          </p>
        </>
      ) : (
        <>
          <p className="lede">{t('auth.forgotBody')}</p>
          <div className="spacer" />
          <form onSubmit={(event) => void submit(event)} className="card">
            <div className="field">
              <label htmlFor="email">{t('auth.email')}</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                autoFocus
              />
            </div>
            <button className="btn primary wide" type="submit" disabled={busy}>
              {busy ? t('common.loading') : t('auth.forgotSend')}
            </button>
          </form>
          <p className="center">
            <Link className="pill" href="/login">
              {t('auth.backToSignIn')}
            </Link>
          </p>
        </>
      )}

      <div className="spacer" />
      <p className="muted center">{t('safety.disclaimer')}</p>
    </main>
  );
}
