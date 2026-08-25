# syntax=docker/dockerfile:1

# Builds from the monorepo root so npm workspaces resolves each app's
# dependencies the same way `npm ci` does locally — see apps/api/docker-compose.yml.
# Serves apps/frontend's built assets from apps/api itself (single Container
# App, mirrors portfolio-webpage's Express + client/dist pattern) rather than
# a second deployable — see apps/api/src/static-frontend.ts.

FROM node:22-alpine AS api-builder
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci --workspace=@nutrilens/api --include-workspace-root

COPY tsconfig.base.json ./
COPY apps/api apps/api
RUN npm run build --workspace=@nutrilens/api

FROM node:22-alpine AS frontend-builder
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm ci --workspace=@nutrilens/frontend --include-workspace-root

COPY tsconfig.base.json ./
COPY apps/frontend apps/frontend
# No VITE_API_BASE_URL here on purpose — see apps/frontend/src/lib/api-client.ts:
# unset resolves to same-origin at runtime, which is correct once apps/api
# serves this same build.
# Force rebuild to avoid stale build cache (issue #176)
RUN rm -rf apps/frontend/node_modules/.cache apps/frontend/.vite && npm run build --workspace=@nutrilens/frontend

FROM node:22-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci --workspace=@nutrilens/api --include-workspace-root --omit=dev

COPY --from=api-builder /repo/apps/api/dist apps/api/dist
COPY apps/api/database apps/api/database
COPY apps/api/scripts apps/api/scripts
COPY --from=frontend-builder /repo/apps/frontend/dist apps/api/public

# ═══════════════════════════════════════════════════════════════════════════
# OCI IMAGE METADATA — build args with defaults, overridable via --build-arg.
# Mirrors portfolio-webpage's dockerfile: LABELs are standard OCI metadata
# (readable via `docker inspect`); the ENV mirror exists because a running
# process can't read its own image's LABELs, and GET /version needs to.
# ═══════════════════════════════════════════════════════════════════════════
ARG APP_VERSION=dev
ARG VCS_REF=unknown
ARG BUILD_DATE
ARG APP_SOURCE="https://github.com/Wolfi-OwO/nutrilens"

LABEL org.opencontainers.image.title="nutrilens" \
    org.opencontainers.image.description="Meal logging with AI-assisted photo recognition" \
    org.opencontainers.image.vendor="Wolfi-OwO" \
    org.opencontainers.image.source="${APP_SOURCE}" \
    org.opencontainers.image.url="${APP_SOURCE}" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.version="${APP_VERSION}" \
    org.opencontainers.image.revision="${VCS_REF}" \
    org.opencontainers.image.created="${BUILD_DATE}"

ENV APP_VERSION=${APP_VERSION}
ENV APP_REVISION=${VCS_REF}
ENV APP_BUILD_DATE=${BUILD_DATE}
ENV APP_REPOSITORY_URL=${APP_SOURCE}

WORKDIR /repo/apps/api
EXPOSE 8080

# Health check probes for startup and liveness detection.
# Checks /health endpoint which requires the server to be running but no dependencies.
# Startup probe: give 30 seconds for migrations + server startup (30s initial delay, 
# then 3s interval × 10 attempts = 30s total before marking startup failed).
# Liveness probe: check every 10s with 2s timeout (separate from startup detection).
HEALTHCHECK --interval=3s --timeout=2s --start-period=60s --retries=10 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Applies pending migrations, then starts the server — so `docker compose up`
# alone is enough to get a working API against a fresh DB (issue #27).
CMD ["sh", "-c", "node scripts/run-migrations.mjs && node dist/server.js"]
