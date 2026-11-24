import { Router } from 'express';

import { config } from '../config/index.ts';
import { versionLinks, withLinks } from '../lib/hateoas.ts';

/**
 * Build metadata for the frontend's footer. `/api/info` is the path every app of the stack answers (name, version,
 * revision, buildDate, repositoryUrl); `/version` stays for what already reads it. No dependencies, so no factory needed.
 */
export const versionRouter = Router();

versionRouter.get(['/api/info', '/version'], (_req, res) => {
    res.status(200).json(withLinks(config.buildInfo, versionLinks()));
});
