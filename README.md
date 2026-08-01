# nutrilens

AI-assisted nutrition tracking. Point a phone camera at a meal, get a
calorie/macro estimate back in seconds, and track it against a personal diet
plan — without typing a food diary by hand.

## Why a two-server architecture

Nutrilens is deliberately split into two independently deployable services:

- **`apps/api`** — the primary application server (Node.js/TypeScript).
  Owns users, authentication, diet plans, meal logs, and all persistent data.
- **`apps/ai-server`** — a standalone AI-detection service (Python/FastAPI).
  Owns nothing but inference: it receives a food photo, returns a structured
  prediction (identified items, estimated portion, macro/calorie estimate),
  and holds no user data of its own.

The API server is the only caller of the AI server, over an internal network
segment the AI server cannot reach outward from. A vulnerability or a
compromised dependency in the inference stack (which pulls in a much larger,
faster-moving set of ML packages) is contained to a service that has no
database credentials, no user PII, and no session state — it cannot pivot to
the primary datastore. This mirrors the separation already used across this
account's projects for stack isolation (see [`cli-image-upscaler`](https://github.com/Wolfi-OwO/cli-image-upscaler)
for the same principle applied to a single binary's AI extras).

## Status

Early design phase. See [`organizational/`](organizational/) for use cases,
activity diagrams, and requirements, and [`ui-prototype/`](ui-prototype/) for
a static, hardcoded-data walkthrough of the intended frontend. Neither
`apps/api` nor `apps/ai-server` exist yet — they are built out issue by issue;
see the [issue tracker](../../issues) and [milestones](../../milestones) for
sequencing.

## Planned stack

| Component    | Stack                                             |
| ------------ | -------------------------------------------------- |
| Frontend     | React, Vite, TypeScript, Tailwind CSS               |
| API server   | Node.js, TypeScript, Express, PostgreSQL            |
| AI server    | Python, FastAPI, PyTorch (food recognition model)   |
| Infra        | Docker Compose (dev), separate containers per service |

## Repository layout

```
organizational/   Use cases, activity diagrams, requirements, architecture notes
ui-prototype/     Hardcoded-data frontend prototype — no backend calls
apps/             Real application code (added incrementally via issues)
docs/             ADRs and reference documentation (added as decisions are made)
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). `main` is protected — all changes land
through a pull request from a branch created off an issue.

## Security

See [SECURITY.md](SECURITY.md) for how to report a vulnerability.

## License

[MIT](LICENSE)
