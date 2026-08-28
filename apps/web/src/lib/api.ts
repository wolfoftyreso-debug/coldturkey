import { API_BASE } from './apiBase';

const BASE = API_BASE;
const TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT ?? 'public';

const ACCESS_KEY = 'cleat.access';
const REFRESH_KEY = 'cleat.refresh';

export interface ApiErrorShape {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, body: ApiErrorShape) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
  }
}

export const tokens = {
  access: () => (typeof window === 'undefined' ? null : localStorage.getItem(ACCESS_KEY)),
  refresh: () => (typeof window === 'undefined' ? null : localStorage.getItem(REFRESH_KEY)),
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

async function parse(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * A single request, with one automatic refresh attempt on a 401.
 *
 * The retry is deliberately capped at one: an expired access token should be
 * invisible to the user, but a genuinely revoked session must land on the login
 * screen rather than spinning.
 */
async function request<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const access = tokens.access();
  const headers = new Headers(init.headers);
  headers.set('x-tenant', TENANT);
  if (init.body) headers.set('content-type', 'application/json');
  if (access) headers.set('authorization', `Bearer ${access}`);

  const response = await fetch(`${BASE}${path}`, { ...init, headers });

  if (response.status === 401 && retry && tokens.refresh()) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, init, false);
  }

  const body = await parse(response);
  if (!response.ok) {
    const shape = (body as { error?: ApiErrorShape } | null)?.error ?? {
      code: 'unknown',
      message: `Request failed with ${response.status}`,
    };
    throw new ApiError(response.status, shape);
  }
  return body as T;
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = tokens.refresh();
  if (!refreshToken) return false;
  try {
    const response = await fetch(`${BASE}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant': TENANT },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      tokens.clear();
      return false;
    }
    const body = (await response.json()) as { accessToken: string; refreshToken: string };
    tokens.set(body.accessToken, body.refreshToken);
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
  del: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined }),
};

// ------------------------------------------------------------------ types ---

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: string;
  locale: 'sv' | 'en';
  country: string;
  timezone: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

/**
 * What `/v1/auth/login` returns when the password was right but a second factor
 * is switched on. No tokens are issued: the challenge is short-lived, single
 * use, and worth nothing on its own.
 */
export interface MfaChallenge {
  mfaRequired: true;
  challenge: string;
}

/**
 * What the server holds about this account, counted rather than described.
 *
 * The sharing flags come from the server on purpose: a client that hard-codes
 * "we never sell your data" goes on saying so in a deployment that does.
 */
export interface PrivacySummary {
  principles: string;
  whatWeStore: { category: string; count: number }[];
  sharing: {
    soldToThirdParties: boolean;
    usedForAdvertising: boolean;
    sharedWithInsurers: boolean;
    sharedWithEmployers: boolean;
  };
}

export interface TotpStatus {
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodesRemaining: number;
}

/** Returned once, at the start of enrolment, and never again. */
export interface TotpSetup {
  secret: string;
  uri: string;
}

/** Returned once, when enrolment completes. Losing these loses the account. */
export interface TotpEnabled {
  enabled: boolean;
  recoveryCodes: string[];
}

export interface Indicator {
  key: string;
  value: number | null;
  trend: 'up' | 'down' | 'flat' | 'unknown';
  sample: number;
  higherIsBetter: boolean;
  confidence: 'none' | 'low' | 'medium' | 'high';
  label: string;
  description: string;
}

export interface Dashboard {
  user: User;
  profile: {
    whyStatement: string | null;
    futureSelf: Record<string, string> | null;
    phase: string;
    country: string;
  };
  quit: {
    id: string;
    substance: string;
    startedAt: string;
    baselineUnitsPerDay: number;
    unitCostMinor: number;
    currency: string;
    minutesPerUnit: number;
  } | null;
  phase: {
    key: string;
    label: string;
    reason: string;
    horizon: string;
    focus: { key: string; label: string }[];
  };
  streak: {
    currentDays: number;
    currentHours: number;
    longestDays: number;
    previousBestDays: number;
    totalDaysInRecovery: number;
    restarts: number;
    isPersonalRecord: boolean;
    nextDayMilestone: number | null;
  } | null;
  reclaimed: {
    currency: string;
    today: { moneyMinor: number; minutes: number; units: number };
    thisWeek: { moneyMinor: number; minutes: number; units: number };
    soFar: { moneyMinor: number; minutes: number; units: number };
    projectedYear1: { moneyMinor: number; minutes: number; units: number };
  } | null;
  milestones: {
    reached: { key: string; text: string; source?: string }[];
    /** `source` is present on physiological claims — see MilestoneSource in core. */
    next: { key: string; text: string; hoursRemaining: number; source?: string } | null;
    progressToNext: number;
  } | null;
  indicators: Indicator[];
  insights: { id: string; text: string; evidence: number; suggestedToolId: string | null }[];
  mantra: string;
  supportContacts: { id: string; name: string; relation: string; phone: string | null; isPrimary: boolean }[];
  detoxWarning: { required: boolean; risk: string; messageKey: string } | null;
}

export interface CravingPlan {
  leaveFirst: boolean;
  callFirst: { id: string; name: string; phone: string | null } | null;
  delayMinutes: number;
  tools: { id: string; category: string; minutes: number; label: string }[];
  protocol: string[];
  urgeSurfing: string[];
  whyStatement: string | null;
  followUp: string;
}

export interface CoachResponse {
  reply: string;
  mode: string;
  safety: {
    level: 'none' | 'elevated' | 'urgent' | 'emergency';
    categories: string[];
    bypassedCoach: boolean;
    resources: { key: string; contact: string; kind: string; label: string }[];
  };
  negotiation: { detected: boolean; types: string[] };
  source: 'local' | 'model';
}
