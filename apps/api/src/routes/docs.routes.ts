import helmet from 'helmet';
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

import { buildOpenApiDocument } from '../docs/openapi.ts';

const openApiDocument = buildOpenApiDocument();

/**
 * `/openapi.json` and interactive `/docs`. Only mounted in `app.ts` when
 * `!isProduction` (issue #26's "docs route disabled in production").
 */
export const docsRouter = Router();

docsRouter.get('/openapi.json', (_req, res) => {
    res.json(openApiDocument);
});

// The global helmet() in app.ts sets a CSP with no 'unsafe-inline', which
// blocks Swagger UI's bundled inline styles/scripts. Re-applying helmet here
// with a relaxed, docs-only CSP overwrites that header for this path without
// weakening it anywhere else.
docsRouter.use(
    '/docs',
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:'],
            },
        },
    }),
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument),
);
