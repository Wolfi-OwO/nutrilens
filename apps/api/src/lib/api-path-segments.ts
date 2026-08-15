// apps/api's routes aren't namespaced under /api/*, so anything that needs
// to tell "a real API path" apart from "a client-side SPA route" — the
// static-frontend SPA fallback, and the rate limiter (see rate-limit.ts) —
// has to know the API's own top-level segments explicitly. Keep this in
// sync with routes/*.routes.ts; if the API ever moves under /api/*, this
// list (and the workarounds that need it) can be dropped for a plain prefix
// check.
//
// `admin` is deliberately absent: apps/frontend owns the /admin/* pages a
// browser navigates to, and adminRouter's own two endpoints
// (/admin/stats, /admin/audit-log) are matched before the SPA fallback ever
// runs. See `RATE_LIMITED_PATH_SEGMENTS` below for why the rate limiter
// can't use the same answer.
const API_PATH_SEGMENTS = new Set([
    'health',
    'version',
    'auth',
    'users',
    'diet-plans',
    'meal-logs',
    'weight-entries',
    'docs',
    'openapi.json',
]);

/**
 * The rate limiter's own view of "worth counting". Identical to
 * `API_PATH_SEGMENTS` plus `admin`: the admin endpoints are real,
 * authorization-performing API routes that were being skipped entirely,
 * because the one segment list had to leave `admin` out for the SPA
 * fallback's sake. The cost of counting it here is that an admin page
 * navigation also counts — a handful of document requests against a
 * 300/15min budget, unlike the per-page flood of /assets/* the skip exists
 * to keep out.
 */
const RATE_LIMITED_PATH_SEGMENTS = new Set([...API_PATH_SEGMENTS, 'admin']);

/**
 * @param path - `req.path`, i.e. the pathname with no query string.
 * @returns The lower-cased first path segment, or `undefined` for `/`.
 *   Lower-cased because Express matches routes case-insensitively by
 *   default: `GET /Users/me` reaches the exact same handler `/users/me`
 *   does, so comparing the segment verbatim let any caller opt out of the
 *   app-wide rate limiter just by capitalising a letter.
 */
function firstSegment(path: string): string | undefined {
    const segment = path.split('/')[1];
    return segment ? segment.toLowerCase() : undefined;
}

/**
 * @param path - `req.path`.
 * @returns Whether the path belongs to the API rather than to the SPA.
 */
export function isApiPath(path: string): boolean {
    const segment = firstSegment(path);
    return segment !== undefined && API_PATH_SEGMENTS.has(segment);
}

/**
 * @param path - `req.path`.
 * @returns Whether the request should count against the app-wide rate limit.
 */
export function isRateLimitedPath(path: string): boolean {
    const segment = firstSegment(path);
    return segment !== undefined && RATE_LIMITED_PATH_SEGMENTS.has(segment);
}
