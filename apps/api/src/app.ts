import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { getPool } from './database/connection.ts';
import { UserRepository } from './database/user-repository.ts';
import { errorHandler, notFound } from './middlewares/error-handler.ts';
import { createHealthRoutes } from './routes/health.routes.ts';
import { createUserRoutes } from './routes/users.routes.ts';
import { UserService } from './services/user-service.ts';

/**
 * Builds and returns the configured app (middleware, routes mounted) but
 * does NOT call .listen() — that's main.ts's job, so tests can import the
 * app without starting a real server.
 *
 * @returns The configured Express application.
 */
export function createApplication(): Express {
    const app = express();

    app.use(helmet());
    app.use(cors());
    app.use(pinoHttp());
    app.use(express.json());

    app.use(createHealthRoutes());

    const userRepository = new UserRepository(getPool());
    const userService = new UserService(userRepository);
    app.use(createUserRoutes(userService));

    // Must be mounted last: 404s for unmatched routes, then the centralized
    // error handler for anything thrown or rejected upstream.
    app.use(notFound);
    app.use(errorHandler);

    return app;
}
