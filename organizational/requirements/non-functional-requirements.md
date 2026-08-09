# Non-Functional Requirements

## Security

- **NFR-SEC-01** The AI-detection server (`apps/ai-server`) is not reachable
  from the public internet; only `apps/api` can call it, over an internal
  network segment, authenticated with a service-to-service credential.
- **NFR-SEC-02** `apps/ai-server` persists no user data — no images, no
  predictions, no logs containing image content.
- **NFR-SEC-03** All secrets (DB credentials, JWT signing keys, internal
  service credentials) are supplied via environment variables, never
  committed. Enforced by secret scanning (gitleaks + GitHub push protection)
  on every push.
- **NFR-SEC-04** Passwords are hashed with a memory-hard algorithm (Argon2id
  or bcrypt with a modern cost factor); never stored or logged in plaintext.
- **NFR-SEC-05** All state-changing endpoints require authentication; RBAC
  distinguishes `USER`, `COACH`, and `ADMIN`.
- **NFR-SEC-06** Uploaded photos have EXIF location metadata stripped before
  leaving `apps/api`.
- **NFR-SEC-07** Dependencies are scanned continuously (Dependabot, Trivy,
  CodeQL) — see [SECURITY.md](../../SECURITY.md).
- **NFR-SEC-08** Every `apps/api` endpoint is rate-limited per IP: a global
  cap of 300 requests / 15 minutes (`apiRateLimiter`, mounted ahead of every
  route) for all endpoint classes, tightened to 10 requests / 15 minutes on
  `POST /auth/login` (`loginRateLimiter`) since that endpoint is the one
  brute-force target where Argon2id's own slowness isn't sufficient on its
  own — see `apps/api/src/middlewares/rate-limit.ts`.

## Privacy / data protection

- **NFR-PRIV-01** Account deletion cascades to all personal data (diet plans,
  meal logs, weight entries) within 30 days.
- **NFR-PRIV-02** Meal photos are never persisted beyond the inference
  request — the AI server processes them in memory only.
- **NFR-PRIV-03** Data subject access/export requests are supported (GDPR —
  the maintainer is EU-based).

## Performance

- **NFR-PERF-01** Photo-based meal logging (upload → AI prediction returned)
  completes in under 3 seconds at the 95th percentile.
- **NFR-PERF-02** Standard API reads (progress view, meal history) return
  under 300ms at the 95th percentile under normal load.

## Reliability

- **NFR-REL-01** If `apps/ai-server` is unavailable or exceeds the latency
  budget, `apps/api` degrades gracefully to the manual logging path rather
  than failing the whole request — see
  [AI server failure handling](../activity-diagrams/ai-server-failure-handling.md).
- **NFR-REL-02** A circuit breaker prevents cascading failures if the AI
  server is unhealthy for a sustained period.

## Observability

- **NFR-OBS-01** Structured logs correlate a request across `apps/api` and
  `apps/ai-server` via a correlation ID.
- **NFR-OBS-02** Code coverage is measured and reported in CI for both
  `apps/api` and `apps/ai-server`, with a minimum threshold enforced once
  each component has an initial test suite (see M7 milestone).

## Accessibility & i18n

- **NFR-A11Y-01** The frontend meets WCAG 2.1 AA for core flows (logging a
  meal, viewing progress).
- **NFR-I18N-01** All user-facing strings and units (metric/imperial) are
  externalized, not hardcoded — even though English is the only shipped
  locale initially.
