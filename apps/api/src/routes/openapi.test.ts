import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { closePool } from '../db/pool.js';

/**
 * The public API contract, checked against the API.
 *
 * The document is deliberately narrow — it covers the three unauthenticated
 * endpoints an integrator may build against, not the authenticated surface that
 * moves with the product. That scope is a decision and it is fine. What was not
 * fine is that nothing checked the document against the server, so the two were
 * free to drift the moment either changed. A contract nobody verifies is
 * marketing.
 *
 * These tests run the documented requests against a real app and check the
 * responses satisfy the documented schemas. They are intentionally strict about
 * required fields: an integrator writing against `bypassCoach` needs it to be
 * there every time, because the one time it is missing is the time somebody
 * gets a coaching reply instead of an ambulance.
 */

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

let app: FastifyInstance;

interface Schema {
  type?: string;
  required?: string[];
  properties?: Record<string, Schema>;
  items?: Schema;
  enum?: unknown[];
  $ref?: string;
}

interface Document {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, Schema> };
}

let document: Document;

/** Resolve `$ref` against the document's own component schemas. */
function resolve(schema: Schema): Schema {
  if (!schema.$ref) return schema;
  const name = schema.$ref.replace('#/components/schemas/', '');
  const target = document.components.schemas[name];
  expect(target, `unresolvable $ref: ${schema.$ref}`).toBeDefined();
  return resolve(target!);
}

/**
 * Check a value against a schema, collecting every mismatch.
 *
 * A hand-rolled subset rather than a validator dependency: the document uses a
 * small, fixed slice of JSON Schema, and a supply-chain addition to the API for
 * the sake of a test is a poor trade in a codebase whose threat model includes
 * exactly that.
 */
function violations(value: unknown, schema: Schema, path = '$'): string[] {
  const resolved = resolve(schema);
  const found: string[] = [];

  if (resolved.type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return [`${path}: expected an object, got ${JSON.stringify(value)}`];
    }
    const record = value as Record<string, unknown>;
    for (const key of resolved.required ?? []) {
      if (!(key in record)) found.push(`${path}.${key}: required by the contract but missing`);
    }
    for (const [key, child] of Object.entries(resolved.properties ?? {})) {
      if (key in record) found.push(...violations(record[key], child, `${path}.${key}`));
    }
    return found;
  }

  if (resolved.type === 'array') {
    if (!Array.isArray(value)) return [`${path}: expected an array`];
    if (resolved.items) {
      value.forEach((item, index) =>
        found.push(...violations(item, resolved.items!, `${path}[${index}]`)),
      );
    }
    return found;
  }

  const actual = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
  if (resolved.type === 'integer') {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      found.push(`${path}: expected an integer, got ${actual}`);
    }
  } else if (resolved.type === 'number' && actual !== 'number') {
    found.push(`${path}: expected a number, got ${actual}`);
  } else if (resolved.type === 'string' && actual !== 'string') {
    found.push(`${path}: expected a string, got ${actual}`);
  } else if (resolved.type === 'boolean' && actual !== 'boolean') {
    found.push(`${path}: expected a boolean, got ${actual}`);
  }

  if (resolved.enum && !resolved.enum.includes(value)) {
    found.push(`${path}: ${JSON.stringify(value)} is not one of ${JSON.stringify(resolved.enum)}`);
  }
  return found;
}

/** The response schema the document promises for a given operation. */
function responseSchema(path: string, method: string, status: string): Schema {
  const operation = document.paths[path]?.[method] as
    | { responses?: Record<string, { content?: Record<string, { schema?: Schema }> }> }
    | undefined;
  const schema = operation?.responses?.[status]?.content?.['application/json']?.schema;
  expect(schema, `no ${status} schema documented for ${method.toUpperCase()} ${path}`).toBeDefined();
  return schema!;
}

suite('the public API matches its OpenAPI document', () => {
  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    const response = await app.inject({ method: 'GET', url: '/v1/public/openapi.json' });
    expect(response.statusCode, 'the document must be served').toBe(200);
    document = JSON.parse(response.body) as Document;
  });

  afterAll(async () => {
    await app?.close();
    await closePool();
  });

  it('is a document, with the version and title it claims', () => {
    expect(document.openapi).toMatch(/^3\./);
    expect(document.info.title).toBeTruthy();
    expect(document.info.version).toBeTruthy();
  });

  it('documents only endpoints that exist', async () => {
    // The other direction — undocumented endpoints — is deliberate here: the
    // authenticated surface is not a contract. But a documented path that 404s
    // sends an integrator building against nothing.
    for (const [path, operations] of Object.entries(document.paths)) {
      for (const method of Object.keys(operations)) {
        const response = await app.inject({
          method: method.toUpperCase() as 'GET',
          url: path,
          ...(method === 'post' ? { payload: {} } : {}),
        });
        expect(response.statusCode, `${method.toUpperCase()} ${path} is documented`).not.toBe(404);
      }
    }
  });

  it('GET /v1/public/meta returns what it promises', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/public/meta' });
    expect(response.statusCode).toBe(200);
    expect(
      violations(JSON.parse(response.body), responseSchema('/v1/public/meta', 'get', '200')),
    ).toEqual([]);
  });

  it('GET /v1/public/safety/resources returns what it promises', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/public/safety/resources?country=SE',
    });
    expect(response.statusCode).toBe(200);
    expect(
      violations(
        JSON.parse(response.body),
        responseSchema('/v1/public/safety/resources', 'get', '200'),
      ),
    ).toEqual([]);
  });

  it('POST /v1/public/safety/triage returns what it promises', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/public/safety/triage',
      payload: { text: 'jag har inte sovit på tre dygn' },
    });
    expect(response.statusCode).toBe(200);
    expect(
      violations(
        JSON.parse(response.body),
        responseSchema('/v1/public/safety/triage', 'post', '200'),
      ),
    ).toEqual([]);
  });

  it('keeps the promise that matters most, on an emergency', async () => {
    // The document tells integrators to honour `bypassCoach`, and says an
    // integration that ignores it is worse than none. That instruction is only
    // meaningful if the field is actually there and actually true when it
    // should be.
    const response = await app.inject({
      method: 'POST',
      url: '/v1/public/safety/triage',
      payload: { text: 'jag vill inte leva längre' },
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { bypassCoach: boolean; level: string };
    expect(body.bypassCoach).toBe(true);
    expect(body.level).toBe('emergency');
    expect(
      violations(body, responseSchema('/v1/public/safety/triage', 'post', '200')),
    ).toEqual([]);
  });

  it('returns the documented error shape when validation fails', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/public/safety/triage',
      payload: {},
    });
    expect(response.statusCode).toBe(400);
    expect(
      violations(
        JSON.parse(response.body),
        responseSchema('/v1/public/safety/triage', 'post', '400'),
      ),
    ).toEqual([]);
  });

  it('has no unresolvable $ref anywhere in it', () => {
    const walk = (node: unknown, path: string): void => {
      if (Array.isArray(node)) {
        node.forEach((item, i) => walk(item, `${path}[${i}]`));
        return;
      }
      if (typeof node !== 'object' || node === null) return;
      const record = node as Record<string, unknown>;
      if (typeof record.$ref === 'string') {
        const name = record.$ref.replace('#/components/schemas/', '');
        expect(document.components.schemas[name], `${path}: dangling $ref ${record.$ref}`).toBeDefined();
      }
      for (const [key, child] of Object.entries(record)) walk(child, `${path}.${key}`);
    };
    walk(document, '$');
  });
});
