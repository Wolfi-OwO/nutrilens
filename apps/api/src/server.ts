import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { config, validateConfig } from './config/index.ts';
import { errorHandler, notFound } from './middlewares/error-handler.ts';
import { healthRouter } from './routes/health.routes.ts';
import { usersRouter } from './routes/users.routes.ts';

// Refuse to start with missing required config (DATABASE_URL).
validateConfig();

const app = express();

app.use(helmet());
app.use(cors());
app.use(pinoHttp());
app.use(express.json());

app.use(healthRouter);
app.use(usersRouter);

// Must be mounted last: 404s for unmatched routes, then the centralized
// error handler for anything thrown or rejected upstream.
app.use(notFound);
app.use(errorHandler);

app.listen(config.port, () => {
    console.log(`apps/api listening on port ${config.port}`);
});
