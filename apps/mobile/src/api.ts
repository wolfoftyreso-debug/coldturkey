import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string; tenant?: string };
const BASE = extra.apiUrl ?? 'http://localhost:8080';
const TENANT = extra.tenant ?? 'public';

const ACCESS_KEY = 'ct_access';
const REFRESH_KEY = 'ct_refresh';

/**
 * Tokens live in the platform keystore, not in AsyncStorage.
 *
 * A session token for this app is a key to someone's addiction history; on a
 * shared or stolen phone that difference matters.
 */
export const tokenStore = {
  async get(): Promise<{ access: string | null; refresh: string | null }> {
    const [access, refresh] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY),
      SecureStore.getItemAsync(REFRESH_KEY),
    ]);
    return { access, refresh };
  },
  async set(access: string, refresh: string): Promise<void> {
    await SecureStore.setItemAsync(ACCESS_KEY, access);
    await SecureStore.setItemAsync(REFRESH_KEY, refresh);
  },
  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const { access } = await tokenStore.get();
  const headers: Record<string, string> = { 'x-tenant': TENANT };
  if (init.body) headers['content-type'] = 'application/json';
  if (access) headers.authorization = `Bearer ${access}`;

  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
  });

  if (response.status === 401 && retry) {
    if (await tryRefresh()) return request<T>(path, init, false);
  }

  const text = await response.text();
  const body: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const shape = (body as { error?: { code: string; message: string } } | null)?.error;
    throw new ApiError(
      response.status,
      shape?.code ?? 'unknown',
      shape?.message ?? `Request failed (${response.status})`,
    );
  }
  return body as T;
}

async function tryRefresh(): Promise<boolean> {
  const { refresh } = await tokenStore.get();
  if (!refresh) return false;
  try {
    const response = await fetch(`${BASE}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant': TENANT },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!response.ok) {
      await tokenStore.clear();
      return false;
    }
    const body = (await response.json()) as { accessToken: string; refreshToken: string };
    await tokenStore.set(body.accessToken, body.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export const api = {
  get: <T,>(path: string) => request<T>(path),
  post: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T,>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T,>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
};

export interface User {
  id: string;
  email: string;
  displayName: string;
  locale: 'sv' | 'en';
  country: string;
  timezone: string;
}

export interface Dashboard {
  user: User;
  profile: { whyStatement: string | null; phase: string };
  quit: { substance: string; currency: string } | null;
  phase: { key: string; label: string; reason: string; focus: { key: string; label: string }[] };
  streak: {
    currentDays: number;
    longestDays: number;
    totalDaysInRecovery: number;
    isPersonalRecord: boolean;
  } | null;
  reclaimed: {
    currency: string;
    soFar: { moneyMinor: number; minutes: number };
    projectedYear1: { moneyMinor: number };
  } | null;
  milestones: {
    next: { text: string } | null;
    progressToNext: number;
  } | null;
  indicators: { key: string; value: number | null; label: string; higherIsBetter: boolean }[];
  insights: { id: string; text: string; evidence: number }[];
  mantra: string;
  supportContacts: { id: string; name: string; phone: string | null; isPrimary: boolean }[];
  detoxWarning: { required: boolean; messageKey: string } | null;
}

export interface CravingPlan {
  leaveFirst: boolean;
  callFirst: { name: string; phone: string | null } | null;
  delayMinutes: number;
  tools: { id: string; label: string }[];
  protocol: string[];
  urgeSurfing: string[];
  whyStatement: string | null;
  followUp: string;
}

export interface CoachResponse {
  reply: string;
  safety: {
    level: string;
    bypassedCoach: boolean;
    resources: { key: string; contact: string; label: string }[];
  };
  negotiation: { detected: boolean; types: string[] };
  source: 'local' | 'model';
}
