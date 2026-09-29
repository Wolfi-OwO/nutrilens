# nutrilens HTTP API Reference

`apps/api`'s HTTP API, at Richardson Maturity Model level 3: correct verbs and
status codes (`201 Created` + `Location` where a per-resource `GET` exists,
`204 No Content`), and HATEOAS `_links` on every JSON representation.

All 45 routes below were captured from a real running instance
(`node --test`'s `startTestServer()` against the migrated PostGIS test
database) — every JSON example on this page is an actual response, not a
hand-written guess.

**Conventions that apply to every endpoint below:**

- **No `/api` prefix.** Unlike this account's other two web apps
  (portfolio-webpage, network-visualizer), nutrilens's resource routes live
  at the root (`/meal-logs`, not `/api/meal-logs`) — that convention predates
  this HATEOAS pass and changing 45 routes' paths for consistency with other
  repos wasn't worth the churn. `GET /api` is still the one deliberate
  exception: a fixed hypermedia entry point, carved out of the root
  namespace and registered as its own rate-limited path segment (see
  `apps/api/src/lib/api-path-segments.ts`) precisely so the SPA fallback
  doesn't swallow it.
- **`GET /api` is the entry point.** Start there and follow `_links` by
  relation name rather than hard-coding a path. `docs`/`openapi` links are
  present only outside production; `/metrics` is never advertised (it's an
  operator endpoint, not a client-facing resource).
- Every JSON response carries a `_links` map **except**: `204 No Content`
  responses, binary downloads (`GET /users/:id/avatar`, `GET
  /users/me/export`'s `Content-Disposition: attachment`), and the two
  Kubernetes-style probes (`/livez`, `/readyz`).
- `self` only appears where a matching `GET` route actually exists for that
  representation. A diet plan has no per-id `GET` route (only `PATCH`/the
  archive action), so it never carries `self` — except `GET
  /diet-plans/active`, which does have its own route and does carry one. A
  meal log or weight entry, which do have `GET /meal-logs/:id` /`GET
  /weight-entries/:id`, always carry `self`.
- **`HEAD`** falls through to the matching `GET` automatically (Express's own
  behaviour) — 200, empty body. **`OPTIONS`** answers with a real per-route
  `Allow` header, or a genuine `404` for a path that doesn't exist. Before
  this was fixed, the global `cors()` middleware intercepted every `OPTIONS`
  request with a blanket `204` and no `Allow` header — even
  `OPTIONS /does-not-exist` came back `204`. `preflightContinue: true`
  (`apps/api/src/app.ts`) passes `OPTIONS` through to Express's router
  instead of letting `cors()` answer it itself; a real CORS preflight (an
  `Origin` + `Access-Control-Request-Method` header) still gets
  `Access-Control-Allow-Origin` back from the same middleware.
- A `POST` that creates a resource with its own `GET` route sets `Location`
  to it (`POST /meal-logs`, `POST /weight-entries`). One that doesn't — `POST
  /users` (no `GET /users/:id`), `POST /diet-plans` (no `GET
  /diet-plans/:id`) — sets no `Location`; follow `_links` instead.
- Authentication: `Authorization: Bearer <JWT>`, minted by `POST
  /auth/login`. No cookie session.
- Errors are JSON: `{ "error": "BadRequestError", "message": "...",
  "statusCode": 4xx }` — a 400 from the zod validation layer additionally
  carries an `issues` array.
- A list endpoint's body is `{ _links, count, items }`. `_links.next`/`prev`
  appear on a paginated list only when another page actually exists.

## Roles

| Role | Access |
| ------- | --------------------------------------------------------------------------- |
| anonymous | `POST /users`, `POST /auth/login`, `GET /auth/providers`, OAuth start/callback |
| `user` | Everything under their own account: diet plans, meal logs, weight entries |
| `coach` | Same as `user` today — no coach-specific endpoints exist yet |
| `admin` | Everything, plus `GET /users`, `PATCH /users/:id`, `GET /admin/stats`, `GET /admin/audit-log` |

## API root & health

### `GET /api`

The hypermedia entry point.

```http
GET /api
```

```json
{
  "_links": {
    "self": { "href": "/api" },
    "login": { "href": "/auth/login", "method": "POST" },
    "register": { "href": "/users", "method": "POST" },
    "providers": { "href": "/auth/providers" },
    "me": { "href": "/users/me" },
    "dietPlans": { "href": "/diet-plans" },
    "activeDietPlan": { "href": "/diet-plans/active" },
    "mealLogs": { "href": "/meal-logs" },
    "weightEntries": { "href": "/weight-entries" },
    "foodSearch": { "href": "/food-catalog/search{?q,limit}", "templated": true },
    "barcode": { "href": "/food-catalog/barcode{?code}", "templated": true },
    "discounters": { "href": "/discounters" },
    "storesNear": { "href": "/stores/near{?lat,lon,radius_m,limit}", "templated": true },
    "version": { "href": "/version" },
    "health": { "href": "/health" },
    "docs": { "href": "/docs" },
    "openapi": { "href": "/openapi.json" }
  }
}
```

`docs`/`openapi` are omitted when `NODE_ENV=production`.

### `GET /health`

No auth, exempt from rate limiting.

```json
{ "status": "ok" }
```

### `GET /livez`

Answers unconditionally — the process hasn't wedged. No `_links`.

### `GET /readyz`

Runs a real round-trip query through the connection pool — the app can
actually serve, not just that the process is up. `503` while the database is
unreachable. No `_links`.

### `GET /openapi.json`

The machine-readable OpenAPI 3.0 document this page is generated alongside
(`src/docs/openapi.ts`). Also rendered interactively at `GET /docs`. Both
are mounted only when `NODE_ENV !== 'production'`.

### `GET /version`

Build metadata for the frontend's footer.

```json
{
  "version": "dev",
  "revision": "",
  "buildDate": "",
  "repositoryUrl": "https://github.com/Wolfi-OwO/nutrilens",
  "_links": { "self": { "href": "/version" } }
}
```

### `GET /metrics`

Prometheus exposition format, gated by `METRICS_TOKEN` when set. Never
advertised in `_links` (an operator endpoint, not a discoverable resource).

## Authentication — `/auth`, `/users`

### `POST /users`

Register a new account.

```http
POST /users
Content-Type: application/json

{ "email": "alice@example.com", "password": "correct horse battery staple", "displayName": "Alice" }
```

```json
{
  "id": "ab1ed834-559a-4485-b9ff-1c266d0e142d",
  "email": "alice@example.com",
  "displayName": "Alice",
  "role": "user",
  "status": "active",
  "createdAt": "2026-09-28T16:08:58.429Z",
  "updatedAt": "2026-09-28T16:08:58.429Z",
  "avatarUrl": null,
  "avatarUploaded": false,
  "_links": { "login": { "href": "/auth/login", "method": "POST" } }
}
```

`201`, no `Location` — no `GET /users/:id` route exists.

### `POST /auth/login`

```http
POST /auth/login
Content-Type: application/json

{ "email": "alice@example.com", "password": "correct horse battery staple" }
```

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": "ab1ed834-...", "email": "alice@example.com", "displayName": "Alice", "role": "user" },
  "_links": { "me": { "href": "/users/me" }, "root": { "href": "/api" } }
}
```

Rate-limited (`LOGIN_RATE_LIMIT_MAX`). Same 401 for a wrong password and an
unknown email.

### `GET /auth/providers`

Which OAuth options are actually configured.

```json
{ "providers": [], "_links": { "self": { "href": "/auth/providers" } } }
```

### `GET /auth/:provider`

Starts the corresponding OAuth flow (a `302` redirect to the provider). `400`
for an unknown or unconfigured provider name.

### `GET /auth/:provider/callback`

Completes the flow — exchanges the code, mints a session JWT, and redirects
back into the SPA.

## Users — `/users`

### `GET /users/me`

```json
{
  "id": "ab1ed834-...",
  "email": "alice@example.com",
  "displayName": "Alice",
  "role": "user",
  "status": "active",
  "avatarUrl": null,
  "avatarUploaded": false,
  "_links": {
    "self": { "href": "/users/me" },
    "update": { "href": "/users/me", "method": "PATCH" },
    "delete": { "href": "/users/me", "method": "DELETE" },
    "avatar": { "href": "/users/me/avatar", "method": "POST" },
    "export": { "href": "/users/me/export" }
  }
}
```

### `PATCH /users/me`

Self-service display-name edit. Same `_links` shape as the `GET` above.

### `POST /users/me/avatar`

Multipart upload (`multipart/form-data`, field `file`, max 2 MB). Normalized
to a 256x256 WebP server-side; EXIF/GPS dropped as a side effect of
re-encoding. Returns the updated `GET /users/me` shape.

### `DELETE /users/me/avatar`

Clears the upload, falling back to a provider avatar or the frontend's
generated-initials placeholder. Same response shape.

### `GET /users/:id/avatar`

The raw image bytes (`image/webp`). Deliberately unauthenticated — see
`src/docs/openapi.ts`'s `/users/{id}/avatar` entry for the full DSGVO
reasoning. No `_links` (binary body).

### `GET /users/me/export`

Full data export (GDPR Art. 20) as a downloadable JSON file
(`Content-Disposition: attachment`). No `_links` — a download, not a
browsable resource.

### `DELETE /users/me`

Self-service account deletion (GDPR Art. 17) -> `204`. Password required if
the account has one.

### `GET /users`

Admin-only. Search/filter/paginate every account.

```http
GET /users?page=1&pageSize=20
```

```json
{
  "users": [
    {
      "id": "ab1ed834-...",
      "email": "alice@example.com",
      "role": "admin",
      "_links": { "update": { "href": "/users/ab1ed834-...", "method": "PATCH" } }
    }
  ],
  "total": 824,
  "page": 1,
  "pageSize": 20,
  "_links": {
    "self": { "href": "/users?page=1&pageSize=20" },
    "next": { "href": "/users?page=2&pageSize=20" }
  }
}
```

A listed user's `_links.avatar` is present only when that user actually has
one set.

### `PATCH /users/:id`

Admin-only role/status change (last active admin protected from
demotion/suspension).

```json
{
  "id": "ab1ed834-...",
  "role": "coach",
  "_links": { "update": { "href": "/users/ab1ed834-...", "method": "PATCH" } }
}
```

No `self` — there is no `GET /users/:id` route, only this `PATCH` and
`DELETE`.

## Diet plans — `/diet-plans`

`self` appears only on `GET /diet-plans/active` — every other diet-plan
representation carries only the affordances that actually resolve
(`update`, `archive`, `collection`), since no `GET /diet-plans/:id` route
exists.

### `POST /diet-plans`

Creates a plan; archives whatever plan is currently active.

```json
{
  "id": "fdd8966b-...",
  "dailyCalorieTarget": 2200,
  "goal": "maintain",
  "endsAt": null,
  "_links": {
    "update": { "href": "/diet-plans/fdd8966b-...", "method": "PATCH" },
    "archive": { "href": "/diet-plans/fdd8966b-.../archive", "method": "POST" },
    "collection": { "href": "/diet-plans" }
  }
}
```

`201`, no `Location`.

### `GET /diet-plans`

```json
{
  "_links": { "self": { "href": "/diet-plans" } },
  "count": 1,
  "items": [{ "id": "fdd8966b-...", "dailyCalorieTarget": 2200, "endsAt": null, "_links": { "...": "..." } }]
}
```

### `GET /diet-plans/active`

Same shape as one list item, plus `self`.

```json
{
  "id": "fdd8966b-...",
  "dailyCalorieTarget": 2000,
  "endsAt": null,
  "_links": {
    "self": { "href": "/diet-plans/active" },
    "update": { "href": "/diet-plans/fdd8966b-...", "method": "PATCH" },
    "archive": { "href": "/diet-plans/fdd8966b-.../archive", "method": "POST" },
    "collection": { "href": "/diet-plans" }
  }
}
```

`404` when the caller has no active plan.

### `PATCH /diet-plans/:id`

Owner-only. Same response shape as `POST /diet-plans`.

### `POST /diet-plans/:id/archive`

Owner-only; sets `endsAt`. Same response shape, `endsAt` now non-null.

## Meal logs — `/meal-logs`

### `POST /meal-logs`

Requires an active diet plan (`409` without one). Totals are always
server-derived from `items` — a client-supplied total is ignored.

```json
{
  "id": "9a8241e3-...",
  "dietPlanId": "fdd8966b-...",
  "source": "manual_search",
  "totalCalories": 80,
  "items": [{ "id": "e326f7e2-...", "foodName": "Apple", "portionGrams": 150, "calories": 80 }],
  "_links": {
    "self": { "href": "/meal-logs/9a8241e3-..." },
    "update": { "href": "/meal-logs/9a8241e3-...", "method": "PATCH" },
    "delete": { "href": "/meal-logs/9a8241e3-...", "method": "DELETE" },
    "collection": { "href": "/meal-logs" }
  }
}
```

`201`, `Location: /meal-logs/9a8241e3-...`.

### `GET /meal-logs`

```json
{
  "_links": { "self": { "href": "/meal-logs" } },
  "count": 1,
  "items": [{ "id": "9a8241e3-...", "totalCalories": 80, "items": [], "_links": { "...": "..." } }]
}
```

### `GET /meal-logs/:id`

Owner-only (`403` for someone else's log). Same shape as one create/list
item.

### `PATCH /meal-logs/:id`

Replaces `items` wholesale and recomputes totals. Same response shape.

### `DELETE /meal-logs/:id`

Owner-only -> `204`.

### `POST /meal-logs/photo-prediction`

Multipart upload (field `file`); forwards to `apps/ai-server`, does not
itself create a log. `available: false` (never a thrown error) when the AI
server isn't configured or is unreachable.

```json
{
  "available": false,
  "reason": "not_configured",
  "_links": { "mealLogs": { "href": "/meal-logs" } }
}
```

## Weight entries — `/weight-entries`

### `POST /weight-entries`

One per UTC day; a second same-day entry is `409` unless `overwrite: true`.

```json
{
  "id": "91fc86dc-...",
  "weightKg": 82.5,
  "recordedAt": "2026-09-28T16:08:58.711Z",
  "_links": {
    "self": { "href": "/weight-entries/91fc86dc-..." },
    "update": { "href": "/weight-entries/91fc86dc-...", "method": "PATCH" },
    "delete": { "href": "/weight-entries/91fc86dc-...", "method": "DELETE" },
    "collection": { "href": "/weight-entries" }
  }
}
```

`201`, `Location: /weight-entries/91fc86dc-...`.

### `GET /weight-entries`

Optionally filtered by `?from=`/`?to=` (ISO date-time).

```json
{
  "_links": { "self": { "href": "/weight-entries" } },
  "count": 1,
  "items": [{ "id": "91fc86dc-...", "weightKg": 82.5, "_links": { "...": "..." } }]
}
```

### `GET /weight-entries/:id`

Owner-only. Same shape as one create/list item.

### `PATCH /weight-entries/:id`

Owner-only. Same response shape.

### `DELETE /weight-entries/:id`

Owner-only -> `204`.

## Food catalog — `/food-catalog`

### `GET /food-catalog/search`

Ranked USDA catalog search; matches on English description/category and on
localized names, falling back to trigram matching for typos/inflected forms.

```http
GET /food-catalog/search?q=chicken&limit=5
```

```json
{
  "_links": { "self": { "href": "/food-catalog/search?q=chicken&limit=5" } },
  "count": 1,
  "items": [
    {
      "fdcId": 999901,
      "description": "Chicken breast, raw",
      "caloriesKcal": 165,
      "proteinGrams": 31,
      "matchedName": null
    }
  ]
}
```

### `GET /food-catalog/barcode`

Single-food lookup by EAN/UPC.

```http
GET /food-catalog/barcode?code=5011234567890
```

```json
{
  "fdcId": 999901,
  "description": "Chicken breast, raw",
  "eanCode": "5011234567890",
  "_links": { "self": { "href": "/food-catalog/barcode?code=5011234567890" } }
}
```

A miss is a `404` (`{ "error": "NotFoundError", "message": "No food catalog entry for that barcode.", "statusCode": 404 }`)
— previously a `200` with a JSON `null` body, which a status-code-only client
couldn't tell apart from "the field really is null".

## Store discovery — `/discounters`, `/stores`

Read-only reference data (imports, not user writes). `attribution: "©
OpenStreetMap contributors"` is present on any response that includes a row
sourced from OpenStreetMap (ODbL 1.0) — absent entirely, not `null`, when
every row shown is purchased/proprietary data (e.g. the Geolocet-sourced
Spar rows below).

### `GET /discounters/countries`

Every country code present in the table, derived, not a fixed list.

```json
{ "_links": { "self": { "href": "/discounters/countries" } }, "count": 1, "items": ["AT"] }
```

### `GET /discounters`

```http
GET /discounters?country=AT
```

```json
{
  "discounters": [
    {
      "id": "2b6a7bf6-...",
      "code": "spar",
      "name": "Spar",
      "countryCode": "AT",
      "storeCount": 0,
      "_links": { "stores": { "href": "/discounters/spar/stores" } }
    }
  ],
  "_links": { "self": { "href": "/discounters?country=AT" } }
}
```

Unknown country -> `200` with an empty list, not `404`.

### `GET /discounters/:code/stores`

One page of a discounter's active stores. `phone`, `source` and
`externalStoreId` are never returned.

```http
GET /discounters/spar/stores?limit=5
```

```json
{
  "stores": [
    { "id": "7b92bfe6-...", "name": "Spar Wien Mitte", "city": "Wien", "latitude": 48.2082, "longitude": 16.3738 }
  ],
  "limit": 5,
  "offset": 0,
  "_links": {
    "self": { "href": "/discounters/spar/stores" },
    "discounter": { "href": "/discounters" }
  }
}
```

`discounter` points back to the `/discounters` list — no single-discounter
`GET` route exists. A malformed or unknown code is `404`.

### `GET /stores/near`

Nearest active stores to a point, any discounter, backed by the PostGIS GiST
index.

```http
GET /stores/near?lat=48.2082&lon=16.3738&radius_m=5000&limit=5
```

```json
{
  "stores": [
    { "id": "7b92bfe6-...", "name": "Spar Wien Mitte", "latitude": 48.2082, "longitude": 16.3738, "distanceM": 0 }
  ],
  "_links": { "self": { "href": "/stores/near" } }
}
```

## Administration (role `admin`) — `/admin`

### `GET /admin/stats`

Platform-wide aggregate counts.

```json
{
  "usersByRole": { "user": 686, "coach": 30, "admin": 108 },
  "usersByStatus": { "active": 700, "suspended": 124, "deleted": 0 },
  "activeDietPlans": 122,
  "mealLogsLast7Days": 58,
  "signupsLast30Days": [{ "date": "2026-09-28", "count": 824 }],
  "_links": { "self": { "href": "/admin/stats" } }
}
```

### `GET /admin/audit-log`

Every role/status change any admin has made, newest first.

```http
GET /admin/audit-log?page=1&pageSize=20
```

```json
{
  "entries": [
    {
      "id": "98b97a24-...",
      "actorId": "ab1ed834-...",
      "targetUserId": "ab1ed834-...",
      "action": "role_change",
      "previousValue": "admin",
      "newValue": "coach",
      "createdAt": "2026-09-28T16:08:59.045Z"
    }
  ],
  "total": 66,
  "page": 1,
  "pageSize": 20,
  "_links": {
    "self": { "href": "/admin/audit-log?page=1&pageSize=20" },
    "next": { "href": "/admin/audit-log?page=2&pageSize=20" }
  }
}
```
