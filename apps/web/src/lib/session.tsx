'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { translate, type Locale } from '@coldturkey/i18n';
import { api, tokens, type AuthResponse, type User } from './api';

interface SessionValue {
  user: User | null;
  loading: boolean;
  locale: Locale;
  t: (key: string, params?: Record<string, string | number>) => string;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadUser = useCallback(async () => {
    if (!tokens.access()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const response = await api.get<{ user: User }>('/v1/me');
      setUser(response.user);
    } catch {
      tokens.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    const response = await api.post<AuthResponse>('/v1/auth/login', { email, password });
    tokens.set(response.accessToken, response.refreshToken);
    setUser(response.user);
    router.push('/home');
  }, [router]);

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      const response = await api.post<AuthResponse>('/v1/auth/register', {
        email,
        password,
        displayName,
        // A Swedish-first product: the emergency numbers shown must be the ones
        // that actually answer where the person is.
        locale: navigator.language.startsWith('en') ? 'en' : 'sv',
        country: navigator.language.startsWith('en') ? 'GB' : 'SE',
      });
      tokens.set(response.accessToken, response.refreshToken);
      setUser(response.user);
      router.push('/home');
    },
    [router],
  );

  const signOut = useCallback(async () => {
    try {
      await api.post('/v1/auth/logout');
    } catch {
      // Signing out must always work locally, even if the network does not.
    }
    tokens.clear();
    setUser(null);
    router.push('/login');
  }, [router]);

  const locale: Locale = user?.locale ?? 'sv';

  const value = useMemo<SessionValue>(
    () => ({
      user,
      loading,
      locale,
      t: (key, params) => translate(locale, key, params),
      signIn,
      signUp,
      signOut,
      refreshUser: loadUser,
    }),
    [user, loading, locale, signIn, signUp, signOut, loadUser],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside SessionProvider');
  return context;
}

/** Redirect to the login screen once we know there is no session. */
export function useRequireAuth(): SessionValue {
  const session = useSession();
  const router = useRouter();
  useEffect(() => {
    if (!session.loading && !session.user) router.replace('/login');
  }, [session.loading, session.user, router]);
  return session;
}

export function formatMoney(minor: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

export function formatHours(minutes: number): string {
  return String(Math.round(minutes / 60));
}
