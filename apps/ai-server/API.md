# apps/ai-server API contract

Internal-only — reachable only from `apps/api`, never from the public
internet or a browser (ADR-0001). This document is the concrete reference
for the M5 `apps/api` client wrapper to implement against; FastAPI also
serves an interactive Swagger UI at `/docs` and the same contract as
machine-readable OpenAPI at `/openapi.json`, but those are only reachable
from inside the internal network, so this file is the one a developer
actually reads.

## `POST /predict`

Identifies the food in an uploaded photo.

**Request** — `multipart/form-data`, one field:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `file` | file (image/\*) | yes | Max 10 MiB (`Settings.max_upload_bytes`). Any Pillow-decodable format (JPEG, PNG, WebP, ...). |

**Header** — `X-Internal-Service-Token` (NFR-SEC-01): required and checked
against `AI_SERVER_INTERNAL_SERVICE_TOKEN` whenever that env var is set — a
service-to-service credential on top of network isolation, not a
replacement for it. Unset (the default in local dev and this service's own
test suite) means no check is performed. A missing or wrong token is a
`401`. `apps/api` sends this on every request via `AiServerClient` — see
`apps/api/src/lib/ai-server-client.ts` and `config.internalServiceToken`.

**Response — `200 OK`**

```json
{
  "predictions": [
    { "label": "beignets", "confidence": 0.9994 },
    { "label": "waffles", "confidence": 0.0002 },
    { "label": "french_toast", "confidence": 0.0001 },
    { "label": "apple_pie", "confidence": 0.0001 },
    { "label": "donuts", "confidence": 0.0001 }
  ],
  "is_confident": true
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `predictions` | array | Up to 5 candidates, sorted by `confidence` descending. Never empty on a 200. |
| `predictions[].label` | string | One of Food-101's 101 category names (`snake_case`, e.g. `chicken_wings`) — see ADR-0002. |
| `predictions[].confidence` | number | `0..1`, softmax probability. |
| `is_confident` | boolean | `false` when `predictions[0].confidence` is below the configured threshold (default `0.5`) — issue #35. The client should treat this as "couldn't confidently identify this food" and prompt the user to search/confirm manually, **not** silently trust `predictions[0]`. `predictions` is still populated either way — it's still useful context for a manual-search fallback UI. |

**Response — `400 Bad Request`** (empty, oversized, or undecodable upload):

```json
{ "detail": "Uploaded file is not a readable image." }
```

`detail` is one of: `"Uploaded file is empty."`, `` "Uploaded file exceeds the {N} byte limit." ``, `"Uploaded file is not a readable image."`.

## `GET /health`

Liveness only — the process is up. Does **not** imply the model is loaded;
an orchestrator should route to this during a cold start.

```json
{ "status": "ok" }
```

Always `200` if the process is running at all.

## `GET /ready`

Readiness — the model is loaded and `/predict` can serve a real request.
An orchestrator (or `apps/api`, before routing a user's request) should wait
for `200` here, not just `/health`, before sending `/predict` traffic.

- `200 OK` — `{"status": "ready"}`
- `503 Service Unavailable` — `{"detail": "Model is not ready."}`

In the shipped Dockerfile (#38) the model is baked in at build time, so in
practice this returns `200` immediately at container start — `/ready`
exists as a contract for any future deployment mode (e.g. a lazy
first-request download) where that isn't true, not because it's currently
slow.

## Not yet implemented

- Authentication between `apps/api` and `apps/ai-server` (NFR-SEC-01's
  "authenticated with a service-to-service credential") — tracked for M5,
  when the two services are actually wired together over a real network
  boundary rather than each developed in isolation.
