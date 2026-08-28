import { loadConfig } from '../config.js';
import type { Mail, Mailer } from './smtp.js';

/**
 * Mail over Resend's HTTPS API.
 *
 * The SMTP client next door is the right transport when somebody runs their
 * own relay, and this product is meant to be self-hostable, so it stays. But
 * the deployment we actually ship is a container, and containers routinely
 * cannot open port 587 at all: managed platforms block outbound SMTP by
 * default to stop themselves becoming spam sources, and a corporate egress
 * policy blocks it for the same reason. A password reset that silently fails
 * to leave the network is exactly the failure this product cannot have.
 *
 * So there are two transports, chosen by which credential is configured, and
 * both speak the same tiny `Mailer` interface. Nothing above this layer knows
 * which one is in use.
 *
 * Deliberately not used: Resend's React/HTML rendering, open tracking and
 * click tracking. A tracking pixel in a mail about somebody's drinking tells a
 * third party when that person opened it, and a wrapped link tells them the
 * person clicked. Plain text, no tracking, is the only version of this that is
 * honest about what we said we collect.
 */

const SEND_TIMEOUT_MS = 15_000;

export class ResendError extends Error {
  constructor(
    readonly status: number,
    /** Resend's machine-readable name, when it sent one. */
    readonly code: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'ResendError';
  }
}

export class ResendMailer implements Mailer {
  readonly kind = 'resend';

  constructor(
    private readonly options: {
      apiKey: string;
      from: string;
      /** Overridable so the suite can exercise real request shaping. */
      base: string;
    },
  ) {}

  async send(mail: Mail): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${this.options.base.replace(/\/+$/, '')}/emails`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          'content-type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          from: `Cleat <${this.options.from}>`,
          to: [mail.to],
          subject: mail.subject,
          text: mail.text,
          // Same header the SMTP path sets, and for the same reason: these are
          // transactional, and a mail client that files them as bulk is a
          // person who never gets their account back.
          headers: { 'Auto-Submitted': 'auto-generated' },
        }),
      });
    } catch (error) {
      // An abort and a DNS failure are the same thing to the caller: the mail
      // did not go. The cause is included, but never the message body — the
      // body contains a working key to somebody's account.
      const reason = error instanceof Error ? error.message : String(error);
      throw new ResendError(0, 'network_error', `Resend request failed: ${reason}`);
    } finally {
      clearTimeout(timer);
    }

    if (response.ok) return;

    // Resend answers errors as JSON, but a proxy in front of it may not, so
    // parsing has to be allowed to fail without masking the status code.
    let code: string | undefined;
    let detail = '';
    try {
      const body = (await response.json()) as { name?: unknown; message?: unknown };
      if (typeof body.name === 'string') code = body.name;
      if (typeof body.message === 'string') detail = body.message;
    } catch {
      /* keep the status */
    }

    throw new ResendError(
      response.status,
      code,
      `Resend refused the message (${response.status}${code ? ` ${code}` : ''})${
        detail ? `: ${detail}` : ''
      }`,
    );
  }
}

export function resendMailerFromConfig(): ResendMailer | null {
  const config = loadConfig();
  if (!config.RESEND_API_KEY) return null;
  return new ResendMailer({
    apiKey: config.RESEND_API_KEY,
    from: config.MAIL_FROM,
    base: config.RESEND_API_BASE,
  });
}
