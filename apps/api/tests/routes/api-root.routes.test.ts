import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import type { TestServer } from '../helpers/server-harness.ts';
import { startTestServer } from '../helpers/server-harness.ts';

describe('GET /api', () => {
    let server: TestServer;

    before(async () => {
        server = await startTestServer();
    });

    after(async () => {
        await server.close();
    });

    test('answers 200 with a self link pointing at /api', async () => {
        const response = await fetch(`${server.baseUrl}/api`);
        assert.equal(response.status, 200);
        const body = (await response.json()) as { _links: { self: { href: string } } };
        assert.equal(body._links.self.href, '/api');
    });

    test('HEAD /api answers 200 with an empty body', async () => {
        const response = await fetch(`${server.baseUrl}/api`, { method: 'HEAD' });
        assert.equal(response.status, 200);
        assert.equal((await response.text()).length, 0);
    });
});

// `isProduction` (config/index.ts) is read once at module-import time, and
// so is docsRouter's mount gate in app.ts — flipping process.env.NODE_ENV
// mid-test on this same process wouldn't touch either, since both already
// ran at the top-level import that happened before this test file's first
// line. A real child process, started with NODE_ENV=production from the
// start, is the only way to exercise that branch honestly.
describe('GET /api in production', () => {
    test('omits the docs/openapi links', async () => {
        const script = `
            import { createApp } from './src/app.ts';
            import { createServer } from 'node:http';
            const server = createServer(createApp());
            await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
            const { port } = server.address();
            const response = await fetch('http://127.0.0.1:' + port + '/api');
            process.stdout.write(await response.text());
            server.close();
        `;
        const { execFileSync } = await import('node:child_process');
        const output = execFileSync(
            process.execPath,
            ['--experimental-strip-types', '--input-type=module', '-e', script],
            {
                cwd: new URL('../..', import.meta.url),
                // pino-http logs every request to the same stdout this test
                // reads the JSON response from — silenced so the child's
                // only output is the fetch body this test parses.
                env: { ...process.env, NODE_ENV: 'production', LOG_LEVEL: 'silent' },
            },
        ).toString();

        const body = JSON.parse(output) as { _links: Record<string, unknown> };
        assert.equal(body._links.docs, undefined);
        assert.equal(body._links.openapi, undefined);
    });
});
