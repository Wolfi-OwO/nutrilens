# @nutrilens/api

The main application server: authentication, diet plans, meal logs, and the
API the frontend talks to. Food-photo analysis is delegated to
`apps/ai-server` over an internal-only network path — see
`../../organizational/adr/0001-two-server-split.md`.

## Development

```bash
npm install
export DATABASE_URL=postgresql://user:pass@localhost:5432/nutrilens
npm run database:migrate
npm run database:seed    # optional: representative sample data, dev-only
npm run dev              # watch mode, runs src/server.ts directly via type stripping
npm run build            # tsc -b tsconfig.build.json
npm run typecheck
npm test
```

`DATABASE_URL` is required to start the server — it's no longer a
health-check-only stub. Migrations are plain numbered SQL files in
`database/migrations/`, applied in order by `scripts/run-migrations.mjs` and
tracked in a `schema_migrations` table. `docker-compose.yml` in this directory
brings up apps/api plus its own Postgres for local development (see #27); a
full-stack compose wiring in apps/ai-server too is tracked separately (#87).
Copy `.env.example` to `.env` for local development.

`npm run database:seed` populates representative users/plans/logs/entries via
`scripts/seed.ts`, sourced from `database/data/*.json`. It's idempotent (safe
to re-run) and refuses to run when `NODE_ENV=production`; pass `-- --reset` to
wipe the seeded tables first.

## Structure

```text
src/
├── server.ts       the ONLY startup file — config validation, middleware,
│                   route mounting, .listen(), all in one place. No app.ts/
│                   main.ts split; nothing else may call .listen().
├── config/         the only place process.env is read
├── database/       connection pool + transaction helper only — no domain logic
├── models/         one file per entity: the domain shape + row<->domain mapping
├── repository/     one file per entity: the actual queries (findByEmail, create, ...)
├── handlers/       request handlers (Express "controllers")
├── routes/         one file per resource, exporting a plain `<resource>Router`
│                   — not a factory function. A route that needs a service
│                   constructs it at module scope (see users.routes.ts), so
│                   there is nothing to call and nothing named createXyz.
├── services/       business logic; never touches Express req/res or a DB driver
└── lib/            AppError hierarchy + asyncHandler, shared utilities
```

Flat, one-folder-per-concern layout, evidenced both in this account's real
Java coursework (`model/`, `repository/`, `service/`, one file per entity —
no per-entity subdirectories) and in `lattice`'s own generated Express/FastAPI
templates (`models/` flat + a data-access seam). Not a per-domain module
split — that split is warranted once a domain's files start crowding every
diff together, which isn't the case yet at one domain.

No `createXyz()` factory wrappers, and every exported name matches the type
it holds (`healthRouter`/`usersRouter`, both `Router` instances) — a name
that doesn't say what it constructs is worse than no comment at all.

## Status

Express app with security middleware (helmet, cors, pino request logging), a
`/health` endpoint, the initial database schema (`users`, `diet_plans`,
`meal_logs`, `meal_log_items`, `weight_entries` — matches
`../../organizational/application-overview.md`'s domain model), and
`POST /users` registration (argon2id password hashing, case-insensitive
duplicate-email rejection via Postgres `CITEXT`). Login/JWT auth and the
remaining domain endpoints land in follow-up issues (see milestone M3).
