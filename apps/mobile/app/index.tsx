import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ApiError } from '../src/api';
import { useSession } from '../src/session';
import { colors, styles } from '../src/theme';

export default function SignInScreen() {
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

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signIn') await signIn(email.trim(), password);
      else await signUp(email.trim(), password, displayName.trim());
    } catch (caught) {
      const map: Record<string, string> = {
        weak_password: 'auth.weakPassword',
        email_taken: 'auth.emailTaken',
        unauthorized: 'auth.invalid',
      };
      setError(
        caught instanceof ApiError ? t(map[caught.code] ?? 'common.error') : t('common.error'),
      );
    } finally {
      setBusy(false);
    }
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
          onPress={submit}
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
