import { Router } from 'express';

import { getPool } from '../database/connection.ts';
import { oauthCallbackHandler, oauthStartHandler } from '../handlers/oauth.handlers.ts';
import { asyncHandler } from '../lib/errors.ts';
import { configuredProviders } from '../lib/oauth-providers.ts';
import { AuthProviderRepository } from '../repository/auth-provider.repository.ts';
import { UserRepository } from '../repository/user.repository.ts';
import { OAuthService } from '../services/oauth-service.ts';

const userRepository = new UserRepository(getPool());
const authProviderRepository = new AuthProviderRepository(getPool());
const oauthService = new OAuthService(userRepository, authProviderRepository);

/** OAuth login endpoints (issue #153) — `/auth/:provider`, `/auth/:provider/callback`. */
export const oauthRouter = Router();

// Which providers to actually show as login options — a deployment with no
// Google credentials set shouldn't render a Google button that 404s.
oauthRouter.get('/auth/providers', (_req, res) => {
    res.status(200).json({ providers: configuredProviders() });
});

oauthRouter.get('/auth/:provider', oauthStartHandler());
oauthRouter.get('/auth/:provider/callback', asyncHandler(oauthCallbackHandler(oauthService)));
