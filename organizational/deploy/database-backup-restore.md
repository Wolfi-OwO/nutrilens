# Database backup and restore (issue #73)

## Backups

`nutrilens-pg` (Azure Database for PostgreSQL Flexible Server, `westeurope`)
takes automated backups by default — nothing to configure or maintain:

- **Retention:** 7 days (`backupRetentionDays: 7`)
- **Geo-redundancy:** disabled — backups stay in the same region as the
  server. Acceptable for a single-region, single-maintainer deployment;
  revisit if nutrilens ever needs a documented region-loss recovery target.
- **Type:** continuous (point-in-time restore), not just daily snapshots —
  any second within the retention window is a valid restore point, not only
  midnight boundaries.

Check current status any time:

```bash
az postgres flexible-server show -g nutrilens-rg -n nutrilens-pg \
  --query "backup"
```

## Restore procedure

Azure Postgres Flexible Server's restore operation **always creates a new
server** — it never overwrites the source. That makes a restore drill
routinely safe to run for real, not just something to eyeball in the docs.

```bash
# 1. Restore to a new, throwaway server at a chosen point in time.
az postgres flexible-server restore \
  --resource-group nutrilens-rg \
  --name nutrilens-pg-restore-<date> \
  --source-server nutrilens-pg \
  --restore-time "<ISO8601 timestamp, within the last 7 days>"

# 2. New servers restore with no firewall rules — add one to reach it at all.
az postgres flexible-server firewall-rule create \
  --resource-group nutrilens-rg \
  --server-name nutrilens-pg-restore-<date> \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0

# 3. Verify data against the restored server from inside the network — the
#    production DB firewall only allows Azure services, not arbitrary public
#    IPs, so query it from a throwaway Container Apps Job rather than
#    opening the firewall to your own machine. See "Verified" below for the
#    exact job shape (a plain postgres:16-alpine image running psql).

# 4. Once satisfied, delete the throwaway server — it bills like a real
#    server while it exists.
az postgres flexible-server delete -g nutrilens-rg -n nutrilens-pg-restore-<date> --yes
```

### Verified

Tested live on 2026-08-10: restored to `nutrilens-pg-restore-test`, queried
row counts across `users`, `meal_logs`, `diet_plans`, `weight_entries`, and
`auth_providers` via a throwaway Container Apps Job, and cross-checked the
`users` table's exact email addresses against a matching query against the
real production server. Both matched exactly (3 users, same emails, same
timestamps). Restore server and verification jobs were deleted immediately
after — nothing was left running.

There is no automated restore drill on a schedule — re-run the procedure
above whenever there's reason to doubt the backup is actually restorable
(a Postgres major-version bump, a long gap since the last check), not on a
calendar, for the same single-maintainer-project reasoning as
[SECURITY.md](../../SECURITY.md)'s secret-rotation policy.

## What backups do *not* cover

- **Uploaded meal photos** — never persisted anywhere (`apps/ai-server`
  processes them in memory only, per
  [README.md](../../README.md#why-a-two-server-architecture)). There is
  nothing to back up because nothing is stored.
- **Application secrets** (`JWT_SECRET`, OAuth client secrets, etc.) — live
  in GitHub Actions secrets and Azure, not the database. See
  [SECURITY.md](../../SECURITY.md#secret-rotation).
