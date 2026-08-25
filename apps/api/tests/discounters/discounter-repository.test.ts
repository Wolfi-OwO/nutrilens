import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { getPool } from '../../src/database/connection.ts';
import { DiscounterRepository } from '../../src/repository/discounter.repository.ts';

describe('DiscounterRepository', () => {
    const pool = getPool();
    const discounters = new DiscounterRepository(pool);

    test('findAll returns the discounters seeded by migration 0012', async () => {
        // Subset check, not exact-list equality: other test files run
        // concurrently and create their own scratch discounter rows, so
        // asserting the full table contents would be a race.
        const all = await discounters.findAll();
        const codes = new Set(all.map((d) => d.code));
        for (const seeded of ['billa', 'hofer', 'lidl', 'penny', 'spar'] as const) {
            assert.ok(codes.has(seeded), `expected seeded discounter '${seeded}'`);
        }
    });

    test('findByCode finds a seeded discounter', async () => {
        const spar = await discounters.findByCode('spar');
        assert.equal(spar?.name, 'Spar');
        assert.equal(spar?.countryCode, 'AT');
    });

    test('findByCode returns undefined for an unknown code', async () => {
        // @ts-expect-error - deliberately outside DiscounterCode, to exercise the "no such row" path
        assert.equal(await discounters.findByCode('nonexistent'), undefined);
    });

    test('findById finds the same row findByCode does', async () => {
        const byCode = await discounters.findByCode('billa');
        const byId = await discounters.findById(byCode?.id ?? '');
        assert.equal(byId?.code, 'billa');
    });

    test('update changes only the given fields', async () => {
        const before = await discounters.findByCode('hofer');
        if (!before) throw new Error('hofer must be seeded');

        const updated = await discounters.update(before.id, { websiteUrl: 'https://www.hofer.at' });
        assert.equal(updated?.websiteUrl, 'https://www.hofer.at');
        assert.equal(updated?.name, before.name, 'untouched field must be unchanged');

        // Restore, so this test doesn't leak state into other test files
        // that also read the seeded 'hofer' row.
        await discounters.update(before.id, { websiteUrl: before.websiteUrl });
    });
});
