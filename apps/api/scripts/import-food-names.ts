/**
 * Loads the curated German/Austrian food names from src/data/food-names.de.json
 * into food_catalog_names (issue #208). Dev-only: refuses to run against
 * NODE_ENV=production, same guard as scripts/import-geolocet-spar-data.mjs and
 * scripts/seed.ts.
 *
 * Deliberately a script and NOT a migration. The container runs
 * `run-migrations && node dist/server.js` and scales to zero, so anything slow
 * or fragile on that path is a crash loop on every cold start, not a rollback.
 * This job issues ~290 searches against the catalog; it belongs in a human's
 * hands, run once against a live database.
 *
 * Idempotent: ON CONFLICT DO NOTHING against the natural primary key
 * (fdc_id, lang, name), so re-running after editing the JSON only adds the new
 * rows. It never deletes — pulling a bad alias is a deliberate DELETE, not a
 * side effect of a re-run.
 *
 * Usage: node --experimental-strip-types scripts/import-food-names.ts
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config, isProduction, validateConfig } from '../src/config/index.ts';
import { getPool } from '../src/database/connection.ts';
import { describeDatabaseTarget } from '../src/lib/database-url.ts';
import { FoodCatalogRepository } from '../src/repository/food-catalog.repository.ts';

const here = dirname(fileURLToPath(import.meta.url));
const namesFile = join(here, '..', 'src', 'data', 'food-names.de.json');

/** Provenance written into food_catalog_names.source for every row this script inserts. */
const SOURCE = 'curated';

/** BCP-47 tag used when an entry does not carry its own; the file is the German list. */
const DEFAULT_LANG = 'de';

interface FoodNameEntry {
    /** The German or Austrian word a user would actually type. */
    name: string;
    /**
     * An English search term, NOT an fdc_id. Hand-mapping ~290 fdc_ids is the
     * expensive, brittle option: USDA ids are opaque, unreviewable in a diff, and
     * every dataset refresh would need them re-checked. Resolving through the
     * search the app already runs is cheap and self-correcting — improve the
     * ranking and this list improves with it.
     */
    en: string;
    /** BCP-47 tag. 'de-AT' marks the Austrian regionalisms; omitted means 'de'. */
    lang?: string;
    /** Escape hatch: pin the id when auto-resolution picks the wrong food. */
    fdcId?: number;
}

async function main(): Promise<void> {
    if (isProduction) {
        console.error('Refusing to run against NODE_ENV=production.');
        process.exitCode = 1;
        return;
    }
    validateConfig();

    const entries = JSON.parse(await readFile(namesFile, 'utf8')) as FoodNameEntry[];
    const pool = getPool();
    const catalog = new FoodCatalogRepository(pool);

    const unresolved: FoodNameEntry[] = [];
    let inserted = 0;
    let alreadyPresent = 0;
    let pinned = 0;

    for (const entry of entries) {
        const lang = entry.lang ?? DEFAULT_LANG;

        let fdcId = entry.fdcId;
        let matched = '(pinned)';
        if (fdcId === undefined) {
            // ponytail: top hit of the existing search, nothing smarter. Its ceiling
            // is real — the search ranks for a human picking from a list of ten, so a
            // generic term like "snack" or "cake" resolves to whatever sorts first,
            // and there is no signal here to tell a good first hit from a mediocre
            // one. That is why every pair is printed: review is the check. Upgrade
            // path when a pair is wrong is already in the schema — pin "fdcId" on that
            // entry in food-names.de.json, no code change.
            const [best] = await catalog.search(entry.en, 1);
            if (!best) {
                unresolved.push(entry);
                continue;
            }
            fdcId = best.fdcId;
            matched = best.description;
        } else {
            pinned += 1;
        }

        const { rowCount } = await pool.query(
            `INSERT INTO food_catalog_names (fdc_id, lang, name, source)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING`,
            [fdcId, lang, entry.name, SOURCE],
        );

        if (rowCount === 0) {
            alreadyPresent += 1;
        } else {
            inserted += 1;
        }

        console.log(
            `${rowCount === 0 ? 'skip ' : 'add  '} ${lang.padEnd(5)} ${entry.name.padEnd(22)} -> ${String(fdcId).padEnd(8)} ${matched}`,
        );
    }

    // Unresolved terms are the actionable output: each one is a German word the
    // app still cannot find, and the fix is either a better `en` term or an
    // `fdcId` pin. Printed last so it survives a scrolled-off log.
    if (unresolved.length > 0) {
        console.log(`\n${String(unresolved.length)} UNRESOLVED — no catalog hit for the English term:`);
        for (const entry of unresolved) {
            console.log(`  ${entry.name} (searched "${entry.en}")`);
        }
    }

    // Host and database only, never config.databaseUrl itself: the connection
    // string carries the password in its userinfo, and no summary line is
    // worth putting a credential into scrollback or a CI log.
    const target = describeDatabaseTarget(config.databaseUrl);
    console.log(
        `\n${String(entries.length)} entries: ${String(inserted)} inserted, ` +
            `${String(alreadyPresent)} already present, ${String(unresolved.length)} unresolved, ` +
            `${String(pinned)} pinned by fdcId${target === null ? '' : ` (against ${target})`}.`,
    );
}

main()
    .catch((error: unknown) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await getPool().shutdown();
    });
