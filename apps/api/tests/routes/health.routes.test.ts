import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import type { TestServer } from '../helpers/server-harness.ts';
import { startTestServer } from '../helpers/server-harness.ts';

// The unreachable-DB branch of /readyz isn't separately exercised here:
// swapping out the shared pool mid-test would need more plumbing than this
// route's one `if` is worth (see database/connection.ts's own `isReachable`
// doc comment). CI's real Postgres service container is what this test
// actually runs against, so the reachable branch is the one that matters —
// it's the same DB startTestServer()'s own doc comment says every other
// route test already depends on.
describe('GET /livez and /readyz', () => {
    let server: TestServer;

    before(async () => {
        server = await startTestServer();
    });

    after(async () => {
        await server.close();
    });

    test('/livez answers 200 unconditionally', async () => {
        const response = await fetch(`${server.baseUrl}/livez`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { status: 'ok' });
    });

    test('/readyz answers 200 when the database is reachable', async () => {
        const response = await fetch(`${server.baseUrl}/readyz`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { status: 'ok' });
    });
});
