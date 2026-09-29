// HATEOAS helpers — Richardson Maturity Model level 3. Every resource
// response carries a `_links` map so clients can discover related
// resources/actions instead of hard-coding URL templates.
//
// Unlike network-visualizer's hateoas.ts, there is no `stripLinks` here.
// That one exists because topology nodes/edges are untyped Mixed
// sub-documents an incoming write persists as-is — without stripping, a
// client round-tripping a fetched node into a PUT would write `_links` into
// MongoDB permanently. Nothing in this API is schemaless: every
// body-accepting JSON route runs `validateBody(z.object(...))`, and zod's
// parsed output replaces `req.body` wholesale, silently dropping any key
// (including `_links`) the schema doesn't declare — a redundant strip step
// here would just repeat what zod already guarantees. The two multipart
// uploads (`POST /users/me/avatar`, `POST /meal-logs/photo-prediction`) never
// run `validateBody` at all, but they're safe by a different mechanism: their
// handlers read only `req.file`, never `req.body`, so there's nothing
// unvalidated for a client to smuggle in through either route.

import type { Request } from 'express';

export interface Link {
    href: string;
    /** HTTP method for non-GET affordances (omitted => GET). */
    method?: string;
    /** href is a URI template (e.g. `/food-catalog/search{?q,limit}`), not a concrete link. */
    templated?: boolean;
}
export type Links = Record<string, Link>;

/** Attach a `_links` map to a resource representation. */
export function withLinks<T extends object>(resource: T, links: Links): T & { _links: Links } {
    return { ...resource, _links: links };
}

/**
 * @param req - The inbound request; `req.originalUrl` (path + query string)
 *   becomes the list's own `self` link, so a filtered call
 *   (`?from=...&to=...`) reports the URL that actually produced it.
 * @param items - The page of resources being returned.
 * @param itemLinks - Builds one item's `_links`. Omitted for collections
 *   whose items carry no discoverable affordances of their own (e.g. a
 *   plain list of ISO country codes).
 * @returns The `{ _links, count, items }` envelope shared by every list
 *   endpoint in this API.
 */
export function listPayload<T>(
    req: Request,
    items: T[],
    itemLinks?: (item: T) => Links,
): { _links: Links; count: number; items: (T & { _links: Links })[] | T[] } {
    // Not `withLinks` here — that helper's `T extends object` constraint
    // would reject a plain list of primitives (e.g. findCountries()'s
    // `string[]`), which never passes `itemLinks` anyway. The spread is
    // exactly what `withLinks` does; it's inlined so `listPayload` itself
    // can stay generic over T without that constraint.
    return {
        _links: { self: { href: req.originalUrl } },
        count: items.length,
        items: itemLinks ? items.map((item) => ({ ...item, _links: itemLinks(item) })) : items,
    };
}

/**
 * @param total - Total matching rows, independent of the current page.
 * @param page - The current 1-based page number.
 * @param pageSize - Rows per page.
 * @param basePath - The route's own path, e.g. `/users` or `/admin/audit-log`.
 * @param extraQuery - Any non-pagination query params to preserve (e.g. `country`).
 * @returns `self`, plus `next`/`prev` only when another page actually exists.
 */
export function paginationLinks(
    total: number,
    page: number,
    pageSize: number,
    basePath: string,
    extraQuery: Record<string, string | undefined> = {},
): Links {
    const query = (p: number): string => {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(extraQuery)) {
            if (value !== undefined) params.set(key, value);
        }
        params.set('page', String(p));
        params.set('pageSize', String(pageSize));
        return `${basePath}?${params.toString()}`;
    };

    const links: Links = { self: { href: query(page) } };
    if (page * pageSize < total) links.next = { href: query(page + 1) };
    if (page > 1) links.prev = { href: query(page - 1) };
    return links;
}

// ── Discovery root ───────────────────────────────────────────────────────────
/**
 * @param includeDocs - Whether to advertise the interactive-docs affordances
 *   (mirrors docsRouter's own `!isProduction` mount gate in app.ts) —
 *   `GET /metrics` is never advertised here regardless of environment: it's
 *   an operator-facing endpoint, not a client-facing one.
 */
export function apiRootLinks(includeDocs: boolean): Links {
    const links: Links = {
        self: { href: '/api' },
        login: { href: '/auth/login', method: 'POST' },
        register: { href: '/users', method: 'POST' },
        providers: { href: '/auth/providers' },
        me: { href: '/users/me' },
        dietPlans: { href: '/diet-plans' },
        activeDietPlan: { href: '/diet-plans/active' },
        mealLogs: { href: '/meal-logs' },
        weightEntries: { href: '/weight-entries' },
        foodSearch: { href: '/food-catalog/search{?q,limit}', templated: true },
        barcode: { href: '/food-catalog/barcode{?code}', templated: true },
        discounters: { href: '/discounters' },
        storesNear: { href: '/stores/near{?lat,lon,radius_m,limit}', templated: true },
        version: { href: '/version' },
        health: { href: '/health' },
    };
    if (includeDocs) {
        links.docs = { href: '/docs' };
        links.openapi = { href: '/openapi.json' };
    }
    return links;
}

// ── Diet plans ────────────────────────────────────────────────────────────────
// No GET /diet-plans/:id route exists — only PATCH and the archive action —
// so a plan never carries `self` except the one plan that does have its own
// GET route: /diet-plans/active.
export function dietPlanLinks(id: string): Links {
    return {
        update: { href: `/diet-plans/${id}`, method: 'PATCH' },
        archive: { href: `/diet-plans/${id}/archive`, method: 'POST' },
        collection: { href: '/diet-plans' },
    };
}

export function activeDietPlanLinks(id: string): Links {
    return { self: { href: '/diet-plans/active' }, ...dietPlanLinks(id) };
}

// ── Meal logs ─────────────────────────────────────────────────────────────────
export function mealLogLinks(id: string): Links {
    return {
        self: { href: `/meal-logs/${id}` },
        update: { href: `/meal-logs/${id}`, method: 'PATCH' },
        delete: { href: `/meal-logs/${id}`, method: 'DELETE' },
        collection: { href: '/meal-logs' },
    };
}

/** `POST /meal-logs/photo-prediction`'s response — a prediction, not a persisted log. */
export function photoPredictionLinks(): Links {
    return { mealLogs: { href: '/meal-logs' } };
}

// ── Weight entries ────────────────────────────────────────────────────────────
export function weightEntryLinks(id: string): Links {
    return {
        self: { href: `/weight-entries/${id}` },
        update: { href: `/weight-entries/${id}`, method: 'PATCH' },
        delete: { href: `/weight-entries/${id}`, method: 'DELETE' },
        collection: { href: '/weight-entries' },
    };
}

// ── Users / auth ──────────────────────────────────────────────────────────────
export function userMeLinks(): Links {
    return {
        self: { href: '/users/me' },
        update: { href: '/users/me', method: 'PATCH' },
        delete: { href: '/users/me', method: 'DELETE' },
        avatar: { href: '/users/me/avatar', method: 'POST' },
        export: { href: '/users/me/export' },
    };
}

/** `POST /users` (registration) — no per-user GET route, so no `self`. */
export function registerLinks(): Links {
    return { login: { href: '/auth/login', method: 'POST' } };
}

export function authLoginLinks(): Links {
    return { me: { href: '/users/me' }, root: { href: '/api' } };
}

export function authProvidersLinks(): Links {
    return { self: { href: '/auth/providers' } };
}

export function versionLinks(): Links {
    return { self: { href: '/version' } };
}

/**
 * @param id - The target user's id.
 * @param hasAvatar - Whether that user currently has an avatar set — the
 *   link is omitted rather than pointing at a route that would 404.
 */
export function adminUserListItemLinks(id: string, hasAvatar: boolean): Links {
    const links: Links = { update: { href: `/users/${id}`, method: 'PATCH' } };
    if (hasAvatar) links.avatar = { href: `/users/${id}/avatar` };
    return links;
}

export function adminStatsLinks(): Links {
    return { self: { href: '/admin/stats' } };
}

// ── Food catalog / store discovery ───────────────────────────────────────────
export function foodCatalogBarcodeLinks(code: string): Links {
    return { self: { href: `/food-catalog/barcode?code=${encodeURIComponent(code)}` } };
}

/** `GET /discounters`'s per-discounter affordance — its own stores page. */
export function discounterLinks(code: string): Links {
    return { stores: { href: `/discounters/${code}/stores` } };
}

export function discounterStoresLinks(code: string): Links {
    return {
        self: { href: `/discounters/${code}/stores` },
        // No GET /discounters/:code route exists — only its stores page —
        // so this points back to the collection the discounter itself is
        // listed in, same convention as diet-plans' item-less `collection`.
        discounter: { href: '/discounters' },
    };
}

export function storesNearLinks(): Links {
    return { self: { href: '/stores/near' } };
}
