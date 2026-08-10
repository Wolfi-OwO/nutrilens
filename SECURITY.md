# Security Policy

## Supported versions

Nutrilens is early (0.0.x) — only the latest release is supported. Security
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

## Handling of sensitive data

- **Secrets** (API keys, JWT signing keys, database credentials) live only in
  environment variables and are never committed. `.env` is git-ignored;
  `.env.example` documents the shape with placeholders.
- **Food photos** uploaded for AI detection are processed in memory by
  `apps/ai-server` and are not persisted there — see
  [README.md](README.md#why-a-two-server-architecture) for why that server
  holds no user data by design.
- **Logs** redact tokens, passwords, and authorization headers by default.
