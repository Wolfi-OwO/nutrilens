import { Router } from 'express';

/** The `/health` liveness endpoint. No dependencies, so no factory needed. */
export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
});
