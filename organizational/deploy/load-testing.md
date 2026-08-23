# Load testing (2026-08-10)

Validates `apps/ai-server`'s `/predict` — the compute-heavy, food-recognition
path — under realistic concurrent load, and tunes production's scale
settings from the result rather than a guess.

## Method

A throwaway Azure Container Apps Job (`nutrilens-stress-tester`, deleted
after the run), created inside the same `nutrilens-env` Container Apps
environment so it can reach `apps/ai-server`'s internal-only FQDN directly —
bypassing `apps/api` and its rate limiter entirely, since the goal is
`ai-server`'s own capacity ceiling, not `apps/api`'s.

Target: a dedicated, zero-traffic `ai-server` revision
(`nutrilens-ai-server--stress-test`), copied from the production image, with
`--min-replicas 0 --max-replicas 10` — isolated from real traffic, and
`min-replicas 0` deliberately, so the run also measures the cold-start cost
that setting trades for (see Results).

The job ramps concurrency (1, 2, 4, 8, 16 concurrent workers), each level
running for 20s against `POST /predict` with a small synthetic JPEG,
recording p50/p95/p99 latency and error rate per level.

## Results

| concurrency    | requests | errors | p50     | p95    | p99    | max     |
| -------------- | -------- | ------ | ------- | ------ | ------ | ------- |
| 1 (cold start) | 1        | 0      | 31564ms | —      | —      | 31564ms |
| 2              | 58       | 0      | 716ms   | 793ms  | 802ms  | 802ms   |
| 4              | 53       | 0      | 1592ms  | 1880ms | 1882ms | 1882ms  |
| 8              | 58       | 0      | 2799ms  | 4432ms | 4435ms | 4435ms  |
| 16             | 69       | 0      | 5619ms  | 6585ms | 7397ms | 7397ms  |

Zero errors at every level — the service never fails under load, it just
gets slower. Latency grows **near-linearly** with concurrency rather than
staying flat, which is the signature of requests being served one at a time
within a replica rather than genuinely in parallel (confirmed as a real code
bug, not just a scaling question — see Bottlenecks below).

**Cold start**: the very first request, from zero replicas, took ~31.5s
(model download/load + ONNX Runtime session init). This is the real cost
`--min-replicas 0` trades for — a legitimate tradeoff pre-launch (no idle
compute cost for a service with no real traffic yet), revisited once there's
actual usage data to weigh against it.

## Bottlenecks (filed as follow-ups)

- **[#146](https://github.com/Wolfi-OwO/nutrilens/issues/146)** — `predict()`
  is `async def` but calls the synchronous, CPU-bound `_predict()` (Pillow
  decode + `onnxruntime` inference) directly, blocking Starlette's single
  event-loop thread for the whole call. That's why latency scales with
  concurrency instead of staying flat: one replica can only serve one
  request at a time, not because of raw compute limits but because nothing
  hands the CPU-bound work to a thread. Fix: `run_in_threadpool` (a low-risk
  change — `onnxruntime` releases the GIL during inference, so this should
  yield genuine intra-replica parallelism).

## Production scale settings

Tuned from this data ([`release.yml`](../../.github/workflows/release.yml)'s
`ai-server` rollout step), given the current serial-per-replica behavior:

- **`--min-replicas 0`** — kept, per the cold-start tradeoff above.
- **`--max-replicas 10`** — raised from 5; the previous ceiling wasn't
  informed by any measurement.
- **HTTP concurrency-based scale rule, threshold 4** — Azure's _default_
  scale rule (`concurrentRequests: 10` per replica, when no explicit rule is
  set) wouldn't trigger a second replica until a replica already had 10
  requests queued — well past where this data shows p95 blowing past the
  3s NFR (issue #49). Concurrency 4 was the highest level that stayed
  comfortably under target on one replica, so that's the threshold a new
  replica gets added at — proactive, not reactive.

Once #146 lands, this data should be re-measured — real intra-replica
parallelism may mean a higher concurrency threshold (fewer replicas needed
for the same latency) is the better setting.

## Cleanup

The stress-test job and its dedicated `ai-server` revision are deleted after
each run — nothing from this process is meant to persist.
