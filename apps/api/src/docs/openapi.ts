/**
 * Builds the OpenAPI 3.0 document served at `/openapi.json` (and rendered by
 * Swagger UI at `/docs`). Request bodies are derived from the same zod
 * schemas `middlewares/validate.ts` enforces at runtime — one source of
 * truth, so the spec can't silently drift from what the API actually
 * accepts. Response shapes and the physiological/business-rule bounds
 * enforced in the service layer (not zod) are documented by hand.
 */
import { z } from 'zod';
import type { ZodType } from 'zod';

import { loginBodySchema } from '../schemas/auth.schemas.ts';
import { createDietPlanBodySchema, updateDietPlanBodySchema } from '../schemas/diet-plan.schemas.ts';
import { createMealLogBodySchema, updateMealLogBodySchema } from '../schemas/meal-log.schemas.ts';
import { registerBodySchema } from '../schemas/users.schemas.ts';
import {
    createWeightEntryBodySchema,
    updateWeightEntryBodySchema,
} from '../schemas/weight-entry.schemas.ts';

function schema(zodSchema: ZodType): object {
    // Zod 4's own converter, not the third-party zod-to-json-schema package:
    // that package's parser reads Zod 3-shaped internals and silently
    // returns `{}` for a native Zod 4 schema like the ones in schemas/*.ts.
    return z.toJSONSchema(zodSchema, { target: 'openapi-3.0' });
}

const bearerAuth = [{ bearerAuth: [] }];

const errorResponse = {
    description: 'An error response shared by every endpoint.',
    content: {
        'application/json': {
            schema: {
                type: 'object',
                properties: {
                    error: { type: 'string', example: 'BadRequestError' },
                    message: { type: 'string' },
                    statusCode: { type: 'integer' },
                    issues: {
                        type: 'array',
                        description: 'Present only on a 400 from the zod validation layer.',
                        items: {
                            type: 'object',
                            properties: { path: { type: 'string' }, message: { type: 'string' } },
                        },
                    },
                },
            },
        },
    },
};

function jsonBody(zodSchema: ZodType): object {
    return { required: true, content: { 'application/json': { schema: schema(zodSchema) } } };
}

function jsonResponse(description: string, example: object): object {
    return { description, content: { 'application/json': { schema: { type: 'object', example } } } };
}

const idParam = {
    name: 'id',
    in: 'path',
    required: true,
    schema: { type: 'string', format: 'uuid' },
};

export function buildOpenApiDocument(): object {
    return {
        openapi: '3.0.3',
        info: {
            title: 'nutrilens API',
            version: '0.1.0',
            description:
                'Authentication, diet plans, meal logs, and weight tracking. Food-photo analysis is ' +
                'delegated to apps/ai-server over an internal-only network path (see ' +
                'organizational/adr/0001-two-server-split.md) and is not part of this spec.',
        },
        servers: [{ url: '/', description: 'This server' }],
        components: {
            securitySchemes: {
                bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
            },
        },
        tags: [
            { name: 'health' },
            { name: 'auth' },
            { name: 'users' },
            { name: 'diet-plans' },
            { name: 'meal-logs' },
            { name: 'weight-entries' },
        ],
        paths: {
            '/health': {
                get: {
                    tags: ['health'],
                    summary: 'Liveness check.',
                    responses: {
                        200: jsonResponse('The server is up.', { status: 'ok' }),
                    },
                },
            },
            '/auth/login': {
                post: {
                    tags: ['auth'],
                    summary: 'Exchange an email/password for a session JWT.',
                    description: 'Rate-limited. Always returns the same message on a bad email or password.',
                    requestBody: jsonBody(loginBodySchema),
                    responses: {
                        200: jsonResponse('Authenticated.', {
                            token: 'eyJhbGciOi...',
                            user: { id: 'uuid', email: 'alice@nutrilens.dev', displayName: 'Alice', role: 'user' },
                        }),
                        401: errorResponse,
                        429: errorResponse,
                    },
                },
            },
            '/users': {
                post: {
                    tags: ['users'],
                    summary: 'Register a new account.',
                    description: 'Password must be at least 8 characters. Email must be unique.',
                    requestBody: jsonBody(registerBodySchema),
                    responses: {
                        201: jsonResponse('Account created.', {
                            id: 'uuid',
                            email: 'alice@nutrilens.dev',
                            displayName: 'Alice',
                            role: 'user',
                        }),
                        400: errorResponse,
                        409: errorResponse,
                    },
                },
                get: {
                    tags: ['users'],
                    summary: 'List every account. Admin-only.',
                    security: bearerAuth,
                    responses: {
                        200: jsonResponse('Every account, oldest first.', [
                            { id: 'uuid', email: 'admin@nutrilens.dev', displayName: 'Ada Admin', role: 'admin' },
                        ]),
                        401: errorResponse,
                        403: errorResponse,
                    },
                },
            },
            '/users/me': {
                get: {
                    tags: ['users'],
                    summary: "Get the authenticated user's own profile.",
                    security: bearerAuth,
                    responses: {
                        200: jsonResponse('The caller\'s account.', {
                            id: 'uuid',
                            email: 'alice@nutrilens.dev',
                            displayName: 'Alice',
                            role: 'user',
                        }),
                        401: errorResponse,
                    },
                },
            },
            '/diet-plans': {
                post: {
                    tags: ['diet-plans'],
                    summary: 'Create a diet plan; archives whatever plan is currently active.',
                    security: bearerAuth,
                    requestBody: jsonBody(createDietPlanBodySchema),
                    responses: {
                        201: jsonResponse('The new active plan.', {
                            id: 'uuid',
                            dailyCalorieTarget: 2200,
                            goal: 'maintain',
                            endsAt: null,
                        }),
                        400: errorResponse,
                        401: errorResponse,
                    },
                },
                get: {
                    tags: ['diet-plans'],
                    summary: "List the caller's plans, most recent first.",
                    security: bearerAuth,
                    responses: {
                        200: jsonResponse('Every plan the caller has ever had.', []),
                        401: errorResponse,
                    },
                },
            },
            '/diet-plans/active': {
                get: {
                    tags: ['diet-plans'],
                    summary: "The caller's currently active plan.",
                    security: bearerAuth,
                    responses: {
                        200: jsonResponse('The active plan.', { id: 'uuid', endsAt: null }),
                        401: errorResponse,
                        404: errorResponse,
                    },
                },
            },
            '/diet-plans/{id}': {
                patch: {
                    tags: ['diet-plans'],
                    summary: 'Update a plan. Owner-only.',
                    security: bearerAuth,
                    parameters: [idParam],
                    requestBody: jsonBody(updateDietPlanBodySchema),
                    responses: {
                        200: jsonResponse('The updated plan.', { id: 'uuid', dailyCalorieTarget: 2000 }),
                        400: errorResponse,
                        401: errorResponse,
                        403: errorResponse,
                        404: errorResponse,
                    },
                },
            },
            '/diet-plans/{id}/archive': {
                post: {
                    tags: ['diet-plans'],
                    summary: 'Archive a plan explicitly (sets endsAt). Owner-only.',
                    security: bearerAuth,
                    parameters: [idParam],
                    responses: {
                        200: jsonResponse('The archived plan.', { id: 'uuid', endsAt: '2026-01-01T00:00:00Z' }),
                        401: errorResponse,
                        403: errorResponse,
                        404: errorResponse,
                    },
                },
            },
            '/meal-logs': {
                post: {
                    tags: ['meal-logs'],
                    summary: 'Log a meal. Requires an active diet plan.',
                    description:
                        'Totals (calories, protein, carbs, fat) are always derived server-side from `items` ' +
                        '— any client-supplied total is ignored.',
                    security: bearerAuth,
                    requestBody: jsonBody(createMealLogBodySchema),
                    responses: {
                        201: jsonResponse('The new log, with server-derived totals.', {
                            id: 'uuid',
                            source: 'manual_search',
                            totalCalories: 260,
                            items: [],
                        }),
                        400: errorResponse,
                        401: errorResponse,
                        409: errorResponse,
                    },
                },
                get: {
                    tags: ['meal-logs'],
                    summary: "List the caller's meal logs.",
                    security: bearerAuth,
                    responses: {
                        200: jsonResponse('Every log the caller owns.', []),
                        401: errorResponse,
                    },
                },
            },
            '/meal-logs/{id}': {
                get: {
                    tags: ['meal-logs'],
                    summary: 'Get one meal log. Owner-only.',
                    security: bearerAuth,
                    parameters: [idParam],
                    responses: {
                        200: jsonResponse('The log.', { id: 'uuid', items: [] }),
                        401: errorResponse,
                        403: errorResponse,
                        404: errorResponse,
                    },
                },
                patch: {
                    tags: ['meal-logs'],
                    summary: 'Replace a log\'s items (and recompute totals) or its other fields. Owner-only.',
                    security: bearerAuth,
                    parameters: [idParam],
                    requestBody: jsonBody(updateMealLogBodySchema),
                    responses: {
                        200: jsonResponse('The updated log.', { id: 'uuid', totalCalories: 105 }),
                        400: errorResponse,
                        401: errorResponse,
                        403: errorResponse,
                        404: errorResponse,
                    },
                },
                delete: {
                    tags: ['meal-logs'],
                    summary: 'Delete a log. Owner-only.',
                    security: bearerAuth,
                    parameters: [idParam],
                    responses: {
                        204: { description: 'Deleted.' },
                        401: errorResponse,
                        403: errorResponse,
                        404: errorResponse,
                    },
                },
            },
            '/weight-entries': {
                post: {
                    tags: ['weight-entries'],
                    summary: 'Record a weight entry (one per day, UTC).',
                    description: 'A second entry on the same day conflicts (409) unless `overwrite: true`.',
                    security: bearerAuth,
                    requestBody: jsonBody(createWeightEntryBodySchema),
                    responses: {
                        201: jsonResponse('The entry.', { id: 'uuid', weightKg: 81 }),
                        400: errorResponse,
                        401: errorResponse,
                        409: errorResponse,
                    },
                },
                get: {
                    tags: ['weight-entries'],
                    summary: "List the caller's entries, optionally filtered by date range.",
                    security: bearerAuth,
                    parameters: [
                        { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
                        { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
                    ],
                    responses: {
                        200: jsonResponse('Matching entries.', []),
                        401: errorResponse,
                    },
                },
            },
            '/weight-entries/{id}': {
                get: {
                    tags: ['weight-entries'],
                    summary: 'Get one weight entry. Owner-only.',
                    security: bearerAuth,
                    parameters: [idParam],
                    responses: {
                        200: jsonResponse('The entry.', { id: 'uuid', weightKg: 81 }),
                        401: errorResponse,
                        403: errorResponse,
                        404: errorResponse,
                    },
                },
                patch: {
                    tags: ['weight-entries'],
                    summary: 'Update a weight entry. Owner-only.',
                    security: bearerAuth,
                    parameters: [idParam],
                    requestBody: jsonBody(updateWeightEntryBodySchema),
                    responses: {
                        200: jsonResponse('The updated entry.', { id: 'uuid', weightKg: 79.5 }),
                        400: errorResponse,
                        401: errorResponse,
                        403: errorResponse,
                        404: errorResponse,
                    },
                },
                delete: {
                    tags: ['weight-entries'],
                    summary: 'Delete a weight entry. Owner-only.',
                    security: bearerAuth,
                    parameters: [idParam],
                    responses: {
                        204: { description: 'Deleted.' },
                        401: errorResponse,
                        403: errorResponse,
                        404: errorResponse,
                    },
                },
            },
        },
    };
}
