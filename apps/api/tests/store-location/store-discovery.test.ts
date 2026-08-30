import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { getPool } from '../../src/database/connection.ts';
import { apiRequest, authHeader, registerAndLogin } from '../helpers/api-client.ts';
import type { RegisteredUser } from '../helpers/api-client.ts';
import type { TestServer } from '../helpers/server-harness.ts';
import { startTestServer } from '../helpers/server-harness.ts';

const OSM_ATTRIBUTION = '© OpenStreetMap contributors';

// Two clusters ~75 km apart, both far from tests/store-location/nearby.test.ts's
// Vienna fixtures (48.2082/16.3738 ± 1°). They must stay further apart than the
// endpoint's 50 km radius cap, so a search centred on one can never reach the
// other — that separation is what makes "attribution present" and "attribution
// absent" two independently provable outcomes rather than one flaky one.
const OSM_CENTER = { lat: 46.5, lon: 13.5 };
const GEOLOCET_CENTER = { lat: 46.0, lon: 13.0 };

// 1° of latitude ≈ 111 km, so these sit at roughly 1.1 km, 5.6 km and 22 km
// from OSM_CENTER — inside the 50 km cap, and far enough apart that the
// distance ordering cannot come down to floating-point noise.
const OSM_OFFSETS = [0.01, 0.05, 0.2];

/** A phone number on every fixture, so a `phone` leak is detectable by value, not only by key. */
const FIXTURE_PHONE = '+43 1 5550101';

/** Response keys that must never reach a client. See `toPublicStore`. */
const FORBIDDEN_KEYS = [
    'phone',
    'source',
    'apiEndpoint',
    'api_endpoint',
    'externalStoreId',
    'external_store_id',
];

/**
 * @param body - A parsed response body.
 * @param where - A label for the failure message.
 */
function assertNoSuppressedFields(body: unknown, where: string): void {
    const json = JSON.stringify(body);
    for (const key of FORBIDDEN_KEYS) {
        assert.ok(!json.includes(`"${key}"`), `${where} leaked the '${key}' field`);
    }
    assert.ok(!json.includes(FIXTURE_PHONE), `${where} leaked a store's phone number`);
}

describe('store discovery routes', () => {
    let server: TestServer;
    let user: RegisteredUser;
    const pool = getPool();

    // 'mpreis' is deliberately literal, not randomised: it is one of the codes
    // the OpenStreetMap import creates and the old five-literal z.enum rejected,
    // so this fixture is the regression test's subject.
    const OSM_CODE = 'mpreis';
    const GEOLOCET_CODE = `test-geolocet-${randomUUID()}`;
    const EMPTY_COUNTRY_CODE = `test-empty-${randomUUID()}`;
    // Not a real ISO 3166-1 country. That is the point: /discounters/countries
    // must report whatever is in the table, so a code no hardcoded list would
    // ever contain proves the list is derived rather than written down.
    const SYNTHETIC_COUNTRY = 'ZZ';

    let osmDiscounterId: string;
    let geolocetDiscounterId: string;
    let emptyDiscounterId: string;

    async function createDiscounter(code: string, name: string, country: string): Promise<string> {
        await pool.query(
            `INSERT INTO discounters (code, name, country_code) VALUES ($1, $2, $3)
             ON CONFLICT (code) DO NOTHING`,
            [code, name, country],
        );
        const { rows } = await pool.query<{ id: string }>(
            'SELECT id FROM discounters WHERE code = $1',
            [code],
        );
        const row = rows[0];
        if (!row) throw new Error(`Could not create test discounter '${code}'.`);
        return row.id;
    }

    before(async () => {
        server = await startTestServer();
        user = await registerAndLogin(server.baseUrl, 'store-discovery');

        osmDiscounterId = await createDiscounter(OSM_CODE, 'MPREIS', 'AT');
        geolocetDiscounterId = await createDiscounter(GEOLOCET_CODE, 'Test Geolocet Chain', 'AT');
        emptyDiscounterId = await createDiscounter(
            EMPTY_COUNTRY_CODE,
            'Test Empty Chain',
            SYNTHETIC_COUNTRY,
        );

        // source = 'osm' obliges external_store_id to carry the 'osm:' namespace
        // (migration 0016's chk_store_locations_osm_id_namespace).
        for (const [index, offset] of OSM_OFFSETS.entries()) {
            await pool.query(
                `INSERT INTO store_locations
                    (discounter_id, external_store_id, name, address, city, postal_code, location, phone, source)
                 VALUES ($1, $2, $3, $4, $5, $6, ST_MakePoint($8, $7)::geography, $9, 'osm')`,
                [
                    osmDiscounterId,
                    `osm:node/${randomUUID()}`,
                    `OSM Store ${String(index)}`,
                    `Teststraße ${String(index)}`,
                    'Testdorf',
                    '9999',
                    OSM_CENTER.lat + offset,
                    OSM_CENTER.lon,
                    FIXTURE_PHONE,
                ],
            );
        }

        await pool.query(
            `INSERT INTO store_locations
                (discounter_id, external_store_id, name, address, city, postal_code, location, phone, source)
             VALUES ($1, NULL, $2, $3, $4, $5, ST_MakePoint($7, $6)::geography, $8, 'geolocet')`,
            [
                geolocetDiscounterId,
                'Geolocet Store',
                'Kaufstraße 1',
                'Kaufdorf',
                '9998',
                GEOLOCET_CENTER.lat,
                GEOLOCET_CENTER.lon,
                FIXTURE_PHONE,
            ],
        );
    });

    after(async () => {
        const ids = [osmDiscounterId, geolocetDiscounterId, emptyDiscounterId];
        await pool.query('DELETE FROM store_locations WHERE discounter_id = ANY($1)', [ids]);
        // Guarded: if a real OSM import ever runs against this database, 'mpreis'
        // is its row too and still has stores. Leaving it is right; failing
        // teardown on the FK is not.
        await pool.query(
            `DELETE FROM discounters d WHERE d.id = ANY($1)
             AND NOT EXISTS (SELECT 1 FROM store_locations s WHERE s.discounter_id = d.id)`,
            [ids],
        );
        await server.close();
    });

    // ── auth ────────────────────────────────────────────────────────────────

    test('every endpoint requires authentication', async () => {
        const paths = [
            '/discounters/countries',
            '/discounters',
            `/discounters/${OSM_CODE}/stores`,
            `/stores/near?lat=${String(OSM_CENTER.lat)}&lon=${String(OSM_CENTER.lon)}`,
        ];
        for (const path of paths) {
            const res = await apiRequest(server.baseUrl, path);
            assert.equal(res.status, 401, `${path} answered ${String(res.status)} unauthenticated`);
        }
    });

    // ── GET /discounters/countries ──────────────────────────────────────────

    test('countries are derived from the table, not from a hardcoded list', async () => {
        const res = await apiRequest(server.baseUrl, '/discounters/countries', {
            headers: authHeader(user),
        });
        assert.equal(res.status, 200);

        const countries = res.body as string[];
        assert.ok(Array.isArray(countries));
        assert.ok(
            countries.includes('AT'),
            'AT must be present — every seeded discounter is Austrian',
        );
        assert.ok(
            countries.includes(SYNTHETIC_COUNTRY),
            `${SYNTHETIC_COUNTRY} is in the table but in no hardcoded country list — the response must reflect the data`,
        );
        // CHAR(2), so an untrimmed read would yield 'AT ' and break every
        // ?country= round-trip the UI builds from this list.
        for (const country of countries) {
            assert.equal(country, country.trim());
            assert.equal(country.length, 2);
        }
    });

    // ── GET /discounters ────────────────────────────────────────────────────

    test('lists discounters for a country, with a store count each', async () => {
        const res = await apiRequest(server.baseUrl, '/discounters?country=AT', {
            headers: authHeader(user),
        });
        assert.equal(res.status, 200);

        const body = res.body as {
            discounters: { code: string; name: string; countryCode: string; storeCount: number }[];
        };
        const mpreis = body.discounters.find((d) => d.code === OSM_CODE);
        assert.ok(mpreis, `'${OSM_CODE}' must appear in the AT list`);
        assert.equal(mpreis.storeCount, OSM_OFFSETS.length);
        assert.equal(mpreis.countryCode, 'AT');

        // A country filter that means "this country", not "every country".
        for (const discounter of body.discounters) {
            assert.equal(discounter.countryCode, 'AT');
        }
        assert.ok(
            !body.discounters.some((d) => d.code === EMPTY_COUNTRY_CODE),
            'a discounter from another country must not appear under ?country=AT',
        );
    });

    test('a lowercase country is the same country', async () => {
        const res = await apiRequest(server.baseUrl, '/discounters?country=at', {
            headers: authHeader(user),
        });
        assert.equal(res.status, 200);
        const body = res.body as { discounters: { code: string }[] };
        assert.ok(body.discounters.some((d) => d.code === OSM_CODE));
    });

    test('a discounter with no stores is still listed, at zero', async () => {
        const res = await apiRequest(server.baseUrl, `/discounters?country=${SYNTHETIC_COUNTRY}`, {
            headers: authHeader(user),
        });
        assert.equal(res.status, 200);

        const body = res.body as { discounters: { code: string; storeCount: number }[] };
        const empty = body.discounters.find((d) => d.code === EMPTY_COUNTRY_CODE);
        assert.ok(empty, 'a placeholder discounter must not vanish just because it has no stores');
        assert.equal(empty.storeCount, 0);
    });

    test('an unknown country is 200 with an empty list, not 404', async () => {
        const res = await apiRequest(server.baseUrl, '/discounters?country=QQ', {
            headers: authHeader(user),
        });
        assert.equal(res.status, 200);
        assert.deepEqual((res.body as { discounters: unknown[] }).discounters, []);
    });

    test('omitting country returns every country', async () => {
        const res = await apiRequest(server.baseUrl, '/discounters', {
            headers: authHeader(user),
        });
        assert.equal(res.status, 200);

        const codes = (res.body as { discounters: { code: string }[] }).discounters.map(
            (d) => d.code,
        );
        assert.ok(codes.includes(OSM_CODE), 'an AT discounter must be present');
        assert.ok(
            codes.includes(EMPTY_COUNTRY_CODE),
            `a ${SYNTHETIC_COUNTRY} discounter must be present`,
        );
    });

    test('a malformed country is rejected', async () => {
        for (const country of ['AUT', 'A', '1234', 'A%27']) {
            const res = await apiRequest(server.baseUrl, `/discounters?country=${country}`, {
                headers: authHeader(user),
            });
            assert.equal(res.status, 400, `?country=${country} should not have been accepted`);
        }
    });

    // ── GET /discounters/:code/stores ───────────────────────────────────────

    test("a code the old z.enum never knew — 'mpreis' — resolves", async () => {
        // The regression this whole change exists for. discounterCodeSchema was
        // z.enum(['spar','billa','hofer','lidl','penny']); mpreis is a real chain
        // the OSM import puts in the table, so validateQuery/the enum answered as
        // though a supermarket with hundreds of branches did not exist.
        const res = await apiRequest(server.baseUrl, `/discounters/${OSM_CODE}/stores`, {
            headers: authHeader(user),
        });
        assert.equal(res.status, 200, `'${OSM_CODE}' must resolve, not 404`);

        const body = res.body as { stores: { name: string; city: string; latitude: number }[] };
        assert.equal(body.stores.length, OSM_OFFSETS.length);
        const first = body.stores[0];
        assert.ok(first);
        assert.equal(first.city, 'Testdorf');
        assert.equal(typeof first.latitude, 'number');
    });

    test('a well-formed but absent code is 404', async () => {
        const res = await apiRequest(server.baseUrl, '/discounters/aldi/stores', {
            headers: authHeader(user),
        });
        assert.equal(res.status, 404);
    });

    test('a malformed code is 404, not a database round trip', async () => {
        for (const code of ['SPAR', 'a'.repeat(200), 'spar-', '-spar']) {
            const res = await apiRequest(
                server.baseUrl,
                `/discounters/${encodeURIComponent(code)}/stores`,
                { headers: authHeader(user) },
            );
            assert.equal(res.status, 404, `'${code.slice(0, 12)}' should not have resolved`);
        }
    });

    test('pagination is capped and pages do not overlap', async () => {
        for (const limit of ['0', '26', '-1', 'abc']) {
            const res = await apiRequest(
                server.baseUrl,
                `/discounters/${OSM_CODE}/stores?limit=${limit}`,
                { headers: authHeader(user) },
            );
            assert.equal(res.status, 400, `limit=${limit} should have been rejected`);
        }

        const page1 = await apiRequest(
            server.baseUrl,
            `/discounters/${OSM_CODE}/stores?limit=2&offset=0`,
            { headers: authHeader(user) },
        );
        const page2 = await apiRequest(
            server.baseUrl,
            `/discounters/${OSM_CODE}/stores?limit=2&offset=2`,
            { headers: authHeader(user) },
        );
        assert.equal(page1.status, 200);
        assert.equal(page2.status, 200);

        const ids1 = (page1.body as { stores: { id: string }[] }).stores.map((s) => s.id);
        const ids2 = (page2.body as { stores: { id: string }[] }).stores.map((s) => s.id);
        assert.equal(ids1.length, 2);
        assert.equal(ids2.length, 1);
        assert.equal(
            new Set([...ids1, ...ids2]).size,
            OSM_OFFSETS.length,
            'pages must be disjoint',
        );
        assert.equal((page1.body as { limit: number }).limit, 2);
        assert.equal((page2.body as { offset: number }).offset, 2);
    });

    // ── GET /stores/near ────────────────────────────────────────────────────

    test('near returns results ordered by distance', async () => {
        const res = await apiRequest(
            server.baseUrl,
            `/stores/near?lat=${String(OSM_CENTER.lat)}&lon=${String(OSM_CENTER.lon)}&radius_m=50000&limit=25`,
            { headers: authHeader(user) },
        );
        assert.equal(res.status, 200);

        const stores = (res.body as { stores: { name: string | null; distanceM: number }[] })
            .stores;
        assert.equal(
            stores.length,
            OSM_OFFSETS.length,
            'only this test file has fixtures out here',
        );

        for (let i = 1; i < stores.length; i += 1) {
            const previous = stores[i - 1];
            const current = stores[i];
            assert.ok(previous && current);
            assert.ok(
                previous.distanceM <= current.distanceM,
                `result ${String(i)} (${String(current.distanceM)}m) came before ${String(previous.distanceM)}m`,
            );
        }
        assert.deepEqual(
            stores.map((s) => s.name),
            ['OSM Store 0', 'OSM Store 1', 'OSM Store 2'],
        );
    });

    test('near honours its radius', async () => {
        // 2 km around OSM_CENTER reaches the 1.1 km fixture and nothing else.
        const res = await apiRequest(
            server.baseUrl,
            `/stores/near?lat=${String(OSM_CENTER.lat)}&lon=${String(OSM_CENTER.lon)}&radius_m=2000`,
            { headers: authHeader(user) },
        );
        assert.equal(res.status, 200);
        assert.equal((res.body as { stores: unknown[] }).stores.length, 1);
    });

    test('near rejects out-of-range coordinates and an oversized radius', async () => {
        const queries = [
            'lat=999&lon=16',
            'lat=48&lon=999',
            'lat=48&lon=16&radius_m=50001',
            'lat=48&lon=16&radius_m=0',
            'lat=48&lon=16&limit=101',
            'lon=16',
        ];
        for (const query of queries) {
            const res = await apiRequest(server.baseUrl, `/stores/near?${query}`, {
                headers: authHeader(user),
            });
            assert.equal(res.status, 400, `?${query} should have been rejected`);
        }
    });

    // ── field suppression ───────────────────────────────────────────────────

    test('phone, source, api_endpoint and external_store_id appear in no response', async () => {
        const paths = [
            '/discounters/countries',
            '/discounters',
            '/discounters?country=AT',
            `/discounters/${OSM_CODE}/stores`,
            `/discounters/${GEOLOCET_CODE}/stores`,
            `/stores/near?lat=${String(OSM_CENTER.lat)}&lon=${String(OSM_CENTER.lon)}&radius_m=50000`,
            `/stores/near?lat=${String(GEOLOCET_CENTER.lat)}&lon=${String(GEOLOCET_CENTER.lon)}&radius_m=50000`,
        ];
        for (const path of paths) {
            const res = await apiRequest(server.baseUrl, path, { headers: authHeader(user) });
            assert.equal(res.status, 200, `${path} answered ${String(res.status)}`);
            assertNoSuppressedFields(res.body, path);
        }
    });

    // ── ODbL attribution ────────────────────────────────────────────────────

    test('a body carrying OSM rows carries the credit with it', async () => {
        const stores = await apiRequest(server.baseUrl, `/discounters/${OSM_CODE}/stores`, {
            headers: authHeader(user),
        });
        assert.equal((stores.body as { attribution?: string }).attribution, OSM_ATTRIBUTION);

        const near = await apiRequest(
            server.baseUrl,
            `/stores/near?lat=${String(OSM_CENTER.lat)}&lon=${String(OSM_CENTER.lon)}&radius_m=50000`,
            { headers: authHeader(user) },
        );
        assert.equal((near.body as { attribution?: string }).attribution, OSM_ATTRIBUTION);

        // The counts in this list are derived from OSM rows too.
        const discounters = await apiRequest(server.baseUrl, '/discounters?country=AT', {
            headers: authHeader(user),
        });
        assert.equal((discounters.body as { attribution?: string }).attribution, OSM_ATTRIBUTION);
    });

    test('a body with no OSM rows claims no OSM credit', async () => {
        // Geolocet is purchased, proprietary data. Crediting OpenStreetMap for it
        // would be a false provenance claim, and would make the field worthless
        // as a signal wherever it is genuinely owed.
        const stores = await apiRequest(server.baseUrl, `/discounters/${GEOLOCET_CODE}/stores`, {
            headers: authHeader(user),
        });
        assert.equal(stores.status, 200);
        assert.equal((stores.body as { stores: unknown[] }).stores.length, 1);
        assert.ok(!('attribution' in (stores.body as object)), 'no OSM row, no OSM credit');

        const near = await apiRequest(
            server.baseUrl,
            `/stores/near?lat=${String(GEOLOCET_CENTER.lat)}&lon=${String(GEOLOCET_CENTER.lon)}&radius_m=10000`,
            { headers: authHeader(user) },
        );
        assert.equal((near.body as { stores: unknown[] }).stores.length, 1);
        assert.ok(!('attribution' in (near.body as object)));

        const discounters = await apiRequest(
            server.baseUrl,
            `/discounters?country=${SYNTHETIC_COUNTRY}`,
            { headers: authHeader(user) },
        );
        assert.ok(!('attribution' in (discounters.body as object)));
    });
});
