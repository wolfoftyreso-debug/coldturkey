import { createHmac, timingSafeEqual } from 'node:crypto';
import { loadConfig } from '../config.js';

/**
 * A very small Stripe client.
 *
 * Three calls and one signature check is the entire surface this product
 * needs, and the SDK is a large dependency to carry for that. It also puts the
 * security-critical part — verifying that a webhook really came from Stripe —
 * inside our own code where it can be tested directly, rather than trusting a
 * library call nobody on the team has read. The same reasoning already applies
 * to the hand-written SMTP client next door.
 *
 * `STRIPE_API_BASE` exists so the suite can point this at a local stub and
 * exercise the real request shaping, rather than mocking the module and
 * proving only that the mock works.
 */

export class StripeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'StripeError';
  }
}

export function stripeEnabled(): boolean {
  return Boolean(loadConfig().STRIPE_SECRET_KEY);
}

/**
 * Stripe's API takes form-encoded bodies, including for nested objects, which
 * it addresses with bracket paths: `line_items[0][price]`.
 */
function encode(form: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(form)) {
    if (value !== undefined) params.append(key, String(value));
  }
  return params.toString();
}

async function call<T>(path: string, form: Record<string, string | number | undefined>): Promise<T> {
  const config = loadConfig();
  if (!config.STRIPE_SECRET_KEY) throw new StripeError('Stripe is not configured', 500);

  const response = await fetch(`${config.STRIPE_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.STRIPE_SECRET_KEY}`,
      'content-type': 'application/x-www-form-urlencoded',
      // Stripe pins behaviour to a version; leaving it unset means a future
      // API release can change response shapes underneath a running deploy.
      'stripe-version': '2025-10-29.clover',
    },
    body: encode(form),
  });

  const text = await response.text();
  if (!response.ok) {
    // Deliberately not the raw Stripe payload: it can echo customer email and
    // card metadata into our logs.
    throw new StripeError(`Stripe ${path} failed with ${response.status}`, response.status);
  }
  return JSON.parse(text) as T;
}

export interface CheckoutSession {
  id: string;
  url: string;
}

/**
 * A subscription checkout for an organisation.
 *
 * The tenant id travels in `client_reference_id` and in subscription metadata,
 * because the webhook has to be able to answer "which tenant is this?" from
 * Stripe's payload alone — matching on email would attach a subscription to
 * the wrong clinic the first time two of them share a billing address.
 */
export function createCheckoutSession(input: {
  tenantId: string;
  tenantSlug: string;
  seats: number;
  customerId?: string | null;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey?: string;
}): Promise<CheckoutSession> {
  const config = loadConfig();
  return call<CheckoutSession>('/v1/checkout/sessions', {
    mode: 'subscription',
    'line_items[0][price]': config.STRIPE_PRICE_CLINIC_SEAT,
    'line_items[0][quantity]': input.seats,
    client_reference_id: input.tenantId,
    customer: input.customerId ?? undefined,
    customer_email: input.customerId ? undefined : input.customerEmail,
    'subscription_data[metadata][tenant_id]': input.tenantId,
    'subscription_data[metadata][tenant_slug]': input.tenantSlug,
    'metadata[tenant_id]': input.tenantId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  });
}

export interface PortalSession {
  id: string;
  url: string;
}

/** The Stripe-hosted place where a clinic changes card, seats or cancels. */
export function createPortalSession(input: {
  customerId: string;
  returnUrl: string;
}): Promise<PortalSession> {
  return call<PortalSession>('/v1/billing_portal/sessions', {
    customer: input.customerId,
    return_url: input.returnUrl,
  });
}

/** Seconds a signed payload stays acceptable. Stripe's own default. */
const TOLERANCE_SECONDS = 300;

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

/**
 * Verify that a webhook body really came from Stripe, and parse it.
 *
 * Everything commercial in this product is decided by these events, so an
 * endpoint that trusts an unsigned body is an endpoint where anyone on the
 * internet can grant themselves a paid plan by posting JSON. Three properties
 * matter and each is tested:
 *
 *  - the HMAC is computed over `timestamp.rawBody`, so the raw bytes must
 *    survive body parsing (see the content-type parser in app.ts),
 *  - the comparison is constant-time, so a signature cannot be discovered a
 *    byte at a time,
 *  - a timestamp outside the tolerance is refused, so a captured request
 *    cannot be replayed tomorrow.
 */
export function verifyWebhook(rawBody: string, signatureHeader: string, secret: string, now = new Date()): StripeEvent {
  const parts = new Map<string, string[]>();
  for (const piece of signatureHeader.split(',')) {
    const [key, value] = piece.split('=', 2);
    if (!key || !value) continue;
    const list = parts.get(key.trim()) ?? [];
    list.push(value.trim());
    parts.set(key.trim(), list);
  }

  const timestamp = parts.get('t')?.[0];
  const signatures = parts.get('v1') ?? [];
  if (!timestamp || signatures.length === 0) {
    throw new StripeError('Malformed Stripe signature header', 400);
  }

  const age = Math.abs(Math.floor(now.getTime() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) {
    throw new StripeError('Stripe signature timestamp outside tolerance', 400);
  }

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  // Stripe may send several signatures during a secret rotation; any one match
  // is enough. Lengths are equalised through the hex decode, because
  // timingSafeEqual throws on a length mismatch and that throw is itself a
  // signal about the secret.
  const matched = signatures.some((candidate) => {
    const candidateBuffer = Buffer.from(candidate, 'hex');
    return (
      candidateBuffer.length === expectedBuffer.length &&
      timingSafeEqual(candidateBuffer, expectedBuffer)
    );
  });
  if (!matched) throw new StripeError('Stripe signature did not verify', 400);

  return JSON.parse(rawBody) as StripeEvent;
}
