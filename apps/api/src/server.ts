import { createApp } from './app.ts';
import { config, validateConfig } from './config/index.ts';
import { logger } from './lib/logger.ts';

// Refuse to start with missing required config (DATABASE_URL).
validateConfig();

const app = createApp();

app.listen(config.port, () => {
    logger.info({ port: config.port }, 'apps/api listening');
});
