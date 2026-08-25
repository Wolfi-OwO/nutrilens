import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { getPool } from '../../src/database/connection.ts';
import { StoreLocationRepository } from '../../src/repository/store-location.repository.ts';

// Stephansplatz, Vienna — an arbitrary real reference point. Other points
// below are placed at known approximate distances from it (1 degree of
// latitude ≈ 111 km at this latitude) so radius/ordering assertions don't
// depend on exact geodesic math matching PostGIS's own.
const CENTER = { latitude: 48.2082, longitude: 16.3738 };

describe('StoreLocationRepository', () => {
    const pool = getPool();
    const stores = new StoreLocationRepository(pool);

    // A test-scoped discounter (random code), so this file's stores never
    // collide with the real seeded discounters (migration 0012) or with
    // other test files running concurrently against the same database.
    let discounterId: string;

    before(async () => {
        const { rows } = await pool.query<{ id: string }>(
            `INSERT INTO discounters (code, name, country_code) VALUES ($1, $2, 'AT') RETURNING id`,
            [`test-${randomUUID()}`, 'Test Discounter'],
        );
        const row = rows[0];
        if (!row) throw new Error('Failed to create test discounter.');
        discounterId = row.id;
    });

    after(async () => {
        // Delete this file's stores first — discounters has no ON DELETE
        // CASCADE from store_locations (deliberately: losing a discounter
        // row should never silently wipe its stores), so the FK would
        // otherwise reject deleting the discounter while any of this file's
        // stores still reference it.
        await pool.query('DELETE FROM store_locations WHERE discounter_id = $1', [discounterId]);
        await pool.query('DELETE FROM discounters WHERE id = $1', [discounterId]);
    });

    test('create + findById round-trips a store, including its coordinates', async () => {
        const created = await stores.create({
            discounterId,
            externalStoreId: null,
            name: 'Test Store',
            address: 'Teststraße 1',
            city: 'Wien',
            postalCode: '1010',
            latitude: CENTER.latitude,
            longitude: CENTER.longitude,
            phone: null,
        });

        assert.equal(created.name, 'Test Store');
        assert.ok(Math.abs(created.latitude - CENTER.latitude) < 1e-6);
        assert.ok(Math.abs(created.longitude - CENTER.longitude) < 1e-6);

        const found = await stores.findById(created.id);
        assert.equal(found?.id, created.id);
        assert.equal(found?.city, 'Wien');
    });

    test('findById returns undefined for a non-existent store', async () => {
        assert.equal(await stores.findById(randomUUID()), undefined);
    });

    test('upsertByExternalId is idempotent: a second call updates, not duplicates', async () => {
        const externalStoreId = `ext-${randomUUID()}`;
        const input = {
            discounterId,
            externalStoreId,
            name: 'Upsert Store v1',
            address: null,
            city: null,
            postalCode: null,
            latitude: CENTER.latitude,
            longitude: CENTER.longitude,
            phone: null,
        };

        const first = await stores.upsertByExternalId(input);
        const second = await stores.upsertByExternalId({ ...input, name: 'Upsert Store v2' });

        assert.equal(first.id, second.id, 'same external id must resolve to the same row');
        assert.equal(second.name, 'Upsert Store v2');

        const byDiscounter = await stores.listByDiscounter(discounterId);
        assert.equal(byDiscounter.filter((s) => s.externalStoreId === externalStoreId).length, 1);
    });

    test('update changes only the given fields, including coordinates', async () => {
        const created = await stores.create({
            discounterId,
            externalStoreId: null,
            name: 'Original Name',
            address: 'Original Address',
            city: 'Wien',
            postalCode: '1010',
            latitude: CENTER.latitude,
            longitude: CENTER.longitude,
            phone: null,
        });

        const updated = await stores.update(created.id, {
            name: 'Updated Name',
            latitude: 47.0,
            longitude: 15.0,
        });

        assert.equal(updated?.name, 'Updated Name');
        assert.equal(updated?.address, 'Original Address', 'untouched field must be unchanged');
        assert.ok(Math.abs((updated?.latitude ?? 0) - 47.0) < 1e-6);
        assert.ok(Math.abs((updated?.longitude ?? 0) - 15.0) < 1e-6);
    });

    test('delete removes a store; a second delete reports nothing to remove', async () => {
        const created = await stores.create({
            discounterId,
            externalStoreId: null,
            name: 'Doomed Store',
            address: null,
            city: null,
            postalCode: null,
            latitude: CENTER.latitude,
            longitude: CENTER.longitude,
            phone: null,
        });

        assert.equal(await stores.delete(created.id), true);
        assert.equal(await stores.delete(created.id), false);
        assert.equal(await stores.findById(created.id), undefined);
    });

    describe('findNearby', () => {
        let nearStoreId: string;
        let midStoreId: string;
        let farStoreId: string;
        let inactiveStoreId: string;

        before(async () => {
            // ~1 km north of CENTER.
            const near = await stores.create({
                discounterId,
                externalStoreId: null,
                name: 'Near Store (~1km)',
                address: null,
                city: null,
                postalCode: null,
                latitude: CENTER.latitude + 1 / 111,
                longitude: CENTER.longitude,
                phone: null,
            });
            nearStoreId = near.id;

            // ~3 km north of CENTER — still inside a 5 km search.
            const mid = await stores.create({
                discounterId,
                externalStoreId: null,
                name: 'Mid Store (~3km)',
                address: null,
                city: null,
                postalCode: null,
                latitude: CENTER.latitude + 3 / 111,
                longitude: CENTER.longitude,
                phone: null,
            });
            midStoreId = mid.id;

            // ~20 km north of CENTER — outside a 5 km search, inside a 50 km one.
            const far = await stores.create({
                discounterId,
                externalStoreId: null,
                name: 'Far Store (~20km)',
                address: null,
                city: null,
                postalCode: null,
                latitude: CENTER.latitude + 20 / 111,
                longitude: CENTER.longitude,
                phone: null,
            });
            farStoreId = far.id;

            // ~1 km away like `near`, but inactive — must never surface.
            const inactive = await stores.create({
                discounterId,
                externalStoreId: null,
                name: 'Inactive Near Store',
                address: null,
                city: null,
                postalCode: null,
                latitude: CENTER.latitude - 1 / 111,
                longitude: CENTER.longitude,
                phone: null,
            });
            inactiveStoreId = inactive.id;
            await stores.update(inactiveStoreId, { isActive: false });
        });

        after(async () => {
            for (const id of [nearStoreId, midStoreId, farStoreId, inactiveStoreId]) {
                await stores.delete(id);
            }
        });

        test('returns only active stores within the radius, nearest first', async () => {
            const results = await stores.findNearby(CENTER.latitude, CENTER.longitude, 5);
            const ids = results.map((r) => r.id);

            assert.ok(ids.includes(nearStoreId), 'a ~1km store must be within a 5km radius');
            assert.ok(ids.includes(midStoreId), 'a ~3km store must be within a 5km radius');
            assert.ok(
                !ids.includes(farStoreId),
                'a ~20km store must be excluded from a 5km radius',
            );
            assert.ok(!ids.includes(inactiveStoreId), 'an inactive store must never be returned');

            const nearIndex = ids.indexOf(nearStoreId);
            const midIndex = ids.indexOf(midStoreId);
            assert.ok(nearIndex < midIndex, 'closer store must be ordered first');

            const near = results.find((r) => r.id === nearStoreId);
            const mid = results.find((r) => r.id === midStoreId);
            assert.ok(
                near && near.distanceKm < 2,
                `expected ~1km, got ${String(near?.distanceKm)}`,
            );
            assert.ok(
                mid && mid.distanceKm > 2 && mid.distanceKm < 4,
                `expected ~3km, got ${String(mid?.distanceKm)}`,
            );
        });

        test('a wider radius includes the far store too', async () => {
            const results = await stores.findNearby(CENTER.latitude, CENTER.longitude, 50);
            assert.ok(results.map((r) => r.id).includes(farStoreId));
        });

        test('respects the limit parameter', async () => {
            const results = await stores.findNearby(CENTER.latitude, CENTER.longitude, 50, 1);
            assert.equal(results.length, 1);
        });
    });
});
