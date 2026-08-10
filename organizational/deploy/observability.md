# Observability (issues #61-64, #68)

## Logs

Both services emit structured JSON to stdout, one schema across both:
`{"timestamp", "level", "message", ...fields}`.

- **apps/api** — pino (`src/lib/logger.ts`). Level via `LOG_LEVEL`
  (trace/debug/info/warn/error/fatal/silent).
- **apps/ai-server** — a stdlib `logging` handler with a custom
  `JsonFormatter` (`src/ai_server/logging_config.py`), field names matching
  apps/api's on purpose. Level via `AI_SERVER_LOG_LEVEL`.

Every request carries a correlation id (`X-Correlation-Id`): apps/api
generates one if the caller didn't send one, includes it in every log line
for that request (pino-http's `req.id`), and forwards it to apps/ai-server
on the photo-prediction path — so `grep <id>` across both services' logs
finds the whole round trip, not just apps/api's half of it.

## Metrics

`GET /metrics` on apps/api (issue #64) — Prometheus exposition format,
`prom-client`'s default Node process metrics plus one custom Histogram:

```text
http_request_duration_seconds{method, route, status_code}
```

That one metric is enough for request rate (`_count`), latency
(`_bucket`/`_sum`, use `histogram_quantile`), and error rate (filter
`status_code=~"5.."`) — see `prometheus-scrape-config.yml` and
`grafana-dashboard.json` in this directory for a ready-to-import starting
point (request rate, error rate, p50/p95/p99 latency, requests-by-route
table).

Access is gated by `METRICS_TOKEN` (`Authorization: Bearer <token>`) the
same way `apps/ai-server`'s `/predict` is gated by
`X-Internal-Service-Token` — optional, unset in local dev/CI, set to a real
value in production.

apps/ai-server has no equivalent `/metrics` endpoint yet — it's an
internal-only service with no public ingress, so a Prometheus scraper
outside the Container Apps environment can't reach it either way; adding
one is only worth doing once something inside that environment actually
scrapes it.

## What's not set up (yet)

No Prometheus server, Grafana instance, or Azure Monitor managed Prometheus
is actually deployed for this project — `prometheus-scrape-config.yml` and
`grafana-dashboard.json` are the config artifacts to feed into one, once
there's a reason to stand one up (issue #78's post-release checklist is
that reason for a single-maintainer project: watch these numbers by hand
for the first few days after a release, decide from there whether
always-on monitoring earns its cost).
