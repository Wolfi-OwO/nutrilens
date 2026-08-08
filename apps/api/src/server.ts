import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { config, validateConfig } from './config/index.ts';
import { errorHandler, notFound } from './middlewares/error-handler.ts';
import { apiRateLimiter } from './middlewares/rate-limit.ts';
import { authRouter } from './routes/auth.routes.ts';
import { dietPlansRouter } from './routes/diet-plan.routes.ts';
import { healthRouter } from './routes/health.routes.ts';
import { mealLogsRouter } from './routes/meal-log.routes.ts';
import { usersRouter } from './routes/users.routes.ts';
import { weightEntriesRouter } from './routes/weight-entry.routes.ts';

// Refuse to start with missing required config (DATABASE_URL).
validateConfig();

const app = express();

app.use(helmet());
app.use(cors());
app.use(pinoHttp());
app.use(express.json());

// Mounted before every other route, so an orchestrator's liveness probe
// (healthRouter, below) is the only endpoint exempt from the app-wide cap.
app.use(healthRouter);
app.use(apiRateLimiter);
app.use(authRouter);
app.use(usersRouter);
app.use(dietPlansRouter);
app.use(mealLogsRouter);
app.use(weightEntriesRouter);

// Must be mounted last: 404s for unmatched routes, then the centralized
// error handler for anything thrown or rejected upstream.
app.use(notFound);
app.use(errorHandler);

app.listen(config.port, () => {
    console.log(`apps/api listening on port ${config.port}`);
});
