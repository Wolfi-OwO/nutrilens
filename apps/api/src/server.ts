import { createApp } from './app.ts';
import { config, validateConfig } from './config/index.ts';

// Refuse to start with missing required config (DATABASE_URL).
validateConfig();

const app = createApp();

app.listen(config.port, () => {
    console.log(`apps/api listening on port ${config.port}`);
});
