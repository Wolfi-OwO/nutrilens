import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Express } from 'express';
import { isApiPath } from './lib/api-path-segments.ts';

// The Dockerfile copies apps/frontend's built dist/ here (see apps/api/Dockerfile) —
// a sibling of dist/ (compiled) or src/ (typecheck-only), one level up from either.
const FRONTEND_DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

/**
 * Serves apps/frontend's built assets and falls back to index.html for
 * client-side routes, mirroring portfolio-webpage's Express + client/dist
 * pattern. A no-op if the built assets aren't present (local `npm run dev`
 * runs the frontend from its own Vite server instead — see
 * apps/frontend/.env.example's VITE_API_BASE_URL).
 *
 * Must be mounted after every API router and before `notFound`.
 */
export function mountFrontend(app: Express): void {
    if (!existsSync(FRONTEND_DIST)) {
        return;
    }

    app.use(express.static(FRONTEND_DIST, { index: false }));

    app.get(/.*/, (req, res, next) => {
        if (isApiPath(req.path)) {
            next();
            return;
        }
        res.sendFile(join(FRONTEND_DIST, 'index.html'));
    });
}
