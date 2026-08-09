<div align="center">

# nutrilens

AI-assisted nutrition tracking. Point a phone camera at a meal, get a
food-recognition prediction back in seconds, and track it against a
personal diet plan — without typing a food diary by hand.

[![CI](https://github.com/Wolfi-OwO/nutrilens/actions/workflows/ci.yml/badge.svg)](https://github.com/Wolfi-OwO/nutrilens/actions/workflows/ci.yml)
[![Security](https://github.com/Wolfi-OwO/nutrilens/actions/workflows/security.yml/badge.svg)](https://github.com/Wolfi-OwO/nutrilens/actions/workflows/security.yml)
[![Release](https://img.shields.io/github/v/release/Wolfi-OwO/nutrilens?label=release&color=blue)](https://github.com/Wolfi-OwO/nutrilens/releases/latest)
[![Contributors](https://img.shields.io/github/contributors/Wolfi-OwO/nutrilens)](https://github.com/Wolfi-OwO/nutrilens/graphs/contributors)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

[![apps/api coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Wolfi-OwO/nutrilens/main/.github/badges/api-coverage.json)](./apps/api)
[![apps/ai-server coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/Wolfi-OwO/nutrilens/main/.github/badges/ai-server-coverage.json)](./apps/ai-server)

![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![Node](https://img.shields.io/badge/Node-%E2%89%A522-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![ONNX Runtime](https://img.shields.io/badge/ONNX_Runtime-inference-000000?logo=onnx&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-per_service-2496ED?logo=docker&logoColor=white)
![Azure](https://img.shields.io/badge/Azure-Container_Apps-0078D4?logo=microsoftazure&logoColor=white)

</div>

## Why a two-server architecture

Nutrilens is deliberately split into two independently deployable services
(see [ADR-0001](organizational/adr/0001-two-server-split.md)):

- **`apps/api`** — the primary application server (Node.js/TypeScript,
  Express, PostgreSQL). Owns users, authentication, diet plans, meal logs,
  and all persistent data.
- **`apps/ai-server`** — a standalone AI-detection service (Python/FastAPI,
  ONNX Runtime). Owns nothing but inference: it receives a food photo,
  returns a structured prediction, and holds no user data of its own — no
  database, no persisted images, no logs containing image content (see
  [`apps/ai-server/API.md`](apps/ai-server/API.md)).

The API server is the only caller of the AI server, over an internal network
segment the AI server cannot be reached from publicly. A vulnerability or a
compromised dependency in the inference stack (a much larger, faster-moving
set of ML packages) is contained to a service that has no database
credentials, no user PII, and no session state. This mirrors the separation
used across this account's projects for stack isolation (see
[`cli-image-upscaler`](https://github.com/Wolfi-OwO/cli-image-upscaler) for
the same principle applied to a single binary's AI extras).

## Status

The full app is live end to end: register/login, a dashboard, photo-based
meal logging (AI prediction with a manual-entry fallback), diet-plan setup,
and a weight/calorie progress view, all calling a real `apps/api` backed by
PostgreSQL. A food photo goes to `apps/ai-server` — a real food-recognition
model (see
[ADR-0002](organizational/adr/0002-food-recognition-model.md)) behind a
timeout/retry/circuit-breaker policy (see
[ADR-0003](organizational/adr/0003-ai-server-client-contract.md)), so an
AI-server outage degrades to manual meal logging rather than blocking the
user.

`apps/api` (serving the built `apps/frontend` from the same container) and
`apps/ai-server` each run as one Azure Container App in multiple-revision
mode: every push to `main` lands an inactive-traffic "test" revision for
manual verification, and every published release health-checks a new
revision before cutting production traffic over to it — see
[`organizational/deploy/azure-container-apps.md`](organizational/deploy/azure-container-apps.md).

[`ui-prototype/`](ui-prototype/) is retired — a static, hardcoded-data
walkthrough kept only as a historical reference for the original design
pass; every page it mocked is now a real, backend-wired page under
`apps/frontend`. Still ahead: observability (M7), a hardening pass (M8), and
an admin dashboard (M9) — none of it required for the app to work, all of it
scoped as post-v0.0.1 follow-up. See the [issue tracker](../../issues) and
[milestones](../../milestones) for sequencing, and
[`organizational/`](organizational/) for use cases, activity diagrams,
requirements, and ADRs.

## Stack

| Component | Stack |
| --- | --- |
| Frontend | React, Vite, TypeScript, Tailwind CSS, React Router, TanStack Query |
| API server | Node.js, TypeScript, Express, PostgreSQL, zod |
| AI server | Python, FastAPI, ONNX Runtime (food-recognition model) |
| Infra | Docker per service, Azure Container Apps (staging + production), shared ACR |

## Repository layout

```text
organizational/   Use cases, activity diagrams, requirements, ADRs, deploy docs
ui-prototype/     Retired — historical, hardcoded-data prototype, no backend calls
apps/frontend/    Production frontend (React/Vite/TypeScript)
apps/api/         Main application server (Node.js/TypeScript)
apps/ai-server/   Isolated AI-detection service (Python/FastAPI)
```

## Development

```bash
cp .env.example .env
docker compose up
```

Brings up Postgres, `apps/api` (migrated and listening on :8080), and
`apps/ai-server` (internal-only, no published port — reachable from `apps/api`
as `http://ai-server:8000`) together. Each service also has its own
`docker-compose.yml` for developing it in isolation
(`apps/api/docker-compose.yml`, `apps/ai-server/docker-compose.yml`).

`apps/frontend` isn't containerized yet — run it separately:

```bash
cp apps/frontend/.env.example apps/frontend/.env
npm run dev --workspace=@nutrilens/frontend
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). `main` is protected — all changes
land through a pull request from a branch created off an issue, gated on CI
(lint, typecheck, tests, coverage thresholds), CodeQL, Trivy, and secret
scanning all passing.

## Security

See [SECURITY.md](SECURITY.md) for how to report a vulnerability.

## License

[MIT](LICENSE)
