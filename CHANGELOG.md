# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/) once a
first release is cut.

## [Unreleased]

## [0.1.0] - 2026-08-10

### Added

- OAuth login via GitHub, Google, and Microsoft, alongside email/password
  ([#153](https://github.com/Wolfi-OwO/nutrilens/issues/153)). Login/register
  gain per-provider buttons; account linking only trusts a
  provider-verified email.

### Security

- Full NFR-SEC-01..08 review: service-to-service auth between apps/api and
  apps/ai-server (`X-Internal-Service-Token`), EXIF/GPS stripping on
  uploaded meal photos before they leave apps/api, and Dependabot
  vulnerability alerts + automated security-fix PRs enabled repository-wide
  ([#69](https://github.com/Wolfi-OwO/nutrilens/issues/69)).
- Dependency audit: 0 known vulnerabilities across apps/api, apps/frontend,
  and apps/ai-server; ui-prototype's one transitive finding fixed
  ([#70](https://github.com/Wolfi-OwO/nutrilens/issues/70)).

## [0.0.1] - 2026-08-10

Initial release: production frontend (dashboard, meal logging with
AI-powered photo classification, diet plans, weight tracking), the
apps/api + apps/ai-server backend, and the Azure Container Apps deployment
pipeline.
