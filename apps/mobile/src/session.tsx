import { useRouter } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { translate, type Locale } from '@cleat/i18n';
import { api, tokenStore, type User } from './api';

interface SessionValue {
  user: User | null;
  loading: boolean;
  locale: Locale;
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Resolves to a challenge when a second factor is still owed. */
  signIn: (email: string, password: string) => Promise<SignInOutcome>;
  /** Answer a challenge with a TOTP or recovery code. */
  completeMfa: (challenge: string, code: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

/**
 * What login returns when the password was right but a second factor is on.
 * No tokens are issued; the challenge is short-lived and single use.
 */
interface MfaChallenge {
  mfaRequired: true;
  challenge: string;
}

export type SignInOutcome = { status: 'signed-in' } | { status: 'mfa-required'; challenge: string };

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const reload = useCallback(async () => {
    const { access } = await tokenStore.get();
    if (!access) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const response = await api.get<{ user: User }>('/v1/me');
      setUser(response.user);
    } catch {
      await tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const establish = useCallback(
    async (response: AuthResponse) => {
      await tokenStore.set(response.accessToken, response.refreshToken);
      setUser(response.user);
      router.replace('/home');
    },
    [router],
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInOutcome> => {
      const response = await api.post<AuthResponse | MfaChallenge>('/v1/auth/login', {
        email,
        password,
      });
      // A correct password is not a session when a second factor is on.
      // Assuming tokens are present here stores `undefined` and leaves the
      // person on a screen that looks signed in and is not.
      if ('mfaRequired' in response) {
        return { status: 'mfa-required', challenge: response.challenge };
      }
      await establish(response);
      return { status: 'signed-in' };
    },
    [establish],
  );

  const completeMfa = useCallback(
    async (challenge: string, code: string) => {
      const response = await api.post<AuthResponse>('/v1/auth/totp/verify', { challenge, code });
      await establish(response);
    },
    [establish],
  );

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      const response = await api.post<AuthResponse>('/v1/auth/register', {
        email,
        password,
        displayName,
      });
      await tokenStore.set(response.accessToken, response.refreshToken);
      setUser(response.user);
      router.replace('/home');
    },
    [router],
  );

  const signOut = useCallback(async () => {
    try {
      await api.post('/v1/auth/logout');
    } catch {
      // Signing out has to work with no network too.
    }
    await tokenStore.clear();
    setUser(null);
    router.replace('/');
  }, [router]);

  const locale: Locale = user?.locale ?? 'sv';

  const value = useMemo<SessionValue>(
    () => ({
      user,
      loading,
      locale,
      t: (key, params) => translate(locale, key, params),
      signIn,
      completeMfa,
      signUp,
      signOut,
      reload,
    }),
    [user, loading, locale, signIn, completeMfa, signUp, signOut, reload],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside SessionProvider');
  return context;
}

export function formatMoney(minor: number, currency: string, locale: Locale): string {
  try {
    return new Intl.NumberFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(minor / 100);
  } catch {
    return `${Math.round(minor / 100)} ${currency}`;
  }
}
