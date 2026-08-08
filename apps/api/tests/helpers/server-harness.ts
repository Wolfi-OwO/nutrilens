import { createServer } from 'node:http';
import type { Server } from 'node:http';

import { createApp } from '../../src/app.ts';

export interface TestServer {
    baseUrl: string;
    close: () => Promise<void>;
}

/**
 * Starts `createApp()`'s Express app on an ephemeral port. Each call binds
 * a fresh server, so test files can run concurrently without port
 * collisions — `DATABASE_URL`/`JWT_SECRET` must already be set in the
 * environment (see package.json's `test` script) before this is called,
 * since the route modules resolve the connection pool at import time.
 *
 * @returns The bound server's base URL and a matching close function.
 */
export async function startTestServer(): Promise<TestServer> {
    const app = createApp();
    const server: Server = createServer(app);

    await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', resolve);
    });

    const address = server.address();
    if (typeof address !== 'object' || address === null) {
        throw new Error('Test server failed to bind to a port.');
    }

    return {
        baseUrl: `http://127.0.0.1:${String(address.port)}`,
        close: () =>
            new Promise<void>((resolve, reject) => {
                server.close((error) => {
                    if (error) reject(error);
                    else resolve();
                });
            }),
    };
}
