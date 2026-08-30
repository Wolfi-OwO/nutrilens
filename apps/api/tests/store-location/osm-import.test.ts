import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { after, before, describe, test } from 'node:test';

import type { OverpassElement } from '../../scripts/import-osm-supermarkets.ts';
import type { DatabaseRow, Queryable } from '../../src/database/connection.ts';
import { getPool } from '../../src/database/connection.ts';
import {
    buildStores,
    EXCLUDED_TAGS,
    importStores,
    INDEPENDENT,
    parseOpeningHours,
} from '../../scripts/import-osm-supermarkets.ts';

const fixtureUrl = new URL('../fixtures/overpass-supermarkets-sample.json', import.meta.url);
const scriptUrl = new URL('../../scripts/import-osm-supermarkets.ts', import.meta.url);

/** Every `osm:` id the fixture produces — everything this file asserts on is scoped to these. */
const FIXTURE_IDS = [
    'osm:node/1001',
    'osm:way/2002',
    'osm:relation/3003',
    'osm:node/1004',
    'osm:node/1005',
    'osm:way/2006',
    'osm:node/1007',
    'osm:node/1008',
    'osm:node/1009',
    'osm:node/1011',
    'osm:node/1012',
];

/**
 * Records every statement the importer issues, so "it never touches a non-OSM
 * row" can be asserted against the SQL actually sent rather than against
 * intent. Delegates to the real pool — this is a spy, not a stub.
 */
class RecordingQueryable implements Queryable {
    public readonly statements: string[] = [];
    readonly #inner: Queryable;

    /** @param inner - The connection to delegate to. */
    public constructor(inner: Queryable) {
        this.#inner = inner;
    }

    /**
     * @param sql - The statement.
     * @param values - Bound values.
     * @returns Whatever the wrapped connection returns.
     */
    public async query<Row extends DatabaseRow>(
        sql: string,
        values?: readonly unknown[],
    ): Promise<{ rows: Row[]; rowCount: number | null }> {
        this.statements.push(sql);
        return this.#inner.query<Row>(sql, values);
    }
}

describe('OSM supermarket import', () => {
    const pool = getPool();

    // Stand-ins for the ~1,235 purchased Geolocet rows. One of them sits under
    // the seeded 'spar' discounter — the very row the fixture's Spar node
    // resolves to — and carries external_store_id 'node/1001', the same OSM
    // element id that node has. Without migration 0016's 'osm:' namespace this
    // is precisely the pair that would collide on
    // UNIQUE (discounter_id, external_store_id).
    let scratchDiscounterId: string;
    let sparDiscounterId: string;
    let geolocetIds: string[] = [];

    /** @returns id → md5 of the whole row, for every protected non-OSM row. */
    async function geolocetDigests(): Promise<Map<string, string>> {
        const { rows } = await pool.query<{ id: string; digest: string }>(
            'SELECT id, md5(t::text) AS digest FROM store_locations t WHERE id = ANY($1) ORDER BY id',
            [geolocetIds],
        );
        return new Map(rows.map((r) => [r.id, r.digest]));
    }

    before(async () => {
        const { rows: spar } = await pool.query<{ id: string }>(
            "SELECT id FROM discounters WHERE code = 'spar'",
        );
        const sparRow = spar[0];
        if (!sparRow) throw new Error("migration 0012 must have seeded 'spar'");
        sparDiscounterId = sparRow.id;

        const { rows: scratch } = await pool.query<{ id: string }>(
            "INSERT INTO discounters (code, name, country_code) VALUES ($1, 'Scratch', 'AT') RETURNING id",
            [`test-osm-${randomUUID()}`],
        );
        const scratchRow = scratch[0];
        if (!scratchRow) throw new Error('failed to create the scratch discounter');
        scratchDiscounterId = scratchRow.id;

        const { rows: inserted } = await pool.query<{ id: string }>(
            `INSERT INTO store_locations
                (discounter_id, external_store_id, name, address, city, postal_code, location, phone, source)
             VALUES
                ($1, 'node/1001', 'Geolocet Spar Stephansplatz', 'Stephansplatz 1', 'Wien', '1010',
                 ST_MakePoint(16.3738, 48.2082)::geography, '+43 1 000000', 'geolocet'),
                ($2, 'GL-2', 'Geolocet Spar Graz', 'Herrengasse 2', 'Graz', '8010',
                 ST_MakePoint(15.4395, 47.0707)::geography, '+43 316 000000', 'geolocet'),
                ($2, 'GL-3', 'Geolocet Spar Linz', 'Landstraße 3', 'Linz', '4020',
                 ST_MakePoint(14.2858, 48.3069)::geography, NULL, 'geolocet')
             RETURNING id`,
            [sparDiscounterId, scratchDiscounterId],
        );
        geolocetIds = inserted.map((r) => r.id);
    });

    after(async () => {
        await pool.query('DELETE FROM store_locations WHERE external_store_id = ANY($1)', [
            FIXTURE_IDS,
        ]);
        await pool.query('DELETE FROM store_locations WHERE id = ANY($1)', [geolocetIds]);
        await pool.query('DELETE FROM discounters WHERE id = $1', [scratchDiscounterId]);
        // The discounters the fixture's unbranded and non-seeded brands
        // created. Only removed when nothing is left pointing at them, so a
        // concurrent real import is never broken by this cleanup.
        await pool.query(
            `DELETE FROM discounters d
             WHERE d.code = ANY($1)
               AND NOT EXISTS (SELECT 1 FROM store_locations s WHERE s.discounter_id = d.id)`,
            [['mpreis', 'nah-frisch', 'independent-at']],
        );
    });

    test('parseOpeningHours reads the common OSM subset and refuses the rest', () => {
        assert.deepEqual(parseOpeningHours('Mo-Fr 07:15-19:30; Sa 07:15-18:00; PH off'), [
            { dayOfWeek: 1, opensAt: '07:15', closesAt: '19:30' },
            { dayOfWeek: 2, opensAt: '07:15', closesAt: '19:30' },
            { dayOfWeek: 3, opensAt: '07:15', closesAt: '19:30' },
            { dayOfWeek: 4, opensAt: '07:15', closesAt: '19:30' },
            { dayOfWeek: 5, opensAt: '07:15', closesAt: '19:30' },
            { dayOfWeek: 6, opensAt: '07:15', closesAt: '18:00' },
        ]);

        // A midday closure is two spans on the same day, per migration 0014.
        assert.deepEqual(parseOpeningHours('Mo 08:00-12:00,15:00-18:00'), [
            { dayOfWeek: 1, opensAt: '08:00', closesAt: '12:00' },
            { dayOfWeek: 1, opensAt: '15:00', closesAt: '18:00' },
        ]);

        // Sa-Su wraps past the end of the week.
        assert.deepEqual(
            parseOpeningHours('Sa-Su 09:00-13:00').map((s) => s.dayOfWeek),
            [6, 0],
        );

        // Unreadable values yield nothing rather than something untrue.
        assert.deepEqual(parseOpeningHours('24/7'), []);
        assert.deepEqual(parseOpeningHours('nach Vereinbarung'), []);
        // store_opening_hours CHECKs closes_at > opens_at, so overnight is dropped.
        assert.deepEqual(parseOpeningHours('Mo 22:00-02:00'), []);
    });

    test('buildStores reads only the allowlisted tags', async () => {
        const extract = JSON.parse(await readFile(fixtureUrl, 'utf8')) as {
            elements: OverpassElement[];
        };
        const build = buildStores(extract.elements);

        // Every value the fixture carries under an excluded tag, in one bag.
        const forbidden = extract.elements.flatMap((e) =>
            EXCLUDED_TAGS.map((t) => e.tags?.[t]).filter((v): v is string => v !== undefined),
        );
        assert.ok(forbidden.length >= 8, 'the fixture must actually carry excluded tags');

        const serialized = JSON.stringify(build.stores);
        for (const value of forbidden) {
            assert.ok(
                !serialized.includes(value),
                `excluded tag value "${value}" reached the built rows`,
            );
        }

        // 12 elements in, 11 out: way/2010 has no `center`, so no coordinates.
        assert.equal(build.stores.length, 11);
        assert.equal(build.droppedNoCoordinates, 1);
        assert.equal(build.keptWithoutName, 1, 'node/1009 has no name and is still imported');

        // way/2006 is tagged `name=SPAR` with no brand tag at all, and joins
        // the Spar group through the name fallback.
        const byId = new Map(build.stores.map((s) => [s.osmId, s]));
        assert.equal(byId.get('way/2006')?.brandKey, byId.get('node/1001')?.brandKey);
        // Both Nah&Frisch spellings consolidate on brand:wikidata.
        assert.equal(byId.get('node/1004')?.brandKey, byId.get('node/1005')?.brandKey);
        // The corner shops stay, as independents.
        assert.equal(byId.get('node/1007')?.brandKey, INDEPENDENT);
        assert.equal(byId.get('node/1012')?.brandKey, INDEPENDENT);
        // A house number without a street is not an address.
        assert.equal(byId.get('node/1008')?.address, null);
        assert.equal(byId.get('node/1007')?.address, 'Landstraße 12');
    });

    test('imports the fixture, leaves the Geolocet rows byte-identical, and re-runs idempotently', async () => {
        const extract = JSON.parse(await readFile(fixtureUrl, 'utf8')) as {
            elements: OverpassElement[];
        };

        const before = await geolocetDigests();
        assert.equal(before.size, 3, 'the protected rows must exist before the import');

        const spy = new RecordingQueryable(pool);
        const first = await importStores(spy, buildStores(extract.elements), 'AT');
        assert.equal(first.inserted, 11);
        assert.equal(first.updated, 0);

        // ── The conflation assertion ────────────────────────────────────────
        // Byte-equality of the whole row, not a field-by-field comparison:
        // md5(t::text) covers the geography column and both timestamps, so a
        // coordinate correction or an updated_at touch would both show up.
        assert.deepEqual([...(await geolocetDigests())], [...before]);

        // ... and the SQL itself: nothing the importer sent may reach
        // store_locations without the source = 'osm' predicate that makes it
        // structurally blind to the purchased rows.
        const storeStatements = spy.statements.filter((s) => s.includes('store_locations'));
        assert.ok(storeStatements.length > 0);
        for (const sql of storeStatements) {
            assert.ok(sql.includes("source = 'osm'"), `unscoped statement: ${sql}`);
            assert.ok(!/\bSELECT\b/i.test(sql), `dedupe lookup against store_locations: ${sql}`);
        }

        const rows = await pool.query<{
            external_store_id: string;
            phone: string | null;
            source: string;
        }>(
            'SELECT external_store_id, phone, source FROM store_locations WHERE external_store_id = ANY($1)',
            [FIXTURE_IDS],
        );
        assert.equal(rows.rows.length, 11);
        for (const row of rows.rows) {
            assert.equal(row.phone, null, `${row.external_store_id} carries a phone number`);
            assert.equal(row.source, 'osm');
            assert.ok(row.external_store_id.startsWith('osm:'));
        }

        // The Geolocet 'node/1001' row and the OSM node/1001 row live under
        // the same discounter and are two distinct rows — the duplicate the
        // brief accepts, and proof the ids cannot collide.
        const sameDiscounter = await pool.query<{ count: string }>(
            `SELECT count(*) AS count FROM store_locations
             WHERE discounter_id = $1 AND external_store_id IN ('node/1001', 'osm:node/1001')`,
            [sparDiscounterId],
        );
        assert.equal(sameDiscounter.rows[0]?.count, '2');

        // Unbranded shops are kept, under one per-country Independent row.
        const independents = await pool.query<{ count: string }>(
            `SELECT count(*) AS count FROM store_locations s
             JOIN discounters d ON d.id = s.discounter_id
             WHERE d.code = 'independent-at' AND s.external_store_id = ANY($1)`,
            [FIXTURE_IDS],
        );
        assert.equal(independents.rows[0]?.count, '4');

        // Opening hours land, scoped to the store they belong to.
        const hours = await pool.query<{ count: string }>(
            `SELECT count(*) AS count FROM store_opening_hours h
             JOIN store_locations s ON s.id = h.store_id
             WHERE s.external_store_id = 'osm:node/1011'`,
        );
        assert.equal(hours.rows[0]?.count, '6', 'Mo-Sa for the Hofer node');

        // Re-run: updates in place, adds nothing, and still does not touch a
        // purchased row.
        const second = await importStores(pool, buildStores(extract.elements), 'AT');
        assert.equal(second.inserted, 0);
        assert.equal(second.updated, 11);
        assert.deepEqual([...(await geolocetDigests())], [...before]);

        const after = await pool.query<{ count: string }>(
            'SELECT count(*) AS count FROM store_locations WHERE external_store_id = ANY($1)',
            [FIXTURE_IDS],
        );
        assert.equal(after.rows[0]?.count, '11');
    });

    test('refuses NODE_ENV=production and makes no network calls', async () => {
        const result = spawnSync(
            process.execPath,
            ['--experimental-strip-types', scriptUrl.pathname, '--country=AT', fixtureUrl.pathname],
            { env: { ...process.env, NODE_ENV: 'production' }, encoding: 'utf8' },
        );
        assert.equal(result.status, 1);
        assert.match(result.stderr, /Refusing to run against NODE_ENV=production/);

        // The extract is a file by design (Overpass times out at country scale
        // for Germany and Italy). Nothing in the script may reach out.
        const source = await readFile(scriptUrl, 'utf8');
        assert.ok(!/\bfetch\s*\(|node:https?|require\(['"]https?/.test(source));
    });
});
