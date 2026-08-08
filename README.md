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

`apps/api` and `apps/ai-server` are both live in early form: authentication,
diet plans, meal logging, weight tracking, OpenAPI docs, and structured
request validation on the API side; a working `/predict` endpoint backed by
a real food-recognition model (see
[ADR-0002](organizational/adr/0002-food-recognition-model.md)), with
structured logging and a verified sub-3-second p95 latency, on the AI-server
side. Both deploy automatically to a **staging** environment on every merge
to `main`; **production** deploys only on a published release (none cut
yet — the first is v0.0.1, once the production frontend below lands).

Still ahead: wiring the two servers together end-to-end (M5), the real
frontend (M6, currently only [`ui-prototype/`](ui-prototype/) — a static,
hardcoded-data walkthrough), observability (M7), hardening (M8), and an
admin dashboard (M9). See the
[issue tracker](../../issues) and [milestones](../../milestones) for
sequencing, and [`organizational/`](organizational/) for use cases, activity
diagrams, requirements, and ADRs.

## Stack

| Component | Stack |
| --- | --- |
| Frontend | React, Vite, TypeScript, Tailwind CSS (planned — M6) |
| API server | Node.js, TypeScript, Express, PostgreSQL, zod |
| AI server | Python, FastAPI, ONNX Runtime (food-recognition model) |
| Infra | Docker per service, Azure Container Apps (staging + production), shared ACR |

## Repository layout

```text
organizational/   Use cases, activity diagrams, requirements, ADRs, deploy docs
ui-prototype/     Hardcoded-data frontend prototype — no backend calls
apps/api/         Main application server (Node.js/TypeScript)
apps/ai-server/   Isolated AI-detection service (Python/FastAPI)
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
