#!/usr/bin/env node
/**
 * Imports Spar store locations from a Geolocet CSV export into
 * store_locations (issue #184). Geolocet is a one-time purchased dataset
 * (~€100-200 for ~1,235 stores), not a live API — this is a manual/periodic
 * import, not something scheduled.
 *
 * Usage: node scripts/import-geolocet-spar-data.mjs < spar-stores.csv
 *        node scripts/import-geolocet-spar-data.mjs path/to/spar-stores.csv
 *
 * Expected CSV header (case-insensitive, column order doesn't matter):
 *   store_id, name, address, city, postal_code, latitude, longitude, phone
 * `store_id` becomes external_store_id — Geolocet's own id for the store,
 * which is what makes re-running this idempotent (upsert on
 * (discounter_id, external_store_id), migration 0013's unique constraint):
 * a corrected re-export updates existing rows instead of duplicating them.
 *
 * Error handling: a row missing store_id/name, or with unparseable/out-of-range
 * coordinates, is skipped with a warning on stderr — one bad row in a
 * 1,235-row file shouldn't fail the whole import. The run still exits
 * non-zero if not a single row imported successfully.
 */
import { readFile } from 'node:fs/promises';
import pg from 'pg';

if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run against NODE_ENV=production.');
    process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Did you pass --env-file=.env?');
    process.exit(1);
}

const REQUIRED_COLUMNS = [
    'store_id',
    'name',
    'address',
    'city',
    'postal_code',
    'latitude',
    'longitude',
    'phone',
];

/**
 * Splits one CSV line into fields, honoring double-quoted fields that may
 * contain commas (store addresses routinely do) and doubled `""` escapes.
 * Deliberately not a full RFC 4180 parser (no multi-line quoted fields) —
 * Geolocet's export is one record per line, which is all this needs.
 *
 * @param {string} line
 * @returns {string[]}
 */
function parseCsvLine(line) {
    const fields = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (inQuotes) {
            if (char === '"') {
                if (line[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += char;
            }
        } else if (char === '"') {
            inQuotes = true;
        } else if (char === ',') {
            fields.push(field);
            field = '';
        } else {
            field += char;
        }
    }
    fields.push(field);
    return fields;
}

/**
 * @param {string[]} header
 * @param {string[]} fields
 * @param {number} lineNumber
 * @returns {{ row: Record<string, string> } | { error: string }}
 */
function toRow(header, fields, lineNumber) {
    if (fields.length !== header.length) {
        return {
            error: `line ${lineNumber}: expected ${header.length} columns, got ${fields.length}`,
        };
    }
    /** @type {Record<string, string>} */
    const row = {};
    header.forEach((name, i) => {
        row[name] = (fields[i] ?? '').trim();
    });
    return { row };
}

/**
 * @param {Record<string, string>} row
 * @param {number} lineNumber
 * @returns {{ store: object } | { error: string }}
 */
function validateRow(row, lineNumber) {
    if (!row.store_id) return { error: `line ${lineNumber}: missing store_id` };
    if (!row.name) return { error: `line ${lineNumber}: missing name` };

    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        return { error: `line ${lineNumber}: invalid latitude "${row.latitude}"` };
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        return { error: `line ${lineNumber}: invalid longitude "${row.longitude}"` };
    }

    return {
        store: {
            externalStoreId: row.store_id,
            name: row.name,
            address: row.address || null,
            city: row.city || null,
            postalCode: row.postal_code || null,
            latitude,
            longitude,
            phone: row.phone || null,
        },
    };
}

/**
 * @returns The full input as text — the given file path, or stdin if none.
 */
async function readInput() {
    const filePath = process.argv[2];
    if (filePath) {
        return readFile(filePath, 'utf8');
    }
    const chunks = [];
    for await (const chunk of process.stdin) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
}

async function main() {
    // Read the whole file up front rather than streaming line-by-line:
    // Geolocet's ~1,235 rows are a few hundred KB, trivially small, and
    // this sidesteps a real hang observed when a `fs.createReadStream` +
    // `readline` async iterator is combined with awaited pg calls before
    // the loop starts — the loop then never yields a first line.
    const text = await readInput();

    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();

    const { rows: discounterRows } = await client.query(
        "SELECT id FROM discounters WHERE code = 'spar'",
    );
    const sparDiscounterId = discounterRows[0]?.id;
    if (!sparDiscounterId) {
        console.error("No 'spar' discounter found. Run migrations (0012_discounters.sql) first.");
        await client.end();
        process.exit(1);
    }

    /** @type {string[] | undefined} */
    let header;
    let lineNumber = 0;
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const rawLine of text.split('\n')) {
        lineNumber++;
        const line = rawLine.trim();
        if (line === '') continue;

        if (!header) {
            header = parseCsvLine(line).map((h) => h.trim().toLowerCase());
            const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
            if (missing.length > 0) {
                console.error(`Missing required CSV column(s): ${missing.join(', ')}`);
                await client.end();
                process.exit(1);
            }
            continue;
        }

        const fields = parseCsvLine(line);
        const rowResult = toRow(header, fields, lineNumber);
        if ('error' in rowResult) {
            console.warn(`Skipping: ${rowResult.error}`);
            skipped++;
            continue;
        }

        const validated = validateRow(rowResult.row, lineNumber);
        if ('error' in validated) {
            console.warn(`Skipping: ${validated.error}`);
            skipped++;
            continue;
        }

        const { store } = validated;
        const { rows: upsertRows } = await client.query(
            `INSERT INTO store_locations
                (discounter_id, external_store_id, name, address, city, postal_code, location, phone)
            VALUES ($1, $2, $3, $4, $5, $6, ST_MakePoint($8, $7)::geography, $9)
            ON CONFLICT (discounter_id, external_store_id) DO UPDATE SET
                name = EXCLUDED.name,
                address = EXCLUDED.address,
                city = EXCLUDED.city,
                postal_code = EXCLUDED.postal_code,
                location = EXCLUDED.location,
                phone = EXCLUDED.phone
            RETURNING (xmax = 0) AS inserted`,
            [
                sparDiscounterId,
                store.externalStoreId,
                store.name,
                store.address,
                store.city,
                store.postalCode,
                store.latitude,
                store.longitude,
                store.phone,
            ],
        );
        if (upsertRows[0]?.inserted) inserted++;
        else updated++;
    }

    await client.end();

    if (!header) {
        console.error('Input was empty — no header row found.');
        process.exit(1);
    }

    console.log(
        `Imported Spar stores: ${inserted} inserted, ${updated} updated, ${skipped} skipped.`,
    );
    if (inserted === 0 && updated === 0) {
        console.error('No rows imported successfully.');
        process.exit(1);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
