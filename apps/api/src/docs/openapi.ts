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
import { registerBodySchema, updateUserRoleStatusBodySchema } from '../schemas/users.schemas.ts';
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

const linksRef = { $ref: '#/components/schemas/Links' };

/** Same as {@link jsonResponse}, for a body that carries a HATEOAS `_links` map (lib/hateoas.ts). */
function jsonResponseWithLinks(description: string, example: object): object {
    return {
        description,
        content: {
            'application/json': {
                schema: { type: 'object', properties: { _links: linksRef }, example: { ...example, _links: {} } },
            },
        },
    };
}

/** The `{ _links, count, items }` envelope every list endpoint returns (lib/hateoas.ts's `listPayload`). */
function listResponse(description: string, itemsExample: unknown[]): object {
    return jsonResponseWithLinks(description, { count: itemsExample.length, items: itemsExample });
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
                'organizational/adr/0001-two-server-split.md) and is not part of this spec. Richardson ' +
                'level 3: start at `GET /api` and follow `_links` rather than hard-coding routes — see ' +
                'the `Link`/`Links` schemas. `OPTIONS` on any real path answers with a genuine `Allow` ' +
                'header (Express\'s own per-route methods), and 404s for a path that does not exist; ' +
                '`HEAD` falls through to the matching `GET`.',
        },
        servers: [{ url: '/', description: 'This server' }],
        components: {
            securitySchemes: {
                bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
            },
            schemas: {
                // Richardson level 3 (lib/hateoas.ts). `href` is a URI
                // template (RFC 6570) rather than a concrete URL when
                // `templated: true` — e.g. `/food-catalog/search{?q,limit}`.
                Link: {
                    type: 'object',
                    required: ['href'],
                    properties: {
                        href: { type: 'string' },
                        method: { type: 'string', description: 'HTTP method for a non-GET affordance. Omitted means GET.' },
                        templated: { type: 'boolean', description: 'href is a URI template, not a concrete link.' },
                    },
                },
                Links: {
                    type: 'object',
                    description: 'A map of relation name to Link, e.g. `{ self, update, delete, collection }`.',
                    additionalProperties: { $ref: '#/components/schemas/Link' },
                },
            },
        },
        tags: [
            { name: 'discovery' },
            { name: 'health' },
            { name: 'auth' },
            { name: 'users' },
            { name: 'diet-plans' },
            { name: 'meal-logs' },
            { name: 'weight-entries' },
            { name: 'food-catalog' },
            { name: 'stores' },
            { name: 'admin' },
        ],
        paths: {
            '/api': {
                get: {
                    tags: ['discovery'],
                    summary: 'HATEOAS discovery root (Richardson level 3).',
                    description:
                        'The one fixed entry point for this API — every other route is reachable by ' +
                        'following a link from here rather than by hard-coding it. Not namespaced under ' +
                        '`/api/*` like the rest of the API (see lib/api-path-segments.ts); this single ' +
                        'path is the deliberate exception. `docs`/`openapi` links are present only when ' +
                        "`NODE_ENV !== 'production'`, mirroring docsRouter's own mount gate; `/metrics` " +
                        'is never advertised here.',
                    responses: {
                        200: jsonResponseWithLinks('Every top-level resource, reachable by relation name.', {}),
                    },
                },
            },
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
                        // No GET /users/:id route exists, so no Location — only the
                        // affordance that actually resolves next (`login`).
                        201: jsonResponseWithLinks('Account created. No Location header — see `_links.login`.', {
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
                    summary: 'Search/filter/paginate every account. Admin-only.',
                    security: bearerAuth,
                    parameters: [
                        { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Matches email or display name.' },
                        { name: 'role', in: 'query', schema: { type: 'string', enum: ['user', 'coach', 'admin'] } },
                        { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'suspended', 'deleted'] } },
                        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
                        { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
                    ],
                    responses: {
                        200: jsonResponseWithLinks(
                            'A page of matching accounts, newest first. `_links.next`/`prev` are present only when another page exists.',
                            {
                                users: [
                                    {
                                        id: 'uuid',
                                        email: 'admin@nutrilens.dev',
                                        displayName: 'Ada Admin',
                                        role: 'admin',
                                        _links: { update: { href: '/users/uuid', method: 'PATCH' } },
                                    },
                                ],
                                total: 1,
                                page: 1,
                                pageSize: 20,
                            },
                        ),
                        400: errorResponse,
                        401: errorResponse,
                        403: errorResponse,
                    },
                },
            },
            '/users/{id}': {
                patch: {
                    tags: ['users'],
                    summary: "Change a user's role and/or status. Admin-only.",
                    description:
                        'Refused with 409 if it would leave zero active admins, or 403 if an admin tries to ' +
                        'suspend their own account — see organizational/access-control.md.',
                    security: bearerAuth,
                    parameters: [idParam],
                    requestBody: jsonBody(updateUserRoleStatusBodySchema),
                    responses: {
                        200: jsonResponseWithLinks('The updated account.', {
                            id: 'uuid',
                            email: 'alice@nutrilens.dev',
                            displayName: 'Alice',
                            role: 'coach',
                            status: 'active',
                        }),
                        400: errorResponse,
                        401: errorResponse,
                        403: errorResponse,
                        404: errorResponse,
                        409: errorResponse,
                    },
                },
            },
            '/users/{id}/avatar': {
                get: {
                    tags: ['users'],
                    summary: "A user's avatar image. Deliberately unauthenticated — see issue #227.",
                    description:
                        'No `requireAuth`, by design: (1) a plain `<img src>` cannot send a Bearer ' +
                        "token, so gating this route would break the avatar's normal rendering " +
                        'everywhere it is used, including in `<img>` tags belonging to other users; ' +
                        "(2) for GitHub/Google-linked accounts this route is not even in the picture — " +
                        "`avatarUrl` on the user resource points straight at GitHub's/Google's own " +
                        'avatar CDN, which was already public before this app existed; (3) the `id` ' +
                        'is a v4 UUID (`gen_random_uuid()`, ~122 bits), so the set of valid ids is not ' +
                        'enumerable — this endpoint leaks at most "does this id have an avatar", never ' +
                        'a browsable directory. For a self-uploaded avatar, or a Microsoft-linked one ' +
                        '(downloaded server-side because Microsoft\'s OIDC claims carry no picture URL), ' +
                        'this route serves the actual image bytes from our own storage — the one case ' +
                        'where this app, not an external provider, is the source of the exposure. Both ' +
                        'are normalized through the same `sharp` resize/re-encode pipeline before ' +
                        'storage (`lib/normalize-avatar.ts`), which drops EXIF/GPS metadata as a side ' +
                        "effect of re-encoding. DSGVO assessment: an avatar photo is personal data " +
                        '(Art 4(1)); the unauthenticated GET is treated as an accepted, documented ' +
                        'design decision rather than a defect, given the non-enumerable id, the global ' +
                        'rate limiter ahead of this router, and that ids are never surfaced to any ' +
                        'party other than the account owner and admins. Revisit if avatars, or the ids ' +
                        'behind them, ever become discoverable through another feature (a public ' +
                        'profile, a share link, a leaderboard) — none exist today.',
                    parameters: [idParam],
                    responses: {
                        200: {
                            description: 'The avatar image (WebP), 256x256, normalized.',
                            content: { 'image/webp': { schema: { type: 'string', format: 'binary' } } },
                        },
                        404: { description: 'No such account, or the account has no avatar set.' },
                    },
                },
            },
            '/users/me': {
                get: {
                    tags: ['users'],
                    summary: "Get the authenticated user's own profile.",
                    security: bearerAuth,
                    responses: {
                        200: jsonResponseWithLinks(
                            "The caller's account. `_links`: self, update, delete, avatar, export.",
                            { id: 'uuid', email: 'alice@nutrilens.dev', displayName: 'Alice', role: 'user' },
                        ),
                        401: errorResponse,
                    },
                },
                delete: {
                    tags: ['users'],
                    summary: "Delete the authenticated user's account (GDPR Art. 17).",
                    description:
                        'Irreversible. Password confirmation required if the account has a password. ' +
                        'OAuth-only accounts do not require re-authentication. All related data (diet plans, ' +
                        'meal logs, weight entries, OAuth provider links) is deleted; audit log entries are ' +
                        'anonymised (actor/target references set to NULL) to preserve audit history.',
                    security: bearerAuth,
                    requestBody: {
                        required: false,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: { password: { type: 'string', description: 'Required if the account has a password.' } },
                                },
                            },
                        },
                    },
                    responses: {
                        204: { description: 'Account deleted.' },
                        400: errorResponse,
                        401: errorResponse,
                    },
                },
            },
            '/users/me/export': {
                get: {
                    tags: ['users'],
                    summary: "Export the authenticated user's data (GDPR Art. 20).",
                    description:
                        'Returns a JSON snapshot of the user\'s profile (without password hash), linked ' +
                        'OAuth providers, diet plans, meal logs with their items, and weight entries. ' +
                        'Suitable for download as a portable data format.',
                    security: bearerAuth,
                    responses: {
                        200: jsonResponse(
                            'The user\'s complete data export.',
                            {
                                user: {
                                    id: 'uuid',
                                    email: 'alice@nutrilens.dev',
                                    displayName: 'Alice',
                                    role: 'user',
                                },
                                oauthProviders: [{ provider: 'github', providerUserId: '12345' }],
                                dietPlans: [
                                    {
                                        id: 'uuid',
                                        dailyCalorieTarget: 2200,
                                        goal: 'maintain',
                                        startsAt: '2026-01-01T00:00:00Z',
                                        endsAt: null,
                                    },
                                ],
                                mealLogs: [
                                    {
                                        id: 'uuid',
                                        dietPlanId: 'uuid',
                                        source: 'manual_search',
                                        totalCalories: 260,
                                        items: [{ id: 'uuid', foodName: 'Apple', calories: 95 }],
                                    },
                                ],
                                weightEntries: [
                                    {
                                        id: 'uuid',
                                        weightKg: 75.5,
                                        recordedAt: '2026-01-01T12:00:00Z',
                                    },
                                ],
                            },
                        ),
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
                        // No GET /diet-plans/:id route exists — only `_links.update`/`archive` —
                        // so this 201, unlike meal-logs/weight-entries, sets no Location.
                        201: jsonResponseWithLinks(
                            'The new active plan. No Location header — see `_links`.',
                            { id: 'uuid', dailyCalorieTarget: 2200, goal: 'maintain', endsAt: null },
                        ),
                        400: errorResponse,
                        401: errorResponse,
                    },
                },
                get: {
                    tags: ['diet-plans'],
                    summary: "List the caller's plans, most recent first.",
                    security: bearerAuth,
                    responses: {
                        200: listResponse('Every plan the caller has ever had.', []),
                        401: errorResponse,
                    },
                },
            },
            '/diet-plans/active': {
                get: {
                    tags: ['diet-plans'],
                    summary: "The caller's currently active plan.",
                    description: 'The one diet-plan response that does carry `_links.self` — every other plan shape omits it (no per-id GET route exists).',
                    security: bearerAuth,
                    responses: {
                        200: jsonResponseWithLinks('The active plan.', { id: 'uuid', endsAt: null }),
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
                        200: jsonResponseWithLinks('The updated plan.', { id: 'uuid', dailyCalorieTarget: 2000 }),
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
                        200: jsonResponseWithLinks('The archived plan.', { id: 'uuid', endsAt: '2026-01-01T00:00:00Z' }),
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
                        201: {
                            ...jsonResponseWithLinks('The new log, with server-derived totals.', {
                                id: 'uuid',
                                source: 'manual_search',
                                totalCalories: 260,
                                items: [],
                            }),
                            headers: { Location: { schema: { type: 'string' }, description: 'GET /meal-logs/{id} for this log.' } },
                        },
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
                        200: listResponse('Every log the caller owns.', []),
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
                        200: jsonResponseWithLinks('The log.', { id: 'uuid', items: [] }),
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
                        200: jsonResponseWithLinks('The updated log.', { id: 'uuid', totalCalories: 105 }),
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
                        201: {
                            ...jsonResponseWithLinks('The entry.', { id: 'uuid', weightKg: 81 }),
                            headers: { Location: { schema: { type: 'string' }, description: 'GET /weight-entries/{id} for this entry.' } },
                        },
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
                        200: listResponse('Matching entries.', []),
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
                        200: jsonResponseWithLinks('The entry.', { id: 'uuid', weightKg: 81 }),
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
                        200: jsonResponseWithLinks('The updated entry.', { id: 'uuid', weightKg: 79.5 }),
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
            '/admin/stats': {
                get: {
                    tags: ['admin'],
                    summary: 'Platform-wide aggregate stats. Admin-only.',
                    security: bearerAuth,
                    responses: {
                        200: jsonResponseWithLinks('Aggregate counts.', {
                            usersByRole: { user: 40, coach: 2, admin: 1 },
                            usersByStatus: { active: 41, suspended: 2, deleted: 0 },
                            activeDietPlans: 30,
                            mealLogsLast7Days: 210,
                            mealLogsLast30Days: 900,
                            signupsLast30Days: [{ date: '2026-08-01', count: 3 }],
                        }),
                        401: errorResponse,
                        403: errorResponse,
                    },
                },
            },
            '/food-catalog/barcode': {
                get: {
                    tags: ['food-catalog'],
                    summary: 'Look up a single food by its EAN/UPC barcode.',
                    description: 'A miss is a 404 — previously a 200 with a JSON `null` body, which was indistinguishable from "the field really is null" to a status-code-only client.',
                    security: bearerAuth,
                    parameters: [
                        { name: 'code', in: 'query', required: true, schema: { type: 'string' }, description: 'EAN-13 or UPC-A digits.' },
                    ],
                    responses: {
                        200: jsonResponseWithLinks('The matching food.', {
                            fdcId: 999101,
                            description: 'Baked Beans, canned',
                            eanCode: '5011234567890',
                        }),
                        400: errorResponse,
                        401: errorResponse,
                        404: errorResponse,
                    },
                },
            },
            '/food-catalog/search': {
                get: {
                    tags: ['food-catalog'],
                    summary: 'Search the USDA food catalog. Ranked by relevance.',
                    description: 'Matches on the English description + category and on localized names (e.g. "Semmel"); falls back to trigram matching on typos and inflected forms. All languages are searched at once — there is no locale parameter.',
                    security: bearerAuth,
                    parameters: [
                        { name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 2, maxLength: 100 }, description: 'Search query.' },
                        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 25, default: 10 }, description: 'Max results (default 10).' },
                    ],
                    responses: {
                        200: listResponse('Foods matching the query, most relevant first. Per-100 g nutrition. `matchedName` is the localized alias that matched, or null when the hit was on the English description.', [
                            {
                                fdcId: 168192,
                                description: 'Chicken breast, boneless, skinless, cooked, braised',
                                category: 'Poultry Products',
                                caloriesKcal: 165,
                                proteinGrams: 31.3,
                                carbGrams: 0,
                                fatGrams: 3.6,
                                matchedName: null,
                                createdAt: '2026-08-15T00:00:00Z',
                                updatedAt: '2026-08-15T00:00:00Z',
                            },
                        ]),
                        400: errorResponse,
                        401: errorResponse,
                    },
                },
            },
            '/discounters/countries': {
                get: {
                    tags: ['stores'],
                    summary: 'Every country that has discounters, ISO 3166-1 alpha-2.',
                    description: 'Derived from the `discounters` table, never a fixed list — importing another country\'s stores extends this response with no code change.',
                    security: bearerAuth,
                    responses: {
                        200: listResponse('The country codes present.', ['AT']),
                        401: errorResponse,
                    },
                },
            },
            '/discounters': {
                get: {
                    tags: ['stores'],
                    summary: 'Supermarket chains, with how many stores each has.',
                    description: 'An unknown `country` is a 200 with an empty list, not a 404 — a country simply has no discounters yet. `attribution` is present whenever any counted store came from OpenStreetMap (ODbL 1.0) and must be displayed wherever the data is. Each discounter carries its own `_links.stores`.',
                    security: bearerAuth,
                    parameters: [
                        { name: 'country', in: 'query', schema: { type: 'string', minLength: 2, maxLength: 2 }, description: 'ISO 3166-1 alpha-2, case-insensitive. Omitted means every country.' },
                    ],
                    responses: {
                        200: jsonResponseWithLinks('Discounters, alphabetical by name. `storeCount` counts active stores only.', {
                            discounters: [
                                {
                                    id: 'uuid',
                                    code: 'billa',
                                    name: 'Billa',
                                    countryCode: 'AT',
                                    websiteUrl: null,
                                    storeCount: 1067,
                                    _links: { stores: { href: '/discounters/billa/stores' } },
                                },
                            ],
                            attribution: '© OpenStreetMap contributors',
                        }),
                        400: errorResponse,
                        401: errorResponse,
                    },
                },
            },
            '/discounters/{code}/stores': {
                get: {
                    tags: ['stores'],
                    summary: 'One page of a discounter\'s stores.',
                    description: 'Active stores only. `phone`, `source` and `externalStoreId` are deliberately never returned. `attribution` is present only when the page contains OpenStreetMap rows. `_links.discounter` points back to the `/discounters` list — no single-discounter GET route exists.',
                    security: bearerAuth,
                    parameters: [
                        { name: 'code', in: 'path', required: true, schema: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', maxLength: 100 }, description: "A discounter's stable code, e.g. `billa` or `nah-frisch`." },
                        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 25, default: 25 } },
                        { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
                    ],
                    responses: {
                        200: jsonResponseWithLinks('That page of stores, ordered by city then name.', {
                            stores: [
                                { id: 'uuid', discounterId: 'uuid', name: 'Billa Mariahilfer Straße', address: 'Mariahilfer Str. 1', city: 'Wien', postalCode: '1060', latitude: 48.1985, longitude: 16.3521 },
                            ],
                            limit: 25,
                            offset: 0,
                            attribution: '© OpenStreetMap contributors',
                        }),
                        400: errorResponse,
                        401: errorResponse,
                        404: errorResponse,
                    },
                },
            },
            '/stores/near': {
                get: {
                    tags: ['stores'],
                    summary: 'Nearest stores to a point, any discounter.',
                    description: 'Nearest first. Backed by the PostGIS GiST index on `location`; the radius cap is what keeps it an index scan.',
                    security: bearerAuth,
                    parameters: [
                        { name: 'lat', in: 'query', required: true, schema: { type: 'number', minimum: -90, maximum: 90 }, description: 'Decimal degrees, WGS84.' },
                        { name: 'lon', in: 'query', required: true, schema: { type: 'number', minimum: -180, maximum: 180 }, description: 'Decimal degrees, WGS84.' },
                        { name: 'radius_m', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50000, default: 5000 }, description: 'Search radius in metres.' },
                        { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 } },
                    ],
                    responses: {
                        200: jsonResponseWithLinks('Active stores within the radius, nearest first. `distanceM` is the geodesic distance in metres.', {
                            stores: [
                                { id: 'uuid', discounterId: 'uuid', name: 'Billa Stephansplatz', address: 'Stephansplatz 1', city: 'Wien', postalCode: '1010', latitude: 48.2082, longitude: 16.3738, distanceM: 120 },
                            ],
                            attribution: '© OpenStreetMap contributors',
                        }),
                        400: errorResponse,
                        401: errorResponse,
                    },
                },
            },
            '/admin/audit-log': {
                get: {
                    tags: ['admin'],
                    summary: 'Every role/status change any admin has made, newest first. Admin-only.',
                    security: bearerAuth,
                    parameters: [
                        { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
                        { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
                    ],
                    responses: {
                        200: jsonResponseWithLinks('A page of audit entries. `_links.next`/`prev` are present only when another page exists.', {
                            entries: [
                                {
                                    id: 'uuid',
                                    actorId: 'uuid',
                                    targetUserId: 'uuid',
                                    action: 'role_change',
                                    previousValue: 'user',
                                    newValue: 'coach',
                                    createdAt: '2026-08-10T00:00:00Z',
                                },
                            ],
                            total: 1,
                            page: 1,
                            pageSize: 20,
                        }),
                        400: errorResponse,
                        401: errorResponse,
                        403: errorResponse,
                    },
                },
            },
        },
    };
}
