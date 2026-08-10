# Post-release checklist (issue #78)

A short runbook for the days right after publishing a GitHub Release —
nutrilens has no on-call rotation or paging system (single-maintainer
project), so this is "what to look at yourself," not "who gets paged."

## Right after the deploy finishes

1. Confirm the release workflow actually shifted traffic — the last job
   step failing means production is untouched, not broken, but check
   anyway: `gh run view <run-id>` on `.github/workflows/release.yml`.
2. Hit the deployed `/version` endpoint and confirm it reports the tag you
   just released, not the previous one.
3. Hit `/health` (expect `200`) and, if you touched anything
   auth-or-database-related, do one real login and one real authenticated
   request by hand — a clean deploy is not the same as a working feature
   (see the project's own "Verify to the end" habit).

## First 24-48 hours

Watch these — see `observability.md` in this directory for what backs each
one:

- **Error rate** (`GET /metrics`, `http_request_duration_seconds` filtered
  to `status_code=~"5.."`, or the Grafana dashboard's "Error rate" panel if
  you've stood one up from `grafana-dashboard.json`) — a spike right after
  a release that a pre-release smoke test didn't need to fail this loudly
  wasn't caught.
- **p95/p99 latency** (same metric, "Latency" panel) — a regression here
  usually means a new N+1 query or a slow migration that didn't show up
  against the smaller local/test dataset.
- **Azure Container Apps revision health** — both `nutrilens` and
  `nutrilens-ai-server`:

  ```bash
  az containerapp revision list -g nutrilens-rg -n nutrilens \
    --query "[].{name:name, active:properties.active, traffic:properties.trafficWeight, replicas:properties.replicas}" -o table
  ```

  The new revision should be the only one at 100% traffic; the previous one
  should sit at 0% traffic / 0 replicas (a free rollback point, not cost —
  see `azure-container-apps.md`), not accumulate as a third or fourth
  still-serving revision.
- **Dependabot / CodeQL / Trivy** — check the Security tab for anything new
  that a release's dependency bump might have introduced.

## If something's wrong

- **Rollback**: shift Container Apps traffic back to the previous revision
  (still sitting at 0% traffic, not deleted) — no new deploy needed, this
  is a traffic-weight change:

  ```bash
  az containerapp ingress traffic set -g nutrilens-rg -n nutrilens \
    --revision-weight <previous-revision>=100 <new-revision>=0
  ```

- **Database**: see `database-backup-restore.md` if a bad migration needs
  reverting — restore-to-a-new-server is the tested, safe path; it never
  touches the live server.
- File an issue with the `type:bug`/`priority:critical` labels either way,
  even after a successful rollback — the point of this checklist is that
  the finding survives past the moment you noticed it.

## What this checklist deliberately doesn't do

No automated alerting/paging is wired up — the metrics and dashboard exist
so a human can look, not so a system pages one at 3am. Revisit that
trade-off if nutrilens ever has real production traffic and more than one
maintainer; until then, the cost of standing up alerting infrastructure
isn't worth paying for a project with no on-call rotation to receive it.
