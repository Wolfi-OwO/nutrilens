# Security Policy

## Supported versions

Nutrilens is early (0.x) — only the latest release is supported. Security
fixes land on `main` and ship in the next release; there is no long-term
support branch for older tags at this stage.

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Instead, report privately via GitHub's
[private vulnerability reporting](../../security/advisories/new), or email
<KoflerPhillip@outlook.com> with:

- a description of the issue and its impact,
- steps to reproduce or a proof of concept,
- any suggested remediation.

You can expect an acknowledgement within **72 hours** and a status update
within **7 days**. Please give a reasonable window to address the issue before
any public disclosure.

## Automated scanning

This project runs automated security tooling on every push and pull request,
and on a weekly schedule:

- **Secret scanning + push protection** (GitHub native) and **gitleaks** in CI
  — catches credentials before they land in history, not just after.
- **Trivy** — filesystem and container image vulnerability scanning (results
  in the Security tab).
- **CodeQL** — static analysis of the JavaScript/TypeScript and Python source.
- **Dependabot** — vulnerability alerts and automated security fix PRs, plus
  monthly version-update PRs and GitHub Actions updates.

## Secret rotation

| Secret | Where it lives | How it rotates |
| --- | --- | --- |
| `INTERNAL_SERVICE_TOKEN` | apps/api ↔ apps/ai-server | **Already rotates automatically** — `.github/workflows/release.yml` and `ci.yml` generate a fresh `openssl rand -hex 32` value on every deploy and set it on both Container Apps in the same rollout. Nothing to do manually. |
| `JWT_SECRET` | apps/api, signs every session token | Set `gh secret set` with a new `openssl rand -base64 48` value, redeploy. There is only one active secret — rotating it invalidates every existing session immediately (every logged-in user is signed out), so treat this as an incident-response action, not routine hygiene. |
| Database credentials | Azure Postgres Flexible Server | Rotate via `az postgres flexible-server update` (or the Portal), then update `DATABASE_URL` in the deploy pipeline's env and redeploy. Not currently on a schedule — rotate on suspected compromise or staff turnover. |
| OAuth client secrets (`GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_SECRET`) | GitHub Actions secrets (`OAUTH_*` prefix), see #153 | Generate a new secret in the provider's own console (GitHub app settings / Google Cloud Console / Entra app registration), `gh secret set OAUTH_<PROVIDER>_CLIENT_SECRET`, then cut a release — the old secret can be revoked in the provider's console once the new one is confirmed live. |
| ACR push credentials (`ACR_PUSH_USERNAME`/`ACR_PUSH_PASSWORD`) | GitHub Actions secrets, used only to push images | Regenerate via `az acr token credential generate`, update the GitHub secrets. Scoped to push-only, not full registry admin. |
| Azure deploy identity (`AZURE_CLIENT_ID`/`AZURE_TENANT_ID`/`AZURE_SUBSCRIPTION_ID`) | GitHub Actions secrets | These identify an OIDC federated credential, not a static secret — there is nothing to rotate; access is revoked by deleting the federated credential trust in Entra ID, not by issuing a new value. |

None of the above are on an automated rotation schedule except `INTERNAL_SERVICE_TOKEN`. Rotate the rest reactively (suspected exposure, offboarding) rather than on a calendar, since this is a small single-maintainer project without an on-call rotation to absorb scheduled-rotation risk.

## Handling of sensitive data

- **Secrets** (API keys, JWT signing keys, database credentials) live only in
  environment variables and are never committed. `.env` is git-ignored;
  `.env.example` documents the shape with placeholders.
- **Food photos** uploaded for AI detection are processed in memory by
  `apps/ai-server` and are not persisted there — see
  [README.md](README.md#why-a-two-server-architecture) for why that server
  holds no user data by design.
- **Logs** redact tokens, passwords, and authorization headers by default.
