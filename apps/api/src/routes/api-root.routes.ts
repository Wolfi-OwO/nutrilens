import { Router } from 'express';

import { isProduction } from '../config/index.ts';
import { apiRootLinks } from '../lib/hateoas.ts';

/**
 * `GET /api` — the HATEOAS discovery root (Richardson level 3). Routes here
 * aren't namespaced under `/api/*` (see lib/api-path-segments.ts), so this
 * one path is deliberately the exception: a fixed, memorable entry point a
 * client can start from without hard-coding every other route.
 *
 * Must be mounted after `apiRateLimiter` in app.ts, same as every other
 * route — `api` is registered in `API_PATH_SEGMENTS` precisely so this
 * doesn't skip the limiter and isn't swallowed by the SPA fallback.
 */
export const apiRootRouter = Router();

apiRootRouter.get('/api', (_req, res) => {
    res.status(200).json({ _links: apiRootLinks(!isProduction) });
});
