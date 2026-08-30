#!/usr/bin/env node
/**
 * Imports every supermarket in an OpenStreetMap (Overpass) extract into
 * store_locations (issue #212). Austria alone is 5,380 of them, against the
 * ~1,235 purchased Geolocet Spar stores already in the table.
 *
 * Usage:
 *   node --experimental-strip-types scripts/import-osm-supermarkets.ts --country=AT at-supermarkets.json
 *   node --experimental-strip-types scripts/import-osm-supermarkets.ts --country=AT < at-supermarkets.json
 *
 * The input is a FILE, never a live API call: Overpass times out at country
 * scale for the bigger countries (Germany and Italy both did), so the extract
 * is produced once by hand and fed in here. This script makes no network
 * calls at all. Reproduce the Austrian input with, at overpass-turbo.eu or
 * any Overpass endpoint, exporting raw JSON:
 *
 *   [out:json][timeout:240];area["ISO3166-1"="AT"]->.a;nwr["shop"="supermarket"](area.a);out center tags;
 *
 * `out center` matters: 2,433 of Austria's 5,380 results are `way` and 11 are
 * `relation`, and neither carries lat/lon. Reading only lat/lon silently drops
 * 45% of the dataset.
 *
 * ── LICENCE TRAP — DO NOT "IMPROVE" THIS INTO A DEDUPING IMPORT ──────────────
 *
 * OSM is ODbL 1.0. The Geolocet Spar rows already in store_locations are
 * PURCHASED proprietary data. The moment this importer conflates the two —
 * dedupes an OSM feature against a Geolocet row, corrects a Geolocet
 * coordinate from OSM, or collides on external_store_id — the Geolocet rows
 * become part of an ODbL Derivative Database, and ODbL §4.4/§4.6 would oblige
 * republishing purchased data that its own licence forbids republishing. Two
 * licences, mutually unsatisfiable, and the only way out is not to enter.
 *
 * Therefore this script NEVER reads, matches against, or updates a row that is
 * not its own. It does not call StoreLocationRepository#upsertByExternalId
 * (whose ON CONFLICT targets the table-wide unique constraint, which a
 * Geolocet row shares). It upserts against the partial unique index from
 * migration 0016, whose `WHERE source = 'osm'` predicate makes the DO UPDATE
 * branch structurally blind to every non-OSM row.
 *
 * VISIBLE DUPLICATES ARE THE ACCEPTED OUTCOME. OSM's 1,088 Spar entries sit
 * beside Geolocet's ~1,235 as separate rows. That is deliberate and signed
 * off; deduplicating them is the one thing that must not happen.
 *
 * ── DSGVO — THE TAG EXCLUSION LIST ──────────────────────────────────────────
 *
 * Because ODbL §4.6 obliges publishing the derived database, whatever lands
 * here is publishable data. On independent shops OSM's `phone` is frequently
 * the proprietor's personal mobile and `operator` a sole trader's name — no
 * Art. 6 DSGVO basis to publish either. 2,688 of the 5,380 Austrian elements
 * (50%) carry at least one such tag, so this is not a theoretical exposure.
 *
 * IMPORTED_TAGS below is an allowlist, not a blocklist: the row is built from
 * named tags only, so a tag nobody thought about cannot leak by default.
 * EXCLUDED_TAGS names the ones deliberately dropped, so the intent survives a
 * later tidy-up, and is asserted in tests/store-location/osm-import.test.ts.
 * store_locations.phone is written as a literal NULL for every OSM row. Take
 * the exclusion and the §4.6 extract needs no DSGVO analysis at all.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { Queryable } from '../src/database/connection.ts';
import { getPool } from '../src/database/connection.ts';

/**
 * The only OSM tags that may reach the database. An allowlist, so an
 * unreviewed tag cannot leak — see the DSGVO note in the file header.
 */
export const IMPORTED_TAGS = [
    'name',
    'addr:street',
    'addr:housenumber',
    'addr:city',
    'addr:postcode',
    'opening_hours',
] as const;

/**
 * Tags deliberately dropped even though they are present and would be useful.
 * Personal data under DSGVO on independent shops; ODbL §4.6 would oblige
 * publishing them. Listed explicitly (rather than merely "not allowlisted")
 * so the decision is visible to anyone extending IMPORTED_TAGS later.
 */
export const EXCLUDED_TAGS = [
    'phone',
    'contact:phone',
    'contact:email',
    'contact:website',
    'contact:fax',
    'operator',
    'owner',
] as const;

/** Raw Overpass element, narrowed to the fields this script reads. */
export interface OverpassElement {
    type: 'node' | 'way' | 'relation';
    id: number;
    lat?: number;
    lon?: number;
    /** `out center` puts a representative point here for ways and relations. */
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
}

/** One (day, open, close) span, matching store_opening_hours' row shape. */
export interface OpeningSpan {
    /** JS Date#getDay() convention, as migration 0014 requires: 0 = Sunday. */
    dayOfWeek: number;
    opensAt: string;
    closesAt: string;
}

/** A store ready to be written, built exclusively from IMPORTED_TAGS. */
export interface OsmStore {
    /** `node/123`, `way/456`, `relation/789` — the OSM element id. */
    osmId: string;
    /** Grouping key for the discounter this store belongs to, from {@link groupBrands}. */
    brandKey: string;
    name: string | null;
    address: string | null;
    city: string | null;
    postalCode: string | null;
    latitude: number;
    longitude: number;
    openingHours: OpeningSpan[];
}

/** Grouping key used for every element carrying no usable brand. */
export const INDEPENDENT = 'independent';

const DAYS: Record<string, number> = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 };

const DAY_NAMES = 'Mo|Tu|We|Th|Fr|Sa|Su';
const DAY_LIST = `(?:${DAY_NAMES})(?:-(?:${DAY_NAMES}))?(?:,(?:${DAY_NAMES})(?:-(?:${DAY_NAMES}))?)*`;
const TIME_LIST = '\\d{1,2}:\\d{2}-\\d{1,2}:\\d{2}(?:,\\d{1,2}:\\d{2}-\\d{1,2}:\\d{2})*';
const RULE = new RegExp(`(${DAY_LIST})\\s*(${TIME_LIST})`, 'g');

/**
 * Parses the common subset of OSM's `opening_hours` grammar into the spans
 * store_opening_hours stores.
 *
 * ponytail: a GLOBAL SCAN for `<days> <times>` rules, not a grammar. Measured
 * against the 4,055 Austrian values that carry the tag, this reads 3,987 of
 * them (98.3%); the rest are `24/7`, month ranges, `sunrise`-relative or
 * free-form German prose. The scan ignores what it cannot read rather than
 * failing, which is why `PH off`, `Su,PH off` and the 39 values using `,`
 * instead of `;` as the rule separator all still yield their weekday rules.
 * Its ceiling is real and one-directional: a seasonal value like
 * `Mar-Oct Mo-Fr 09:00-18:00` is applied year-round, since the month range is
 * simply not matched. Swap in a real opening_hours parser if seasonal
 * supermarkets ever matter; nothing else here changes.
 *
 * @param value - The raw `opening_hours` tag value.
 * @returns Deduplicated spans, in tag order. Empty when nothing is readable.
 */
export function parseOpeningHours(value: string): OpeningSpan[] {
    const spans: OpeningSpan[] = [];
    const seen = new Set<string>();

    for (const [, dayPart = '', timePart = ''] of value.matchAll(RULE)) {
        const days: number[] = [];
        for (const group of dayPart.split(',')) {
            const [from, to] = group.split('-');
            const start = DAYS[from ?? ''];
            if (start === undefined) continue;
            const end = to === undefined ? start : DAYS[to];
            if (end === undefined) continue;
            // Sa-Su wraps past the end of the week, hence the modulo walk
            // rather than a plain `for (i = start; i <= end; i++)`.
            for (let i = start; ; i = (i + 1) % 7) {
                days.push(i);
                if (i === end) break;
            }
        }

        for (const range of timePart.split(',')) {
            const [opensAt, closesAt] = range.split('-');
            if (opensAt === undefined || closesAt === undefined) continue;
            // store_opening_hours CHECKs closes_at > opens_at, so an overnight
            // span (22:00-02:00) cannot be stored as one row and is dropped
            // rather than silently truncated to something untrue.
            if (closesAt <= opensAt) continue;
            for (const dayOfWeek of days) {
                const key = `${String(dayOfWeek)} ${opensAt} ${closesAt}`;
                if (seen.has(key)) continue;
                seen.add(key);
                spans.push({ dayOfWeek, opensAt, closesAt });
            }
        }
    }
    return spans;
}

/** @returns The tag value trimmed, or null when absent or blank. */
function tag(tags: Record<string, string>, key: string): string | null {
    return tags[key]?.trim() || null;
}

/** @returns `name` lowercased and stripped of punctuation, for brand matching. */
function normalizeBrand(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9äöüß]+/g, ' ')
        .trim();
}

/**
 * @param name - A brand's display name.
 * @returns A discounter `code`: lowercase, alphanumeric, hyphen-separated.
 */
export function slugify(name: string): string {
    return normalizeBrand(name)
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

export interface BrandGroup {
    /** Display name, used as the discounter's `name`. */
    name: string;
    /** How many elements resolved to this group. */
    count: number;
}

/**
 * Works out which brand each element belongs to, and which elements belong to
 * no brand at all.
 *
 * WHY brand:wikidata FIRST — it is present on 4,249 of the 5,380 Austrian
 * elements (79%) and is the only key that survives spelling: "Nah & Frisch",
 * "Nah&Frisch" and "NAH&FRISCH" are one chain, and Q1963643 says so where
 * three name strings do not.
 *
 * WHY A NAME FALLBACK, AND WHY IT IS RESTRICTED — the brief's "brand, or name
 * where not" cannot mean "every distinct name is a brand": that turns 1,098
 * unbranded elements into ~1,000 single-store discounters, and merging two
 * unrelated shops that happen to both be called "Dorfladen" would be a false
 * claim that they are one chain. So a nameless-brand element joins a brand
 * group only when its name matches a brand that IS tagged elsewhere in the
 * same extract, and only when that match is unambiguous (exactly one brand
 * key). Everything else stays independent — see resolveDiscounterId.
 *
 * Ambiguity is logged, never silently merged: one brand name spelling mapping
 * to several wikidata ids, or one wikidata id appearing under several names.
 *
 * @param elements - Every element in the extract.
 * @returns The brand key per element id, and the groups those keys name.
 */
export function groupBrands(elements: OverpassElement[]): {
    keyByElement: Map<number, string>;
    groups: Map<string, BrandGroup>;
    ambiguous: string[];
} {
    const namesByKey = new Map<string, Map<string, number>>();
    const keysByName = new Map<string, Set<string>>();

    // Pass 1 — the elements that carry a brand define what the brands are.
    for (const element of elements) {
        const tags = element.tags ?? {};
        const brand = tag(tags, 'brand');
        const wikidata = tag(tags, 'brand:wikidata');
        if (!brand && !wikidata) continue;

        const display = brand ?? tag(tags, 'name');
        if (!display) continue;
        const key = wikidata ?? `name:${normalizeBrand(display)}`;

        const names = namesByKey.get(key) ?? new Map<string, number>();
        names.set(display, (names.get(display) ?? 0) + 1);
        namesByKey.set(key, names);

        const normalized = normalizeBrand(display);
        const keys = keysByName.get(normalized) ?? new Set<string>();
        keys.add(key);
        keysByName.set(normalized, keys);
    }

    const ambiguous: string[] = [];
    const groups = new Map<string, BrandGroup>();
    for (const [key, names] of namesByKey) {
        const sorted = [...names].sort((a, b) => b[1] - a[1]);
        const [best] = sorted;
        if (!best) continue;
        groups.set(key, { name: best[0], count: 0 });
        if (sorted.length > 1) {
            ambiguous.push(
                `brand key ${key} appears under ${String(sorted.length)} names ` +
                    `(${sorted.map(([n, c]) => `${n} x${String(c)}`).join(', ')}); using "${best[0]}"`,
            );
        }
    }
    for (const [normalized, keys] of keysByName) {
        if (keys.size > 1) {
            ambiguous.push(
                `brand name "${normalized}" maps to ${String(keys.size)} distinct keys ` +
                    `(${[...keys].join(', ')}); kept separate, unbranded shops of that name stay independent`,
            );
        }
    }

    // Pass 2 — assign every element, including the ones with no brand tag.
    const keyByElement = new Map<number, string>();
    for (const element of elements) {
        const tags = element.tags ?? {};
        const brand = tag(tags, 'brand');
        const wikidata = tag(tags, 'brand:wikidata');
        let key: string | undefined;

        if (brand ?? wikidata) {
            const display = brand ?? tag(tags, 'name');
            key = wikidata ?? (display ? `name:${normalizeBrand(display)}` : undefined);
        } else {
            const name = tag(tags, 'name');
            const candidates = name ? keysByName.get(normalizeBrand(name)) : undefined;
            if (candidates?.size === 1) key = [...candidates][0];
        }

        const group = key === undefined ? undefined : groups.get(key);
        if (key === undefined || !group) {
            keyByElement.set(element.id, INDEPENDENT);
            continue;
        }
        group.count += 1;
        keyByElement.set(element.id, key);
    }

    const independents = [...keyByElement.values()].filter((k) => k === INDEPENDENT).length;
    if (independents > 0) groups.set(INDEPENDENT, { name: 'Independent', count: independents });

    return { keyByElement, groups, ambiguous };
}

export interface BuildResult {
    stores: OsmStore[];
    /** Elements skipped because `out center` was missing or the point is out of range. */
    droppedNoCoordinates: number;
    /** Elements kept although OSM has no `name` for them — 28 of Austria's 5,380. */
    keptWithoutName: number;
    ambiguous: string[];
    groups: Map<string, BrandGroup>;
}

/**
 * Turns raw Overpass elements into rows, reading IMPORTED_TAGS and nothing else.
 *
 * @param elements - Every element in the extract.
 * @returns The buildable stores plus the counts worth reporting.
 */
export function buildStores(elements: OverpassElement[]): BuildResult {
    const { keyByElement, groups, ambiguous } = groupBrands(elements);
    const stores: OsmStore[] = [];
    let droppedNoCoordinates = 0;
    let keptWithoutName = 0;

    for (const element of elements) {
        // `way` and `relation` have no lat/lon of their own; `out center`
        // gives them a representative point. 2,444 of Austria's 5,380
        // elements are one of the two.
        const latitude = element.lat ?? element.center?.lat;
        const longitude = element.lon ?? element.center?.lon;
        if (
            latitude === undefined ||
            longitude === undefined ||
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
        ) {
            droppedNoCoordinates += 1;
            continue;
        }

        const tags = element.tags ?? {};
        const name = tag(tags, 'name');
        if (!name) keptWithoutName += 1;

        // A house number without a street is not an address, so `address` is
        // null unless the street is there. 1,501 Austrian elements have no
        // addr:street at all, which is why the column stays nullable.
        const street = tag(tags, 'addr:street');
        const houseNumber = tag(tags, 'addr:housenumber');
        const address = street ? (houseNumber ? `${street} ${houseNumber}` : street) : null;

        const openingHours = tag(tags, 'opening_hours');

        stores.push({
            osmId: `${element.type}/${String(element.id)}`,
            brandKey: keyByElement.get(element.id) ?? INDEPENDENT,
            name,
            address,
            city: tag(tags, 'addr:city'),
            postalCode: tag(tags, 'addr:postcode'),
            latitude,
            longitude,
            openingHours: openingHours ? parseOpeningHours(openingHours) : [],
        });
    }

    return { stores, droppedNoCoordinates, keptWithoutName, ambiguous, groups };
}

/**
 * Finds or creates the discounter a brand group maps to.
 *
 * Reuses a seeded discounter when its code and country match, so OSM's 1,088
 * Spar stores land under the same 'spar' row as the Geolocet ones rather than
 * inventing a second Spar. That is safe — and is NOT conflation — because a
 * discounter row contains no Geolocet data (migration 0012 seeded it) and
 * because migration 0016's namespace CHECK plus its partial unique index keep
 * the two sets' store rows apart inside that shared discounter.
 *
 * INDEPENDENTS GET ONE ROW PER COUNTRY, not one per shop name. `discounters`
 * models a chain the app compares prices across; a corner Greißler is not a
 * chain, has no price feed and no second branch, and 1,098 single-store
 * discounter rows would make the table useless while asserting chain identity
 * between unrelated shops that share a generic name. Each shop keeps its own
 * store_locations.name, so nothing is lost.
 *
 * @param db - Connection to query.
 * @param key - Brand key from {@link groupBrands}.
 * @param group - That key's display name.
 * @param countryCode - ISO 3166-1 alpha-2 of the extract.
 * @returns The discounter id to use.
 */
export async function resolveDiscounterId(
    db: Queryable,
    key: string,
    group: BrandGroup,
    countryCode: string,
): Promise<string> {
    const name = key === INDEPENDENT ? `Independent (${countryCode})` : group.name;
    const preferred =
        key === INDEPENDENT ? `independent-${countryCode.toLowerCase()}` : slugify(name);

    const existing = await db.query<{ id: string }>(
        'SELECT id FROM discounters WHERE code = $1 AND country_code = $2',
        [preferred, countryCode],
    );
    if (existing.rows[0]) return existing.rows[0].id;

    // The code is UNIQUE table-wide, so a same-named brand already registered
    // for another country (Spar exists in AT, IT and SI) needs its own code
    // rather than stealing that row's country.
    const taken = await db.query<{ id: string }>('SELECT id FROM discounters WHERE code = $1', [
        preferred,
    ]);
    const code = taken.rows[0] ? `${preferred}-${countryCode.toLowerCase()}` : preferred;

    const inserted = await db.query<{ id: string }>(
        `INSERT INTO discounters (code, name, country_code) VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE SET code = EXCLUDED.code
         RETURNING id`,
        [code, name, countryCode],
    );
    const row = inserted.rows[0];
    if (!row) throw new Error(`Could not resolve a discounter for "${name}".`);
    return row.id;
}

export interface ImportStats {
    inserted: number;
    updated: number;
    discounters: number;
    openingHourRows: number;
}

/**
 * Writes the built stores.
 *
 * The upsert is hand-written rather than StoreLocationRepository#upsertByExternalId
 * for one reason, and it is the whole point of issue #212: the repository's
 * ON CONFLICT targets the table-wide UNIQUE (discounter_id, external_store_id),
 * which the purchased Geolocet rows share, so its DO UPDATE branch could
 * rewrite one. This statement's arbiter is migration 0016's partial index —
 * `WHERE source = 'osm'` — which Postgres restricts arbitration to, so no
 * non-OSM row is reachable from here. Nothing in this function SELECTs
 * store_locations either: there is no dedupe lookup to accidentally widen.
 *
 * @param db - Connection to write through.
 * @param build - Output of {@link buildStores}.
 * @param countryCode - ISO 3166-1 alpha-2 of the extract, for new discounters.
 * @returns Counts of what was written.
 */
export async function importStores(
    db: Queryable,
    build: BuildResult,
    countryCode: string,
): Promise<ImportStats> {
    const discounterIds = new Map<string, string>();
    for (const [key, group] of build.groups) {
        discounterIds.set(key, await resolveDiscounterId(db, key, group, countryCode));
    }

    const stats: ImportStats = {
        inserted: 0,
        updated: 0,
        // Distinct rows, not distinct brand keys: several keys legitimately
        // resolve to one discounter (Q610492 "Spar" and the wikidata-less
        // "name:spar" group both land on the seeded 'spar' row).
        discounters: new Set(discounterIds.values()).size,
        openingHourRows: 0,
    };

    for (const store of build.stores) {
        const discounterId = discounterIds.get(store.brandKey);
        if (!discounterId) continue;

        const { rows } = await db.query<{ id: string; inserted: boolean }>(
            `INSERT INTO store_locations
                (discounter_id, external_store_id, name, address, city, postal_code,
                 location, phone, source)
             VALUES ($1, $2, $3, $4, $5, $6, ST_MakePoint($8, $7)::geography, NULL, 'osm')
             ON CONFLICT (discounter_id, external_store_id) WHERE source = 'osm'
             DO UPDATE SET
                name = EXCLUDED.name,
                address = EXCLUDED.address,
                city = EXCLUDED.city,
                postal_code = EXCLUDED.postal_code,
                location = EXCLUDED.location
             RETURNING id, (xmax = 0) AS inserted`,
            [
                discounterId,
                // 'osm:' namespace, enforced by migration 0016's CHECK: it is
                // what makes an OSM element id incapable of colliding with a
                // Geolocet store id on the table-wide unique constraint.
                `osm:${store.osmId}`,
                store.name,
                store.address,
                store.city,
                store.postalCode,
                store.latitude,
                store.longitude,
            ],
        );
        const row = rows[0];
        if (!row) throw new Error(`Upsert returned no row for ${store.osmId}.`);
        if (row.inserted) stats.inserted += 1;
        else stats.updated += 1;

        // Opening hours are replaced wholesale per store, as migration 0014
        // intends (it has no updated_at for exactly this reason). Scoped to
        // this store's own id, which only ever names an OSM row.
        await db.query('DELETE FROM store_opening_hours WHERE store_id = $1', [row.id]);
        for (const span of store.openingHours) {
            await db.query(
                `INSERT INTO store_opening_hours (store_id, day_of_week, opens_at, closes_at)
                 VALUES ($1, $2, $3, $4)`,
                [row.id, span.dayOfWeek, span.opensAt, span.closesAt],
            );
            stats.openingHourRows += 1;
        }
    }

    return stats;
}

/** @returns The extract as text: the given file path, or stdin if none. */
async function readInput(filePath: string | undefined): Promise<string> {
    if (filePath) return readFile(filePath, 'utf8');
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks).toString('utf8');
}

async function main(): Promise<void> {
    // Same guard as scripts/import-geolocet-spar-data.mjs and scripts/seed.ts:
    // a bulk import belongs in a human's hands against a database they chose,
    // never on the deploy path.
    if (process.env.NODE_ENV === 'production') {
        console.error('Refusing to run against NODE_ENV=production.');
        process.exitCode = 1;
        return;
    }

    const args = process.argv.slice(2);
    const countryArg = args.find((a) => a.startsWith('--country='))?.slice('--country='.length);
    const filePath = args.find((a) => !a.startsWith('--'));

    // Required rather than guessed: Overpass output carries no country of its
    // own, and per-element `addr:country` is missing on a third of the
    // Austrian extract — deriving from it would split one brand across two
    // discounter rows depending on which shops happen to be tagged.
    if (!countryArg || !/^[A-Za-z]{2}$/.test(countryArg)) {
        console.error(
            'Usage: import-osm-supermarkets.ts --country=AT [extract.json]\n' +
                '--country is the ISO 3166-1 alpha-2 code of the area the extract covers.',
        );
        process.exitCode = 1;
        return;
    }
    const countryCode = countryArg.toUpperCase();

    const raw = JSON.parse(await readInput(filePath)) as { elements?: OverpassElement[] };
    const elements = raw.elements ?? [];
    if (elements.length === 0) {
        console.error('No elements in the extract — was it exported as Overpass JSON?');
        process.exitCode = 1;
        return;
    }

    const build = buildStores(elements);
    for (const warning of build.ambiguous) console.warn(`Ambiguous: ${warning}`);

    const stats = await importStores(getPool(), build, countryCode);
    console.log(
        `Imported ${String(countryCode)} supermarkets from OSM: ` +
            `${String(stats.inserted)} inserted, ${String(stats.updated)} updated, ` +
            `${String(build.droppedNoCoordinates)} dropped (no coordinates), ` +
            `${String(build.keptWithoutName)} kept without a name, ` +
            `${String(stats.discounters)} discounters, ` +
            `${String(stats.openingHourRows)} opening-hour rows.`,
    );
}

// Only run when executed directly, so the tests can import the pure helpers
// without performing an import as a side effect.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch((error: unknown) => {
        console.error(error);
        process.exitCode = 1;
    });
}
