import { Router } from 'express';

import { config } from '../config/index.ts';
import { asyncHandler, UnauthorizedError } from '../lib/errors.ts';
import { registry } from '../lib/metrics.ts';

const BEARER_PREFIX = 'Bearer ';

/**
 * `GET /metrics` — Prometheus scrape endpoint (issue #64).
 *
 * Access-restricted the same way apps/ai-server's `/predict` is (see
 * `verify_internal_service_token` in predict_routes.py): an optional shared
 * token, checked when set, a no-op when it isn't (local dev, CI). A
 * Prometheus scraper has no user session to present, so this can't reuse
 * `requireAuth` — a static bearer token is the equivalent defense here, and
 * a standard `Authorization: Bearer` (not a custom header) is what
 * Prometheus's own `authorization:` scrape-config block sends natively —
 * see organizational/deploy/prometheus-scrape-config.yml.
 */
export const metricsRouter = Router();

metricsRouter.get(
    '/metrics',
    asyncHandler(async (req, res) => {
        if (config.metricsToken) {
            const header = req.header('authorization');
            const token = header?.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length) : undefined;
            if (token !== config.metricsToken) {
                throw new UnauthorizedError('Missing or invalid metrics token.');
            }
        }
        const body = await registry.metrics();
        res.set('Content-Type', registry.contentType);
        res.status(200).send(body);
    }),
);
