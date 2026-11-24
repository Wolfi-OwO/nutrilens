import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { apiRequest } from '../helpers/api-client.ts';
import type { TestServer } from '../helpers/server-harness.ts';
import { startTestServer } from '../helpers/server-harness.ts';

describe('GET /api/info', () => {
    let server: TestServer;

    before(async () => {
        server = await startTestServer();
    });

    after(async () => {
        await server.close();
    });

    test('answers the shape every app of the stack answers, without signing in', async () => {
        const { status, body } = await apiRequest(server.baseUrl, '/api/info');
        const info = body as Record<string, unknown>;
        assert.equal(status, 200);
        assert.equal(info.name, 'nutrilens');
        for (const key of ['version', 'revision', 'buildDate', 'repositoryUrl'])
            assert.equal(typeof info[key], 'string', `${key} is a string`);
    });

    test('keeps /version for the footer, with the same content', async () => {
        const info = (await apiRequest(server.baseUrl, '/api/info')).body as Record<
            string,
            unknown
        >;
        const version = (await apiRequest(server.baseUrl, '/version')).body as Record<
            string,
            unknown
        >;
        for (const key of ['name', 'version', 'revision', 'buildDate', 'repositoryUrl'])
            assert.equal(version[key], info[key], key);
    });
});
