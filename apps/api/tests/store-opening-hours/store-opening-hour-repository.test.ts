import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { getPool } from '../../src/database/connection.ts';
import { DiscounterRepository } from '../../src/repository/discounter.repository.ts';
import { StoreLocationRepository } from '../../src/repository/store-location.repository.ts';
import { StoreOpeningHourRepository } from '../../src/repository/store-opening-hour.repository.ts';

describe('StoreOpeningHourRepository', () => {
    const pool = getPool();
    const hours = new StoreOpeningHourRepository(pool);
    const stores = new StoreLocationRepository(pool);

    let storeId: string;

    before(async () => {
        const discounters = new DiscounterRepository(pool);
        const spar = await discounters.findByCode('spar');
        if (!spar) throw new Error('spar must be seeded by migration 0012');

        const store = await stores.create({
            discounterId: spar.id,
            externalStoreId: `opening-hours-test-${randomUUID()}`,
            name: 'Opening Hours Test Store',
            address: null,
            city: null,
            postalCode: null,
            latitude: 48.2,
            longitude: 16.37,
            phone: null,
        });
        storeId = store.id;
    });

    // Cascades to store_opening_hours (migration 0014's ON DELETE CASCADE),
    // so no separate opening-hours cleanup is needed.
    after(async () => {
        await stores.delete(storeId);
    });

    test('create + listByStore round-trips a span, ordered by day then opening time', async () => {
        await hours.create({ storeId, dayOfWeek: 3, opensAt: '14:00', closesAt: '18:00' });
        await hours.create({ storeId, dayOfWeek: 1, opensAt: '08:00', closesAt: '19:00' });

        const list = await hours.listByStore(storeId);
        assert.equal(list.length, 2);
        assert.equal(list[0]?.dayOfWeek, 1, 'Monday must sort before Wednesday');
        assert.equal(list[0]?.opensAt.slice(0, 5), '08:00');
    });

    test('update changes only the given fields', async () => {
        const created = await hours.create({
            storeId,
            dayOfWeek: 6,
            opensAt: '09:00',
            closesAt: '17:00',
        });
        const updated = await hours.update(created.id, { closesAt: '16:00' });

        assert.equal(updated?.closesAt.slice(0, 5), '16:00');
        assert.equal(updated?.opensAt.slice(0, 5), '09:00', 'untouched field must be unchanged');
    });

    test('delete removes a span', async () => {
        const created = await hours.create({
            storeId,
            dayOfWeek: 0,
            opensAt: '10:00',
            closesAt: '13:00',
        });
        assert.equal(await hours.delete(created.id), true);
        assert.equal(await hours.delete(created.id), false);
    });

    test('the database rejects a span where closesAt is not after opensAt', async () => {
        await assert.rejects(() =>
            hours.create({ storeId, dayOfWeek: 2, opensAt: '18:00', closesAt: '08:00' }),
        );
    });
});
