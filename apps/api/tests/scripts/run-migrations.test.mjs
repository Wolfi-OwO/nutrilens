import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { connectWithRetry } from '../../scripts/run-migrations.mjs';

// Port 1 is reserved and never bound, so a connect there is refused
// immediately — the same ECONNREFUSED the e2e stack hit against Postgres'
// temporary init server, without needing a database to reproduce it.
const REFUSED = 'postgresql://nutrilens:nutrilens@127.0.0.1:1/nutrilens';

describe('connectWithRetry', () => {
    test('retries a refused connection, then rethrows once the budget is spent', async () => {
        const startedAt = Date.now();

        await assert.rejects(
            () => connectWithRetry(REFUSED, 700),
            (error) => error.code === 'ECONNREFUSED',
        );

        // First backoff is 250ms; anything faster means the loop never slept
        // and the retry is not actually happening.
        assert.ok(Date.now() - startedAt >= 250, 'expected at least one backoff before giving up');
    });

    test('a zero budget fails on the first attempt instead of hanging a deploy', async () => {
        const startedAt = Date.now();

        await assert.rejects(() => connectWithRetry(REFUSED, 0), { code: 'ECONNREFUSED' });

        assert.ok(Date.now() - startedAt < 250, 'expected no backoff at all');
    });
});
