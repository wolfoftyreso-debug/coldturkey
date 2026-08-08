/**
 * Application errors carry an HTTP status and a stable machine-readable code.
 *
 * Clients switch on `code`, never on the message — messages are for humans and
 * get rewritten; codes are an API contract.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (code: string, message: string, details?: unknown) =>
  new AppError(400, code, message, details);

export const unauthorized = (message = 'Authentication required') =>
  new AppError(401, 'unauthorized', message);

export const forbidden = (message = 'Not allowed') => new AppError(403, 'forbidden', message);

export const notFound = (what = 'Resource') => new AppError(404, 'not_found', `${what} not found`);

export const conflict = (code: string, message: string) => new AppError(409, code, message);

/**
 * Deliberately carries the same message as a failed login. Saying "too many
 * attempts on this account" confirms the account exists, which is the one
 * thing an attacker wanted to learn.
 */
export const tooManyRequests = (message = 'Too many requests') =>
  new AppError(429, 'rate_limited', message);

export const serverError = (message = 'Internal error') =>
  new AppError(500, 'internal_error', message);
