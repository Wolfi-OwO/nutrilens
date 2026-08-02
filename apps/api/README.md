# @nutrilens/api

The main application server: authentication, diet plans, meal logs, and the
API the frontend talks to. Food-photo analysis is delegated to
`apps/ai-server` over an internal-only network path — see
`../../organizational/adr/0001-two-server-split.md`.

## Development

```bash
npm install
npm run dev              # watch mode, runs src/main.ts directly via type stripping
npm run build            # tsc -b tsconfig.build.json
npm run typecheck
npm test
DATABASE_URL=postgresql://user:pass@localhost:5432/nutrilens npm run database:migrate
```

Migrations are plain numbered SQL files in `database/migrations/`, applied in
order by `scripts/run-migrations.mjs` and tracked in a `schema_migrations`
table. There's no local Postgres/Docker Compose setup yet (see #27) — point
`DATABASE_URL` at any Postgres 14+ instance.

## Status

Express app with security middleware (helmet, cors, pino request logging), a
`/health` endpoint, and the initial database schema (`users`, `diet_plans`,
`meal_logs`, `meal_log_items`, `weight_entries` — matches
`../../organizational/application-overview.md`'s domain model). Auth and the
domain endpoints themselves land in follow-up issues (see milestone M3).
