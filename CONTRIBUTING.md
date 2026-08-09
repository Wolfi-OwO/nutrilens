# Contributing to nutrilens

Thanks for your interest in improving nutrilens. This project is maintained
to enterprise standards; the bar for changes is high and the tooling enforces
most of it.

## Workflow — branches only come from issues

`main` is protected: no direct pushes, no force-pushes, no branch deletion.
Every change starts from an issue.

1. Pick or open an [issue](../../issues) — use the bug report or feature
   request template. Issues carry `type:*`, `area:*`, and `priority:*` labels;
   apply the ones that fit if you're filing a new one.
2. Create a branch from the issue (GitHub's "Create a branch" action on the
   issue sidebar, or `git checkout -b <type>/<short-description>`). Branch
   prefixes match the label: `feature/`, `bugfix/`, `docs/`, `chore/`,
   `security/`.
3. Make your change, with tests where behaviour changes.
4. Open a pull request against `main` using the PR template, and link it to
   the issue (`Closes #123`).
5. CI must pass (lint, type-check, build, test) and the change needs one
   approving review before merge. Stale approvals are dismissed on new
   pushes, and unresolved review threads block merge.

## Getting set up

Setup instructions live per-component, since the repo hosts three independent
pieces (API server, AI server, frontend):

- `apps/api/README.md` — main API server (Node.js/TypeScript)
- `apps/ai-server/README.md` — AI-detection server (Python/FastAPI)
- `ui-prototype/README.md` — static frontend prototype (no backend)

Until an issue introduces a given component, its README won't exist yet —
check the [milestones](../../milestones) for what's currently in scope.

## Ground rules

- **No secrets, no user media in git. Ever.** Secret scanning runs on every
  push; a caught secret blocks the merge, not just a warning.
- **Explicit names, no abbreviations** — `authenticationService`, not
  `authSvc`.
- **The AI server holds no user data.** It receives an image, returns a
  prediction, keeps nothing. Do not add persistence to `apps/ai-server`
  without an ADR justifying the exception — see [README.md](README.md#why-a-two-server-architecture).
- **Tests accompany behaviour.** New use cases ship with tests.
- **Conventional, imperative commit messages** (e.g. `add meal-log pagination`).
- **Refresh the coverage badges** (`./scripts/update-coverage-badges.sh`) as
  part of any PR that changes `apps/api` or `apps/ai-server`, and commit the
  result. CI gates on coverage already (see NFR-OBS-02) — this just keeps
  the README's numbers honest. It's a manual step, not automatic on merge:
  main's branch protection blocks CI from pushing to it directly.

## Reporting bugs / requesting features

Use the [issue templates](../../issues/new/choose). For security
vulnerabilities, do **not** open a public issue — see [SECURITY.md](SECURITY.md).

By contributing you agree that your contributions are licensed under the
project's [MIT License](LICENSE) and that you abide by our
[Code of Conduct](CODE_OF_CONDUCT.md).
