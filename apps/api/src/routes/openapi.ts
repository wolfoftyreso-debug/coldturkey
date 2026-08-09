import type { FastifyInstance } from 'fastify';

/**
 * The OpenAPI document for the public surface.
 *
 * Hand-written rather than generated from the route table, and only covering
 * the endpoints that are actually a contract. A generated document would list
 * every internal route the moment it was added and imply a stability promise
 * nobody made — and the authenticated routes here move with the product.
 *
 * What is documented is what an integrator may depend on: the crisis
 * resources, the triage, and the metadata endpoint. Those three are the
 * surface a partner clinic or another service can build against without ever
 * touching a person's record.
 */
const DOCUMENT = {
  openapi: '3.1.0',
  info: {
    title: 'Cleat public API',
    version: '1.0.0',
    description: [
      'The unauthenticated surface of Cleat.',
      '',
      'Nothing here requires an account and nothing here reads or writes a',
      "person's recovery data. Requests are not stored.",
      '',
      'If you integrate the triage endpoint, honour `bypassCoach`. When it is',
      'true the message describes an emergency, and the correct behaviour is',
      'to stop coaching and show the emergency contacts. An integration that',
      'ignores it is worse than no integration, because it puts a coaching',
      'response in front of somebody who needs an ambulance.',
    ].join('\n'),
    license: { name: 'MIT' },
  },
  servers: [{ url: '/', description: 'This deployment' }],
  paths: {
    '/v1/public/meta': {
      get: {
        summary: 'What this deployment is and speaks',
        operationId: 'getMeta',
        responses: {
          '200': {
            description: 'Deployment metadata',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Meta' },
              },
            },
          },
        },
      },
    },
    '/v1/public/safety/resources': {
      get: {
        summary: 'Emergency and crisis contacts for a country',
        description:
          'Cacheable for an hour. Deliberately reachable with no credentials: ' +
          'somebody in crisis must never have to create an account to find out ' +
          'what to ring.',
        operationId: 'getSafetyResources',
        parameters: [
          {
            name: 'country',
            in: 'query',
            required: false,
            schema: { type: 'string', minLength: 2, maxLength: 2 },
            description: 'ISO 3166-1 alpha-2. Falls back to a generic set.',
          },
          {
            name: 'locale',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['sv', 'en'] },
            description: 'Overrides Accept-Language.',
          },
        ],
        responses: {
          '200': {
            description: 'Contacts, most relevant first',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ResourceList' },
              },
            },
          },
        },
      },
    },
    '/v1/public/safety/triage': {
      post: {
        summary: 'Classify a message for risk',
        description:
          'Deterministic, synchronous, and stores nothing — no message, no ' +
          'result, no address. The same triage the product runs before any ' +
          'language model sees a message.',
        operationId: 'triageMessage',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TriageRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Classification',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TriageResponse' },
              },
            },
          },
          '400': {
            description: 'Validation failed',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Error' } },
            },
          },
          '429': {
            description: 'Rate limited',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Error' } },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Meta: {
        type: 'object',
        required: ['product', 'api', 'locales', 'countries'],
        properties: {
          product: { type: 'string' },
          api: { type: 'string' },
          locales: { type: 'array', items: { type: 'string' } },
          countries: { type: 'array', items: { type: 'string' } },
          docs: { type: 'string' },
        },
      },
      Resource: {
        type: 'object',
        required: ['key', 'contact', 'kind', 'label'],
        properties: {
          key: { type: 'string', description: 'Stable translation key.' },
          contact: {
            type: 'string',
            description: 'Dialable number, or empty for "your local service".',
          },
          kind: {
            type: 'string',
            enum: ['emergency', 'crisis', 'health', 'helpline'],
          },
          label: { type: 'string', description: 'Human-readable, in the requested locale.' },
        },
      },
      ResourceList: {
        type: 'object',
        required: ['disclaimer', 'resources'],
        properties: {
          country: { type: ['string', 'null'] },
          disclaimer: { type: 'string' },
          resources: { type: 'array', items: { $ref: '#/components/schemas/Resource' } },
        },
      },
      TriageRequest: {
        type: 'object',
        required: ['text'],
        properties: {
          text: { type: 'string', minLength: 1, maxLength: 4000 },
          country: { type: 'string', minLength: 2, maxLength: 2 },
          locale: { type: 'string', enum: ['sv', 'en'] },
        },
      },
      TriageResponse: {
        type: 'object',
        required: ['level', 'categories', 'bypassCoach', 'askDirectly', 'message', 'resources', 'stored'],
        properties: {
          level: {
            type: 'string',
            enum: ['none', 'elevated', 'urgent', 'emergency'],
            description: [
              'none — nothing detected.',
              'elevated — worth a handoff sentence; keep coaching.',
              'urgent — needs a professional now; show the crisis line and keep talking.',
              'emergency — stop coaching, show the emergency number.',
            ].join(' '),
          },
          categories: { type: 'array', items: { type: 'string' } },
          bypassCoach: {
            type: 'boolean',
            description:
              'True for an emergency. Honour this: stop coaching and show the contacts.',
          },
          askDirectly: {
            type: 'boolean',
            description:
              'The message carries ambiguous finality — "thanks for everything", ' +
              '"I am done". Not an alarm. Ask a direct question before anything else.',
          },
          message: { type: 'string' },
          resources: { type: 'array', items: { $ref: '#/components/schemas/Resource' } },
          stored: {
            type: 'boolean',
            description: 'Always false. Present so the guarantee is machine-readable.',
          },
        },
      },
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: {},
            },
          },
        },
      },
    },
  },
} as const;

export async function openapiRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/public/openapi.json', async (_request, reply) => {
    void reply.header('cache-control', 'public, max-age=3600');
    return DOCUMENT;
  });
}

export const openapiDocument = DOCUMENT;
