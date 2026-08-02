import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { createHealthRoutes } from '../routes/health-routes.ts';

export function createApplication(): Express {
    const app = express();

    app.use(helmet());
    app.use(cors());
    app.use(pinoHttp());
    app.use(express.json());

    app.use(createHealthRoutes());

    return app;
}
