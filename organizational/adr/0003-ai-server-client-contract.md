# ADR-0003: apps/api ↔ apps/ai-server call contract

## Status

Accepted

## Context

`apps/ai-server`'s own contract is documented from its side in
[`apps/ai-server/API.md`](../../apps/ai-server/API.md) (issue #42). This ADR
is the other half — issue #43's "formalize timeout expectations and error
codes for the internal call path" — from `apps/api`'s side, since a
consuming client has to make choices `API.md` doesn't (and shouldn't): how
long to wait, whether to retry, and what to do when the answer is "the AI
server didn't answer."

The behavior below implements
[`organizational/activity-diagrams/ai-server-failure-handling.md`](../activity-diagrams/ai-server-failure-handling.md)
literally — that diagram was written before the client existed; this is
where it actually gets built.

## Decision

`src/lib/ai-server-client.ts`'s `AiServerClient.predict()` never throws for
an AI-server failure — it returns one of three typed outcomes, so a caller
is forced by the type system to handle all three, not just the happy path:

| Outcome | When | Caller's response |
| --- | --- | --- |
| `{ status: 'ok', result }` | A 200 with a well-formed body. | Use `result.predictions` / `result.isConfident`. |
| `{ status: 'invalid_image', message }` | A 400 — the upload itself is bad (empty, oversized, undecodable). | Surface `message` to the user; retrying won't help, so this is **not** retried. |
| `{ status: 'unavailable', reason }` | Timeout, connection failure, malformed response, a 5xx, or the circuit breaker is open. | Fall back to manual meal logging (issue #45) — never block the user on an AI-server outage. |

**Timeout**: `AI_SERVER_TIMEOUT_MS`, default 2500ms per attempt. Chosen to
leave headroom under NFR-PERF-01's 3s p95 budget for the *whole* round trip
(network + apps/api's own overhead), not just the AI-server call itself —
apps/ai-server's own measured p95 is ~0.67s (see
[`ai-server-load-test.md`](../performance/ai-server-load-test.md)), so 2500ms
is generous, not tight.

**Retry**: `AI_SERVER_MAX_RETRIES`, default 1 (so 2 attempts total). Only a
transient failure (timeout, network error, 5xx) is retried — a 400 means the
image is the problem, and retrying the same bad image wastes the retry
budget on something that will never succeed.

**Circuit breaker**: after `AI_SERVER_CIRCUIT_BREAKER_THRESHOLD` (default 5)
consecutive failures, the circuit opens for
`AI_SERVER_CIRCUIT_BREAKER_COOLDOWN_MS` (default 30s) — every `predict()`
call during that window returns `unavailable` immediately, without even
attempting a request. This is what keeps a real AI-server outage from
piling up slow, doomed requests (each paying the full timeout) on top of
whatever else apps/api is doing.

**All five values are env-configurable** (issue #44's acceptance
criterion), with defaults chosen from the measured numbers above rather than
picked arbitrarily.

## Consequences

- A user's meal-logging flow is never blocked by an AI-server problem — the
  worst case is "the photo path didn't work this time, log it manually,"
  never a hung request or a 500.
- The circuit breaker is in-process, per `apps/api` replica — with multiple
  replicas, each tracks its own failure count independently. Acceptable for
  now (no shared state store exists); a shared circuit state would need
  Redis or similar, not justified yet at this scale.
- `AiServerClient` is constructed once (like `getPool()`) and long-lived, so
  its circuit-breaker state persists across requests within a replica's
  lifetime — restarting a replica resets it, which is fine (a fresh replica
  should get its own chance, not inherit a stale outage).
