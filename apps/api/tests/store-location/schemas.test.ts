import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
    discounterCodeSchema,
    updateDiscounterBodySchema,
} from '../../src/schemas/discounter.schemas.ts';
import {
    geolocetStoreRowSchema,
    nearbyStoreLocationsQuerySchema,
} from '../../src/schemas/store-location.schemas.ts';
import { createStoreOpeningHourBodySchema } from '../../src/schemas/store-opening-hour.schemas.ts';

// These schemas have no HTTP route yet (issue #184 is schema-only; routes
// land in issues #185-187), so — unlike food-catalog's schemas, exercised
// via tests/food-catalog/search.test.ts hitting the real endpoint — there's
// no request path to test them through. Unit-tested directly instead.
describe('discounter.schemas', () => {
    test('discounterCodeSchema accepts the five tracked discounters', () => {
        for (const code of ['spar', 'billa', 'hofer', 'lidl', 'penny']) {
            assert.equal(discounterCodeSchema.parse(code), code);
        }
    });

    test('discounterCodeSchema rejects an unknown discounter', () => {
        assert.throws(() => discounterCodeSchema.parse('aldi'));
    });

    test('updateDiscounterBodySchema accepts a partial update', () => {
        const parsed = updateDiscounterBodySchema.parse({ websiteUrl: 'https://www.spar.at' });
        assert.equal(parsed.websiteUrl, 'https://www.spar.at');
        assert.equal(parsed.apiEndpoint, undefined);
    });

    test('updateDiscounterBodySchema rejects a non-URL websiteUrl', () => {
        assert.throws(() => updateDiscounterBodySchema.parse({ websiteUrl: 'not-a-url' }));
    });
});

describe('store-location.schemas', () => {
    test('nearbyStoreLocationsQuerySchema coerces string query params and defaults radiusKm', () => {
        const parsed = nearbyStoreLocationsQuerySchema.parse({ lat: '48.2082', lon: '16.3738' });
        assert.equal(parsed.lat, 48.2082);
        assert.equal(parsed.lon, 16.3738);
        assert.equal(parsed.radiusKm, 5);
    });

    test('nearbyStoreLocationsQuerySchema rejects an out-of-range latitude', () => {
        assert.throws(() => nearbyStoreLocationsQuerySchema.parse({ lat: '999', lon: '16' }));
    });

    test('geolocetStoreRowSchema accepts a well-formed CSV row', () => {
        const parsed = geolocetStoreRowSchema.parse({
            store_id: 'GEO-001',
            name: 'Spar Mariahilfer Straße',
            address: 'Mariahilfer Str. 12',
            city: 'Wien',
            postal_code: '1060',
            latitude: '48.1990',
            longitude: '16.3487',
            phone: '+4315551234',
        });
        assert.equal(parsed.latitude, 48.199);
        assert.equal(parsed.longitude, 16.3487);
    });

    test('geolocetStoreRowSchema rejects a missing store_id', () => {
        assert.throws(() =>
            geolocetStoreRowSchema.parse({
                store_id: '',
                name: 'Spar Test',
                latitude: '48.2',
                longitude: '16.3',
            }),
        );
    });

    test('geolocetStoreRowSchema rejects an out-of-range longitude', () => {
        assert.throws(() =>
            geolocetStoreRowSchema.parse({
                store_id: 'GEO-999',
                name: 'Spar Broken',
                latitude: '48.2',
                longitude: '999',
            }),
        );
    });
});

describe('store-opening-hour.schemas', () => {
    test('createStoreOpeningHourBodySchema accepts HH:MM and HH:MM:SS', () => {
        assert.doesNotThrow(() =>
            createStoreOpeningHourBodySchema.parse({
                dayOfWeek: 1,
                opensAt: '08:00',
                closesAt: '19:00',
            }),
        );
        assert.doesNotThrow(() =>
            createStoreOpeningHourBodySchema.parse({
                dayOfWeek: 1,
                opensAt: '08:00:00',
                closesAt: '19:00:00',
            }),
        );
    });

    test('createStoreOpeningHourBodySchema rejects an out-of-range dayOfWeek', () => {
        assert.throws(() =>
            createStoreOpeningHourBodySchema.parse({
                dayOfWeek: 7,
                opensAt: '08:00',
                closesAt: '19:00',
            }),
        );
    });

    test('createStoreOpeningHourBodySchema rejects a malformed time', () => {
        assert.throws(() =>
            createStoreOpeningHourBodySchema.parse({
                dayOfWeek: 1,
                opensAt: '8am',
                closesAt: '19:00',
            }),
        );
    });
});
