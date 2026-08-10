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
  MAIL_FROM: z.string().default('no-reply@cleat.app'),

  /** Where reset and verification links point. Must be the public web origin. */
  PUBLIC_WEB_URL: z.string().default('http://localhost:3000'),

  // Observability. Without a URL, reports go to the log — correct for a
  // deployment that has not decided where to send them, and never silent.
  ERROR_REPORTING_URL: z.string().optional(),
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

  if (value.NODE_ENV === 'production' && !value.SMTP_HOST) {
    throw new Error(
      'Invalid configuration:\n  SMTP_HOST is required in production — ' +
        'without it password reset and email verification silently do nothing.',
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
