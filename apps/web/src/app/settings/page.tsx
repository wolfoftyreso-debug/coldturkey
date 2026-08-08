'use client';

import { useState } from 'react';
import { Loading, Shell } from '../../components/Shell';
import { api, tokens } from '../../lib/api';
import { useRequireAuth } from '../../lib/session';

export default function SettingsPage() {
  const { user, loading, t, signOut, refreshUser } = useRequireAuth();
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (loading || !user) return <Loading />;

  async function setLocale(locale: 'sv' | 'en') {
    await api.patch('/v1/me', { locale });
    await refreshUser();
  }

  async function setCountry(country: string) {
    await api.patch('/v1/me', { country });
    await refreshUser();
  }

  async function exportData() {
    setBusy(true);
    try {
      const data = await api.get<unknown>('/v1/privacy/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'cleat-export.json';
      link.click();
      URL.revokeObjectURL(url);
      setMessage(t('privacy.exportDone'));
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    setBusy(true);
    try {
      await api.del('/v1/privacy/account', { confirm });
      tokens.clear();
      window.location.href = '/login';
    } catch {
      setMessage(t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  const deleteWord = t('privacy.deleteWord');

  return (
    <Shell title={t('settings.title')}>
      {message ? <div className="error-banner">{message}</div> : null}

      <h2>{t('settings.language')}</h2>
      <div className="chips">
        <button
          className="chip"
          data-selected={user.locale === 'sv'}
          onClick={() => void setLocale('sv')}
        >
          {t('settings.language.sv')}
        </button>
        <button
          className="chip"
          data-selected={user.locale === 'en'}
          onClick={() => void setLocale('en')}
        >
          {t('settings.language.en')}
        </button>
      </div>

      <h2>{t('settings.country')}</h2>
      <div className="chips">
        {['SE', 'US', 'GB'].map((code) => (
          <button
            key={code}
            className="chip"
            data-selected={user.country === code}
            onClick={() => void setCountry(code)}
          >
            {code}
          </button>
        ))}
      </div>

      <h2>{t('privacy.title')}</h2>
      <div className="card">
        <p>{t('privacy.principles')}</p>
        <button className="btn wide" onClick={exportData} disabled={busy}>
          {t('privacy.export')}
        </button>
      </div>

      {/* Deletion is a first-class control, not a support ticket. Recovery data
          in the wrong hands costs people jobs and custody. */}
      <div className="card warning">
        <h3>{t('privacy.delete')}</h3>
        <p>{t('privacy.deleteConfirm')}</p>
        <div className="field">
          <input
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder={deleteWord}
          />
        </div>
        <button
          className="btn wide"
          onClick={deleteAccount}
          disabled={busy || confirm !== deleteWord}
        >
          {t('action.delete')}
        </button>
      </div>

      <div className="spacer" />
      <button className="btn wide" onClick={() => void signOut()}>
        {t('auth.signOut')}
      </button>

      <div className="spacer" />
      <p className="muted">{t('safety.disclaimer')}</p>
    </Shell>
  );
}
