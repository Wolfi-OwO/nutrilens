// apps/api's routes aren't namespaced under /api/*, so anything that needs
// to tell "a real API path" apart from "a client-side SPA route" — the
// static-frontend SPA fallback, and the rate limiter (see rate-limit.ts) —
// has to know the API's own top-level segments explicitly. Keep this in
// sync with routes/*.routes.ts; if the API ever moves under /api/*, this
// list (and the workarounds that need it) can be dropped for a plain prefix
// check.
export const API_PATH_SEGMENTS = new Set([
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
