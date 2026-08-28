import { z } from 'zod';

/**
 * Configuration is validated once at boot. A server that starts with a missing
 * JWT secret and only discovers it on the first login is a server that fails in
 * production at the worst possible moment.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  DEFAULT_TENANT_SLUG: z.string().default('public'),
  ALLOW_PUBLIC_SIGNUP: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'),

  ANTHROPIC_API_KEY: z.string().optional(),
  COACH_MODEL: z.string().default('claude-opus-5'),

  CORS_ORIGINS: z.string().default('*'),

  // Per-IP request ceiling. Generous by default because opening the craving
  // screen repeatedly is the product working as intended, and configurable
  // because a shared-NAT deployment and a single-user one need different
  // numbers. Load profiling also needs to be able to raise it — a benchmark
  // that measures the rate limiter is a benchmark that measures nothing.
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),

  // Registration, per IP. Deliberately generous: a tight cap here mostly
  // punishes a household, an office or a school behind one address, and does
  // nothing against an attacker with a botnet. The control that actually
  // bounds fake accounts is email verification; this only stops a trivial
  // script from filling the table in an afternoon.
  SIGNUP_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  SIGNUP_LIMIT_WINDOW: z.string().default('1 hour'),
  // Coach messages, per IP. Each one can reach a language model.
  COACH_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  COACH_LIMIT_WINDOW: z.string().default('1 minute'),

  // Mail. Without SMTP_HOST the API falls back to a mailer that logs a digest
  // instead of sending, so development needs no relay — but see
  // `requireMailInProduction` below: shipping that fallback to production
  // would make password reset silently do nothing.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_REJECT_UNAUTHORIZED: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'),
  // Validated as an address, not just a string. An unparseable MAIL_FROM does
  // not fail at boot on its own — it fails the first time somebody who is
  // locked out of their account asks for a reset, which is the worst place in
  // this product to discover a typo.
  MAIL_FROM: z.string().email('MAIL_FROM must be an email address').default('no-reply@cleat.app'),

  // The other transport. A key here takes precedence over SMTP_HOST, because
  // most container platforms block outbound port 587 outright and a reset mail
  // that never leaves the network is the failure this product cannot have.
  RESEND_API_KEY: z.string().optional(),
  /** Overridable so the suite can exercise real request shaping against a stub. */
  RESEND_API_BASE: z.string().url().default('https://api.resend.com'),

  /**
   * Where reset and verification links point. Must be the public web origin.
   *
   * Validated as a URL for the same reason as MAIL_FROM: a value with the
   * scheme left off ("app.cleat.se") produces links that no mail client will
   * make clickable, and the only person who finds out is someone who cannot
   * sign in.
   */
  PUBLIC_WEB_URL: z
    .string()
    .url('PUBLIC_WEB_URL must be an absolute URL including the scheme')
    .default('http://localhost:3000'),

  // Billing. Absent means the commercial surface is simply off: individuals
  // never pay, so an API with no Stripe keys is a completely valid deployment
  // and every clinical feature still works. Only the organisation checkout
  // stops being offered.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  /** The per-seat recurring price a clinic subscribes to. */
  STRIPE_PRICE_CLINIC_SEAT: z.string().optional(),
  /** Overridable so the suite can exercise real request shaping against a stub. */
  STRIPE_API_BASE: z.string().url().default('https://api.stripe.com'),

  // Field-level encryption for the free text people write. Format:
  // `id:base64key,id2:base64key2`, 32 bytes each. Absent means values are
  // stored in the clear, which is refused in production below.
  FIELD_ENCRYPTION_KEYS: z.string().optional(),
  /** Which key id encrypts new values. Older keys stay loaded so they decrypt. */
  FIELD_ENCRYPTION_ACTIVE_KEY: z.string().optional(),

  // Observability. Without a URL, reports go to the log — correct for a
  // deployment that has not decided where to send them, and never silent.
  ERROR_REPORTING_URL: z.string().url().optional(),
  /** Stamped on every error report so a regression can be tied to a deploy. */
  RELEASE: z.string().default('dev'),
});

export type Config = z.infer<typeof schema> & { corsOrigins: string[] | true };

let cached: Config | null = null;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (cached) return cached;

  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid configuration:\n${problems}`);
  }

  const value = parsed.data;

  // A production deployment without a relay would accept a "reset your
  // password" request, log a digest, and return 200. The person would wait for
  // a mail that was never sent, and nothing would look broken from the
  // outside. Refuse to start instead — a server that will not boot is a bug
  // report; a server that silently swallows account recovery is not.
  // A wildcard origin combined with credentials means any site a signed-in
  // person visits can call this API as them. It is the correct default for
  // local development and never correct in production, so it is refused there
  // rather than warned about.
  if (value.NODE_ENV === 'production' && value.CORS_ORIGINS.trim() === '*') {
    throw new Error(
      'Invalid configuration:\n  CORS_ORIGINS must list explicit origins in production — ' +
        '"*" would let any website call this API with a signed-in user\'s credentials.',
    );
  }

  // Coach transcripts and relapse notes in the clear inside the database mean
  // a leaked backup, a decommissioned disk or an operator's SELECT discloses
  // the most sensitive thing this product holds. Row level security protects
  // none of those.
  if (value.NODE_ENV === 'production' && !value.FIELD_ENCRYPTION_KEYS) {
    throw new Error(
      'Invalid configuration:\n  FIELD_ENCRYPTION_KEYS is required in production — ' +
        'without it recovery notes and coach transcripts are stored in cleartext.',
    );
  }

  if (value.NODE_ENV === 'production' && !value.SMTP_HOST && !value.RESEND_API_KEY) {
    throw new Error(
      'Invalid configuration:\n  SMTP_HOST or RESEND_API_KEY is required in production — ' +
        'without one of them password reset and email verification silently do nothing.',
    );
  }

  cached = {
    ...value,
    corsOrigins:
      value.CORS_ORIGINS === '*'
        ? true
        : value.CORS_ORIGINS.split(',')
            .map((o) => o.trim())
            .filter(Boolean),
  };
  return cached;
}

/** Test helper — lets a suite load a fresh config. */
export function resetConfig(): void {
  cached = null;
}
