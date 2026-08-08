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
