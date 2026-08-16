import { useEffect, useState } from 'react';
import { Share, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ApiError, api, type TotpEnabled, type TotpSetup, type TotpStatus } from './api';
import { useSession } from './session';
import { colors, styles } from './theme';

/**
 * Turning on a second factor from the phone, and turning it off again.
 *
 * The mobile client could already *answer* a two-step challenge but had no way
 * to switch the thing on or off, so somebody who only ever uses the phone had a
 * security control they could not reach. That is the same class of gap as
 * having no UI at all: the feature exists on the server and does not exist for
 * the person.
 *
 * Enrolment is two steps for the same reason as on the web: a secret is issued
 * and shown, and nothing is switched on until the person has proved they can
 * produce a code from it. Losing this account means losing the record of the
 * hardest thing somebody has done, which is worse than the risk the second
 * factor is protecting against.
 */
export function TwoFactor() {
  const { t } = useSession();
  const [status, setStatus] = useState<TotpStatus | null>(null);
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    setStatus(await api.get<TotpStatus>('/v1/auth/totp'));
  }

  useEffect(() => {
    void reload().catch(() => undefined);
  }, []);

  function fail(caught: unknown) {
    const map: Record<string, string> = {
      totp_invalid: 'auth.totpWrongCode',
      totp_not_started: 'auth.totpNotStarted',
      totp_already_enabled: 'auth.totpAlreadyOn',
      unauthorized: 'auth.invalid',
    };
    setError(caught instanceof ApiError ? t(map[caught.code] ?? 'common.error') : t('common.error'));
  }

  async function begin() {
    setBusy(true);
    setError(null);
    try {
      setSetup(await api.post<TotpSetup>('/v1/auth/totp/setup', {}));
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(false);
    }
  }

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<TotpEnabled>('/v1/auth/totp/enable', { code });
      setCodes(result.recoveryCodes);
      setSetup(null);
      setCode('');
      await reload();
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      await api.post('/v1/auth/totp/disable', { password });
      setPassword('');
      await reload();
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;

  // Shown once, immediately after enrolment, and nothing else is on screen.
  if (codes) {
    return (
      <View>
        <Text style={styles.h2}>{t('auth.totpRecoveryTitle').toUpperCase()}</Text>
        <View style={[styles.card, styles.cardWarning]}>
          <Text style={styles.body}>{t('auth.totpRecoveryBody')}</Text>
          {codes.map((value) => (
            <Text key={value} style={[styles.lede, { fontVariant: ['tabular-nums'] }]} selectable>
              {value}
            </Text>
          ))}
          {/* The share sheet rather than a download: on a phone that is how a
              person gets text into their password manager or their notes. */}
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              void Share.share({ message: codes.join('\n') }).catch(() => undefined);
            }}
          >
            <Text style={styles.buttonText}>{t('auth.totpRecoveryDownload')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={() => setCodes(null)}
          >
            <Text style={[styles.buttonText, styles.buttonTextPrimary]}>
              {t('auth.totpRecoverySaved')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.h2}>{t('auth.totpTitle').toUpperCase()}</Text>

      {error ? (
        <View style={[styles.errorBanner, { marginBottom: 10 }]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {status.enabled ? (
        <View style={styles.card}>
          <Text style={styles.lede}>{t('auth.totpOn')}</Text>
          <Text style={styles.muted}>
            {t('auth.totpCodesLeft', { count: status.recoveryCodesRemaining })}
          </Text>
          {/* The password, not just a session: otherwise a borrowed phone could
              take the second factor off and then use the account freely. */}
          <Text style={styles.label}>{t('auth.totpDisablePassword')}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            placeholderTextColor={colors.textFaint}
          />
          <TouchableOpacity
            style={styles.button}
            onPress={() => void disable()}
            disabled={busy || password.length === 0}
          >
            <Text style={styles.buttonText}>{t('auth.totpDisable')}</Text>
          </TouchableOpacity>
        </View>
      ) : setup ? (
        <View style={styles.card}>
          <Text style={styles.body}>{t('auth.totpSetupBody')}</Text>
          <Text style={styles.label}>{t('auth.totpSecretLabel')}</Text>
          {/* Selectable, because the authenticator app is on this same device
              and the key has to be able to get there without being retyped. */}
          <Text style={[styles.lede, { letterSpacing: 1.5 }]} selectable>
            {setup.secret}
          </Text>
          <Text style={styles.label}>{t('auth.totpCode')}</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            inputMode="numeric"
            textContentType="oneTimeCode"
            placeholderTextColor={colors.textFaint}
          />
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={() => void enable()}
            disabled={busy || code.length < 6}
          >
            <Text style={[styles.buttonText, styles.buttonTextPrimary]}>
              {t('auth.totpConfirm')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => setSetup(null)} disabled={busy}>
            <Text style={styles.buttonText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.body}>{t('auth.totpOffBody')}</Text>
          <TouchableOpacity style={styles.button} onPress={() => void begin()} disabled={busy}>
            <Text style={styles.buttonText}>{t('auth.totpEnable')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
