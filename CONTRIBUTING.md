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

## Versioning and releases

nutrilens follows [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`.
While the major version is `0`, treat `MINOR` as the breaking-change slot and
`PATCH` as the safe one — the same convention SemVer itself recommends for
`0.x`:

- **PATCH** (`0.1.0` → `0.1.1`): bug fixes, dependency bumps, docs, anything
  that doesn't change behaviour a caller could depend on.
- **MINOR** (`0.1.0` → `0.2.0`): new features, additive API surface (new
  endpoints, new optional fields), anything that could still break a caller
  relying on undocumented behaviour.
- **MAJOR**: reserved for `1.0.0` once the API is considered stable — no
  `0.x` release changes it.

Every PR gets a one-line `CHANGELOG.md` entry under `## [Unreleased]`
automatically — `.github/workflows/changelog-unreleased.yml` pushes it to
the PR's own branch on open/sync, using the PR title, so it rides along
with the normal review instead of being a separate step anyone has to
remember. If the auto-generated line doesn't say enough, edit it in the PR
like any other line — the workflow only adds an entry when one referencing
that PR number isn't already present, so a hand-edit sticks.

To cut a release:

1. `node scripts/cut-release.mjs X.Y.Z` — moves the accumulated
   `Unreleased` entries under a new `## [X.Y.Z] - YYYY-MM-DD` heading
   (re-adding an empty `Unreleased` above it), and bumps the version in
   `package.json`, `apps/api/package.json`, and
   `apps/ai-server/pyproject.toml`. Refuses to run if `Unreleased` is
   empty. Review the diff — group entries under `Added`/`Changed`/`Fixed`/
   `Security` per [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
   by hand if the flat list needs it — then open it as a normal PR (same
   branch protection as anything else):

   ```sh
   git checkout -b release-X.Y.Z
   git add -A && git commit -m "Release vX.Y.Z"
   git push -u origin release-X.Y.Z
   gh pr create --title "Release vX.Y.Z" --fill
   ```

2. Once merged, `gh release create vX.Y.Z --title vX.Y.Z --generate-notes`
   (or the GitHub UI). Publishing the release is what triggers
   `.github/workflows/release.yml` — it builds both images, pushes them to
   `globalcr01`, and rolls each Azure Container App onto the new tag behind
   the `production` environment's manual approval gate.
3. Ship small, frequent releases rather than batching unrelated work into
   one — a release is a rollout unit, not a project milestone. A security
   fix and an unrelated feature landing the same week are two releases, not
   one.

## Reporting bugs / requesting features

Use the [issue templates](../../issues/new/choose). For security
vulnerabilities, do **not** open a public issue — see [SECURITY.md](SECURITY.md).

By contributing you agree that your contributions are licensed under the
project's [MIT License](LICENSE) and that you abide by our
[Code of Conduct](CODE_OF_CONDUCT.md).
