# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/) once a
first release is cut.

## [Unreleased]

## [0.7.2] - 2026-08-27

- fix(api): escape user input before it reaches ILIKE and the rank regex ([#205](https://github.com/Wolfi-OwO/nutrilens/pull/205))

- fix(dashboard): bind the hydration bar to its actual value ([#204](https://github.com/Wolfi-OwO/nutrilens/pull/204))

## [0.7.1] - 2026-08-27

- fix(db): guard postgis creation for unprivileged roles ([#202](https://github.com/Wolfi-OwO/nutrilens/pull/202))

## [0.7.0] - 2026-08-26

- Fix: Remove unnecessary approval gate from CI workflow ([#196](https://github.com/Wolfi-OwO/nutrilens/pull/196))

- Design: Self-host fonts (EU compliance) + clarify OAuth data transfers ([#192](https://github.com/Wolfi-OwO/nutrilens/pull/192))

- Issue #190: Add Barcode Support to Food Catalog ([#193](https://github.com/Wolfi-OwO/nutrilens/pull/193))

- Issue #184: Create Discounter & Store Location Tables (PostGIS Schema) ([#195](https://github.com/Wolfi-OwO/nutrilens/pull/195))

- docs: record legal compliance work under the 0.6.0 changelog entry ([#183](https://github.com/Wolfi-OwO/nutrilens/pull/183))

- fix: unblock e2e — survive the Postgres init restart at container startup, pin `sslmode=verify-full`, and add `robots.txt`/`sitemap.xml` ([#200](https://github.com/Wolfi-OwO/nutrilens/pull/200))

- Extend the deploy-probe health-check timeout from 5 to 10 minutes ([#198](https://github.com/Wolfi-OwO/nutrilens/pull/198))

- Fix: Increase Docker HEALTHCHECK start-period for e2e stability ([#197](https://github.com/Wolfi-OwO/nutrilens/pull/197))

## [0.6.0] - 2026-08-23

- feat: complete UI/UX redesign v0.6.0 ([#181](https://github.com/Wolfi-OwO/nutrilens/pull/181))
- Legal compliance: PRIVACY, IMPRESSUM and TERMS_OF_USE documents, a GDPR/DSGVO compliance checklist, footer legal links, and a cookie-consent banner ([#182](https://github.com/Wolfi-OwO/nutrilens/pull/182))

## [0.5.0] - 2026-08-15

- feat(ui): NutriLens visual and UX modernization — new wellness color palette (mint & navy/slate replacing warm paper/brown tokens, verified WCAG contrast), modern desktop top navigation and mobile bottom tab bar (sidebar removed), interactive first-time onboarding with persistent completion state, and a redesign of the dashboard, progress, meal logging, and authentication pages ([#180](https://github.com/Wolfi-OwO/nutrilens/pull/180))

## [0.4.1] - 2026-08-15

- fix(api): use request origin for OAuth callback redirects ([#178](https://github.com/Wolfi-OwO/nutrilens/pull/178))

## [0.4.0] - 2026-08-15

- feat(frontend): overhaul visual design, navigation, and onboarding ([#177](https://github.com/Wolfi-OwO/nutrilens/pull/177))
- ui/ux: add motion tokens, gradient tokens, skeleton improvements, enhanced button states ([#176](https://github.com/Wolfi-OwO/nutrilens/pull/176))

- Use a uniform 0-5 replica range and require explicit revision suffixes ([#173](https://github.com/Wolfi-OwO/nutrilens/pull/173))
- Improved loading state skeletons to match the final layout on the dashboard (stage-specific for diet plan and meal logs)
- Replaced the analyzing-stage Loader2 spinner with a skeleton of the meal form on log-meal
- Verified existing skeletons on progress, plan, and profile pages are adequate
- Confirmed motion tokens, animation classes, and reduced-motion handling follow ui-ux-pro-max guidelines
- Verified 4.5:1 contrast ratios and 44px+ touch targets
- Modified apps/frontend/src/pages/dashboard.tsx and apps/frontend/src/pages/log-meal.tsx

## [0.3.0] - 2026-08-12

- Add profile page with avatar upload; redesign frontend around an editorial direction ([#171](https://github.com/Wolfi-OwO/nutrilens/pull/171))

- Redesign sidebar/avatar/typography for enterprise feel ([#170](https://github.com/Wolfi-OwO/nutrilens/pull/170))

## [0.2.2] - 2026-08-11

- Fix OAuth redirect_uri using http:// in production ([#168](https://github.com/Wolfi-OwO/nutrilens/pull/168))

- Add skeleton loaders and tune query cache lifetimes ([#167](https://github.com/Wolfi-OwO/nutrilens/pull/167))

## [0.2.1] - 2026-08-11

- Rework frontend design: vibrant palette, pinned full-width footer ([#165](https://github.com/Wolfi-OwO/nutrilens/pull/165))

- Wire OAuth env vars through docker-compose for local dev ([#164](https://github.com/Wolfi-OwO/nutrilens/pull/164))

- Fix AI_SERVER_URL silently inheriting a stale revision hostname ([#163](https://github.com/Wolfi-OwO/nutrilens/pull/163))

- Automate CHANGELOG.md Unreleased upkeep ([#162](https://github.com/Wolfi-OwO/nutrilens/pull/162))

## [0.2.0] - 2026-08-11

### Added

- Admin dashboard: platform-wide stats overview, a searchable/paginated
  user table with inline role and status changes, and an audit log of
  every role/status change, gated behind a dedicated admin-only shell
  ([#99-108](https://github.com/Wolfi-OwO/nutrilens/milestone/9)). Backed
  by a transactional guard that refuses to demote or suspend the last
  active admin account.
- Structured JSON logging (pino / Python stdlib logging) with a shared
  `X-Correlation-Id` propagated end-to-end across apps/api and
  apps/ai-server, and Prometheus metrics
  (`http_request_duration_seconds`) exposed for request rate, latency,
  and error-rate dashboards
  ([#61-64, #68](https://github.com/Wolfi-OwO/nutrilens/milestone/7)).
- Documented secrets-rotation runbook, a tested database backup/restore
  procedure, and this changelog/versioning policy
  ([#72, #73, #75, #76](https://github.com/Wolfi-OwO/nutrilens/milestone/8)).

### Fixed

- **Critical:** the OAuth login callback (`/auth/callback`) was shadowed
  by the backend's own `GET /auth/:provider` route — a real browser
  redirect there hit a 404 JSON error instead of the frontend, meaning
  Google and Microsoft logins never completed in production. Moved to
  `/oauth/callback`, which can't collide with any `/auth/*` backend
  route.
- `ui-prototype`'s transitive `nanoid` advisory.

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
