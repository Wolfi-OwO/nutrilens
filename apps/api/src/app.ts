import cors from 'cors';
import express from 'express';
import type { Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { isProduction } from './config/index.ts';
import { correlationId, logger } from './lib/logger.ts';
import { httpRequestDuration } from './lib/metrics.ts';
import { errorHandler, notFound } from './middlewares/error-handler.ts';
import { apiRateLimiter } from './middlewares/rate-limit.ts';
import { authRouter } from './routes/auth.routes.ts';
import { dietPlansRouter } from './routes/diet-plan.routes.ts';
import { docsRouter } from './routes/docs.routes.ts';
import { healthRouter } from './routes/health.routes.ts';
import { mealLogsRouter } from './routes/meal-log.routes.ts';
import { metricsRouter } from './routes/metrics.routes.ts';
import { oauthRouter } from './routes/oauth.routes.ts';
import { usersRouter } from './routes/users.routes.ts';
import { versionRouter } from './routes/version.routes.ts';
import { weightEntriesRouter } from './routes/weight-entry.routes.ts';
import { mountFrontend } from './static-frontend.ts';

/**
 * Builds the configured Express app — middleware and routes mounted, but
 * not listening. Split from server.ts so tests can exercise real HTTP
 * requests against it without a separate process or a fixed port.
 *
 * @returns The configured, not-yet-listening app.
 */
export function createApp(): Express {
    const app = express();

    app.use(helmet());
    app.use(cors());
    // issue #63: reuses an incoming X-Correlation-Id (set by a caller, or by
    // this same header on the way back to a client) rather than always
    // minting a fresh id, so a request that already carries one traces
    // end-to-end instead of getting a new id at every hop.
    app.use(pinoHttp({ logger, genReqId: (req) => correlationId(req.headers) }));
    app.use(express.json());

    // issue #64: observes every request's latency, labeled once the router
    // has matched it to a route pattern (req.route), not the raw path — so
    // /users/<uuid> and /users/<other-uuid> are one time series, not one
    // per user. Mounted before the rate limiter for the same reason
    // healthRouter is: a Prometheus scraper polling every few seconds is
    // not the traffic that limiter exists to catch.
    app.use((req, res, next) => {
        const stop = httpRequestDuration.startTimer();
        res.on('finish', () => {
            // req.route is typed `any` by @types/express — narrowed here
            // rather than trusted, since an unmatched request (a 404) never
            // gets one and req.path is the honest fallback for it.
            const route = req.route as { path?: string } | undefined;
            stop({
                method: req.method,
                route: route?.path ?? req.path,
                status_code: res.statusCode,
            });
        });
        next();
    });
    app.use(metricsRouter);

    // Mounted before every other route, so an orchestrator's liveness probe
    // (healthRouter, below) is the only endpoint exempt from the app-wide cap.
    app.use(healthRouter);
    app.use(apiRateLimiter);

    // Interactive API docs (issue #26): dev/staging convenience only, never
    // reachable when NODE_ENV=production.
    if (!isProduction) {
        app.use(docsRouter);
    }

    app.use(versionRouter);
    app.use(authRouter);
    app.use(oauthRouter);
    app.use(usersRouter);
    app.use(dietPlansRouter);
    app.use(mealLogsRouter);
    app.use(weightEntriesRouter);

    // apps/frontend's built assets (a no-op if they're not present — see
    // static-frontend.ts). Must come after every API router: it falls back
    // to index.html for anything not already matched above.
    mountFrontend(app);

    // Must be mounted last: 404s for unmatched routes, then the centralized
    // error handler for anything thrown or rejected upstream.
    app.use(notFound);
    app.use(errorHandler);

    return app;
}
