# @nutrilens/api

The main application server: authentication, diet plans, meal logs, and the
API the frontend talks to. Food-photo analysis is delegated to
`apps/ai-server` over an internal-only network path — see
`../../organizational/adr/0001-two-server-split.md`.

## Development

```bash
npm install
npm run dev         # watch mode, runs src/main.ts directly via type stripping
npm run build       # tsc -b tsconfig.build.json
npm run typecheck
npm test
```

## Status

Scaffold only: Express app with security middleware (helmet, cors, pino
request logging) and a `/health` endpoint. Auth, database access, and the
domain endpoints land in follow-up issues (see milestone M3).
