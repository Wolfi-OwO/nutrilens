import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { describeDatabaseTarget, pinVerifyFullSsl } from '../../src/lib/database-url.ts';

describe('pinVerifyFullSsl', () => {
    test('leaves local and compose targets untouched', () => {
        // Verbatim from apps/api/.env.example, both docker-compose.yml files
        // and ci.yml — none of them speaks TLS, so a pinned verify-full would
        // break every local run and the whole test suite.
        for (const local of [
            'postgresql://user:pass@localhost:5432/nutrilens',
            'postgresql://nutrilens:nutrilens@postgres:5432/nutrilens',
            'postgresql://nutrilens:nutrilens@localhost:5432/nutrilens_test',
            'postgresql://user:pass@127.0.0.1:5432/nutrilens',
        ]) {
            assert.equal(pinVerifyFullSsl(local), local);
        }
    });

    test('pins verify-full on a remote target with no sslmode', () => {
        assert.equal(
            pinVerifyFullSsl('postgresql://u:p@srv.postgres.database.azure.com:5432/nutrilens'),
            'postgresql://u:p@srv.postgres.database.azure.com:5432/nutrilens?sslmode=verify-full',
        );
    });

    test('upgrades a weaker sslmode on a remote target, keeping other parameters', () => {
        assert.equal(
            pinVerifyFullSsl(
                'postgresql://u:p@srv.postgres.database.azure.com:5432/nutrilens?sslmode=require&application_name=api',
            ),
            'postgresql://u:p@srv.postgres.database.azure.com:5432/nutrilens?sslmode=verify-full&application_name=api',
        );
    });

    test('preserves a percent-encoded password', () => {
        const encoded =
            'postgresql://nutri%40admin:p%40ss%2Fword@srv.postgres.database.azure.com:5432/db';
        assert.equal(pinVerifyFullSsl(encoded), `${encoded}?sslmode=verify-full`);
    });

    test('returns a non-URI DSN unchanged rather than mangling it', () => {
        const dsn = 'host=srv.postgres.database.azure.com dbname=nutrilens';
        assert.equal(pinVerifyFullSsl(dsn), dsn);
    });
});

describe('describeDatabaseTarget', () => {
    test('keeps host and database, drops user and password', () => {
        const described = describeDatabaseTarget(
            'postgresql://nutri%40admin:p%40ss%2Fword@srv.postgres.database.azure.com:5432/nutrilens',
        );
        assert.equal(described, 'srv.postgres.database.azure.com:5432/nutrilens');
        // The point of the helper: no fragment of the credential survives.
        assert.ok(described !== null && !described.includes('p%40ss'));
        assert.ok(described !== null && !described.includes('admin'));
    });

    test('returns null for a non-URI DSN so callers print nothing', () => {
        assert.equal(
            describeDatabaseTarget('host=srv.postgres.database.azure.com password=hunter2'),
            null,
        );
    });
});
