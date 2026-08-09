import { createHash } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import { loadConfig } from '../config.js';

/**
 * Error reporting.
 *
 * A crash in production was previously invisible. In a product people open
 * during a crisis that is not an observability gap, it is a safety one: the
 * craving screen failing at 2am for a week, with nobody knowing, is the
 * failure mode this exists to prevent.
 *
 * Reports go to a self-hosted Sentry-compatible endpoint (GlitchTip runs in a
 * single container and speaks the same envelope protocol). No DSN configured
 * means reports go to the log and nowhere else, which is the correct default
 * for a deployment that has not decided where to send them.
 *
 * PRIVACY RULE, and it is why this file exists rather than a dependency: an
 * error reporter is a pipe out of the process, and everything in this process
 * is somebody's recovery record. So:
 *
 *   * no request bodies, ever;
 *   * no query strings, no headers, no cookies;
 *   * the route template, not the resolved URL, so an id never leaves;
 *   * the user is a salted hash, so the same person can be recognised across
 *     two reports without the reporter learning who they are;
 *   * the message is truncated and the stack is trimmed to this codebase.
 *
 * An off-the-shelf SDK does the opposite by default — bodies, headers, and
 * full URLs — and every one of those defaults would be a disclosure here.
 */

export interface ErrorContext {
  route?: string;
  method?: string;
  statusCode?: number;
  userId?: string;
  tenantId?: string;
}

const MAX_MESSAGE = 500;
const MAX_FRAMES = 20;

/**
 * Stable pseudonym for a user across reports.
 *
 * Salted with the JWT secret, which never leaves the deployment, so the hash
 * cannot be reversed by anyone holding only the error store — including us,
 * if the error store is ever hosted elsewhere.
 */
function pseudonym(id: string): string {
  return createHash('sha256').update(`${loadConfig().JWT_SECRET}:${id}`).digest('hex').slice(0, 16);
}

function trimStack(stack: string | undefined): string[] {
  if (!stack) return [];
  return stack
    .split('\n')
    .slice(1, MAX_FRAMES + 1)
    .map((line) => line.trim())
    // Drop node internals and dependency frames: they are noise, and a
    // dependency path can disclose the deployment layout.
    .filter((line) => !line.includes('node:internal') && !line.includes('node_modules'));
}

export interface ErrorReport {
  message: string;
  type: string;
  stack: string[];
  context: Omit<ErrorContext, 'userId' | 'tenantId'> & {
    user?: string;
    tenant?: string;
  };
  timestamp: string;
  release: string;
  environment: string;
}

export function buildReport(error: unknown, context: ErrorContext = {}): ErrorReport {
  const config = loadConfig();
  const err = error instanceof Error ? error : new Error(String(error));

  return {
    message: err.message.slice(0, MAX_MESSAGE),
    type: err.name,
    stack: trimStack(err.stack),
    context: {
      route: context.route,
      method: context.method,
      statusCode: context.statusCode,
      user: context.userId ? pseudonym(context.userId) : undefined,
      tenant: context.tenantId ? pseudonym(context.tenantId) : undefined,
    },
    timestamp: new Date().toISOString(),
    release: config.RELEASE,
    environment: config.NODE_ENV,
  };
}

/**
 * Send a report. Never throws and never blocks the response — a reporting
 * outage must not become an application outage.
 */
export async function reportError(
  error: unknown,
  context: ErrorContext,
  log: FastifyBaseLogger,
): Promise<void> {
  const config = loadConfig();
  const report = buildReport(error, context);

  if (!config.ERROR_REPORTING_URL) {
    log.error({ report }, 'unhandled error');
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    await fetch(config.ERROR_REPORTING_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(report),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (sendFailure) {
    // The log is the fallback, and it is why the report is built the same way
    // regardless of where it goes.
    log.error({ report, err: sendFailure }, 'unhandled error (reporting failed)');
  }
}
