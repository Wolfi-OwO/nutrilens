import { Router } from 'express';

/** @returns A router mounting the `/health` liveness endpoint. */
export function createHealthRoutes(): Router {
    const router = Router();

    router.get('/health', (_req, res) => {
        res.status(200).json({ status: 'ok' });
    });

    return router;
}
