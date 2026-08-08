# syntax=docker/dockerfile:1

# Builds from the monorepo root so npm workspaces resolves apps/api's
# dependencies the same way `npm ci` does locally — see apps/api/docker-compose.yml.

FROM node:22-alpine AS builder
WORKDIR /repo

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci --workspace=@nutrilens/api --include-workspace-root

COPY tsconfig.base.json ./
COPY apps/api apps/api
RUN npm run build --workspace=@nutrilens/api

FROM node:22-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci --workspace=@nutrilens/api --include-workspace-root --omit=dev

COPY --from=builder /repo/apps/api/dist apps/api/dist
COPY apps/api/database apps/api/database
COPY apps/api/scripts apps/api/scripts

WORKDIR /repo/apps/api
EXPOSE 8080

# Applies pending migrations, then starts the server — so `docker compose up`
# alone is enough to get a working API against a fresh DB (issue #27).
CMD ["sh", "-c", "node scripts/run-migrations.mjs && node dist/server.js"]
