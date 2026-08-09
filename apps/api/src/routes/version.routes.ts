import { Router } from 'express';

import { config } from '../config/index.ts';

/** The `/version` endpoint — build metadata for the frontend's footer. No dependencies, so no factory needed. */
export const versionRouter = Router();

versionRouter.get('/version', (_req, res) => {
    res.status(200).json(config.buildInfo);
});
