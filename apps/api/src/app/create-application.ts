import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { getPool } from '../db/connection-pool.ts';
import { createHealthRoutes } from '../routes/health-routes.ts';
import { UserRepository } from '../users/user-repository.ts';
import { createUserRoutes } from '../users/user-routes.ts';
import { UserService } from '../users/user-service.ts';

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

    return app;
}
