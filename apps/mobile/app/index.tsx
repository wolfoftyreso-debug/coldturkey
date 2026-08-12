import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ApiError } from '../src/api';
import { useSession } from '../src/session';
import { colors, styles } from '../src/theme';

export default function SignInScreen() {
  const { t, signIn, completeMfa, signUp, user, loading } = useSession();
  const router = useRouter();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Set once the password was accepted and a second factor is still owed. */
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');

  useEffect(() => {
    if (!loading && user) router.replace('/home');
  }, [loading, user, router]);

  function describe(caught: unknown): string {
    const map: Record<string, string> = {
      weak_password: 'auth.weakPassword',
      email_taken: 'auth.emailTaken',
      unauthorized: 'auth.invalid',
    };
    return caught instanceof ApiError ? t(map[caught.code] ?? 'common.error') : t('common.error');
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signUp') {
        await signUp(email.trim(), password, displayName.trim());
      } else {
        const outcome = await signIn(email.trim(), password);
        if (outcome.status === 'mfa-required') {
          setChallenge(outcome.challenge);
          setPassword('');
        }
      }
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode() {
    if (!challenge) return;
    setBusy(true);
    setError(null);
    try {
      await completeMfa(challenge, code.trim());
    } catch (caught) {
      // A wrong code is not the end of the attempt — the server allows five.
      // Only a challenge that can no longer succeed sends them back to the
      // password.
      const dead = caught instanceof ApiError && caught.code === 'totp_challenge_expired';
      if (dead) {
        setError(t('auth.totpChallengeExpired'));
        setChallenge(null);
        setCode('');
      } else if (caught instanceof ApiError && caught.code === 'totp_invalid_code') {
        setError(t('auth.totpWrongCode'));
        setCode('');
      } else {
        setError(describe(caught));
      }
    } finally {
      setBusy(false);
    }
  }

  if (challenge) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: 70 }]}
      >
        <Text style={styles.wordmark}>{t('app.name').toUpperCase()}</Text>
        <Text style={styles.h1}>{t('auth.totpTitle')}</Text>
        <Text style={styles.lede}>{t('auth.totpPrompt')}</Text>

        <View style={[styles.card, { marginTop: 24 }]}>
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          <Text style={styles.label}>{t('auth.totpCode')}</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            // Not a numeric keyboard: recovery codes contain letters, and the
            // number pad would make them impossible to enter.
            textContentType="oneTimeCode"
            autoFocus
            placeholderTextColor={colors.textFaint}
          />
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={() => void submitCode()}
            disabled={busy}
          >
            <Text style={[styles.buttonText, styles.buttonTextPrimary]}>
              {busy ? t('common.loading') : t('auth.signIn')}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.muted, { marginTop: 12, textAlign: 'center' }]}>
          {t('auth.totpRecoveryHint')}
        </Text>

        <TouchableOpacity
          onPress={() => {
            setChallenge(null);
            setCode('');
            setError(null);
          }}
        >
          <Text style={[styles.muted, { textAlign: 'center', marginTop: 16 }]}>
            {t('common.back')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: 70 }]}>
      <Text style={styles.wordmark}>{t('app.name').toUpperCase()}</Text>
      <Text style={styles.h1}>{t('app.tagline')}</Text>
      <Text style={styles.lede}>{t('app.subtitle')}</Text>

      <View style={[styles.card, { marginTop: 24 }]}>
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {mode === 'signUp' ? (
          <View>
            <Text style={styles.label}>{t('auth.displayName')}</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholderTextColor={colors.textFaint}
            />
          </View>
        ) : null}

        <View>
          <Text style={styles.label}>{t('auth.email')}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholderTextColor={colors.textFaint}
          />
        </View>

        <View>
          <Text style={styles.label}>{t('auth.password')}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
            placeholderTextColor={colors.textFaint}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary]}
          onPress={() => void submit()}
          disabled={busy}
        >
          <Text style={[styles.buttonText, styles.buttonTextPrimary]}>
            {busy ? t('common.loading') : t(mode === 'signIn' ? 'auth.signIn' : 'auth.signUp')}
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={() => {
          setMode(mode === 'signIn' ? 'signUp' : 'signIn');
          setError(null);
        }}
      >
        <Text style={[styles.muted, { textAlign: 'center', marginTop: 12 }]}>
          {t(mode === 'signIn' ? 'auth.noAccount' : 'auth.haveAccount')}{' '}
          {t(mode === 'signIn' ? 'auth.signUp' : 'auth.signIn')}
        </Text>
      </TouchableOpacity>

      <Text style={[styles.muted, { marginTop: 30, textAlign: 'center' }]}>
        {t('safety.disclaimer')}
      </Text>
    </ScrollView>
  );
}
