import { createHmac } from 'node:crypto';
import { expect, type Page } from '@playwright/test';

/** A fresh address per test, so no test depends on another's account. */
export function newEmail(prefix: string): string {
  return `e2e-${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}@cleat.test`;
}

export const PASSWORD = 'a-long-enough-password';

/**
 * Fail the test on any console error or unhandled rejection.
 *
 * This is the assertion that would have caught F11 on its own: the login page
 * rendered perfectly and the console was full of "Refused to connect ...
 * violates the Content Security Policy". A screenshot looked fine.
 */
export function failOnConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

export function expectNoConsoleErrors(errors: string[], allow: RegExp[] = []): void {
  const unexpected = errors.filter((text) => !allow.some((pattern) => pattern.test(text)));
  expect(unexpected, `unexpected console errors:\n${unexpected.join('\n')}`).toEqual([]);
}

/** Register a new account and land signed in. */
export async function signUp(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  // The sign-up toggle, in either language.
  await page.getByRole('button', { name: /skapa konto|create account/i }).click();
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(PASSWORD);
  const name = page.locator('#displayName');
  if (await name.count()) await name.fill('E2E');
  await page.getByRole('button', { name: /^(skapa konto|create account)$/i }).click();
  await page.waitForURL('**/home', { timeout: 20_000 });
}

export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: /^(logga in|sign in)$/i }).click();
}

/**
 * RFC 6238, implemented here rather than imported from the API.
 *
 * A test that generated codes with the server's own function would pass even if
 * that function disagreed with every real authenticator — which is the failure
 * that actually locks people out of their accounts.
 */
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input: string): Buffer {
  let bits = '';
  for (const character of input.replace(/=+$/, '').toUpperCase()) {
    const index = BASE32.indexOf(character);
    if (index >= 0) bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function totp(secret: string, at: number = Date.now()): string {
  const counter = Math.floor(at / 1000 / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buffer.writeUInt32BE(counter >>> 0, 4);
  const mac = createHmac('sha1', base32Decode(secret)).update(buffer).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const binary =
    ((mac[offset]! & 0x7f) << 24) |
    (mac[offset + 1]! << 16) |
    (mac[offset + 2]! << 8) |
    mac[offset + 3]!;
  return String(binary % 1_000_000).padStart(6, '0');
}
