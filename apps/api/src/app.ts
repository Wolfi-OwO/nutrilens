import cors from 'cors';
import express from 'express';
import type { Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { isProduction } from './config/index.ts';
import { errorHandler, notFound } from './middlewares/error-handler.ts';
import { apiRateLimiter } from './middlewares/rate-limit.ts';
import { authRouter } from './routes/auth.routes.ts';
import { dietPlansRouter } from './routes/diet-plan.routes.ts';
import { docsRouter } from './routes/docs.routes.ts';
import { healthRouter } from './routes/health.routes.ts';
import { mealLogsRouter } from './routes/meal-log.routes.ts';
import { usersRouter } from './routes/users.routes.ts';
import { weightEntriesRouter } from './routes/weight-entry.routes.ts';

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
    app.use(pinoHttp());
    app.use(express.json());

    // Mounted before every other route, so an orchestrator's liveness probe
    // (healthRouter, below) is the only endpoint exempt from the app-wide cap.
    app.use(healthRouter);
    app.use(apiRateLimiter);

    // Interactive API docs (issue #26): dev/staging convenience only, never
    // reachable when NODE_ENV=production.
    if (!isProduction) {
        app.use(docsRouter);
    }

    app.use(authRouter);
    app.use(usersRouter);
    app.use(dietPlansRouter);
    app.use(mealLogsRouter);
    app.use(weightEntriesRouter);

    // Must be mounted last: 404s for unmatched routes, then the centralized
    // error handler for anything thrown or rejected upstream.
    app.use(notFound);
    app.use(errorHandler);

    return app;
}
