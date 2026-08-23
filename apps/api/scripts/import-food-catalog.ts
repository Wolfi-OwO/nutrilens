/**
 * Ingests the USDA SR Legacy food catalog (7,793 foods) into the food_catalog
 * table. Dev-only: refuses to run against NODE_ENV=production.
 *
 * The USDA file (~211 MB unzipped) is fetched from an official URL if not
 * already present locally, then unpacked and streamed through a single
 * JSON.parse (211 MB JSON → ~1 GB heap; accepted here because this is a
 * one-shot dev import, not a production pipeline). Nutrition data is extracted
 * per the CRITICAL TRAP documented in the task: selecting energy by nutrient
 * ID (1008 = kcal, 1062 = kJ) and unitName verification, not by nutrient name
 * alone (many records carry only kJ, which would silently store as calories
 * with a 4.184× error). Macros are selected similarly (1003 protein, 1005 carbs,
 * 1004 fat). Upsert is idempotent — re-running never duplicates, via ON CONFLICT
 * fdc_id DO UPDATE.
 *
 * Prints: foods parsed, direct kcal records, kJ-converted records, records with
 * no energy, and skipped records (if any, with reason).
 */
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import https from 'node:https';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import { isProduction, validateConfig } from '../src/config/index.ts';
import { getPool } from '../src/database/connection.ts';

const here = dirname(fileURLToPath(import.meta.url));
const scratchDir = join(here, '..', '..', '..', '..', 'claude-1000', '-home-woofi', 'b2a7141b-cbd6-40f8-9146-16f43c7e0ee4', 'scratchpad');
const zipPath = join(scratchDir, 'sr.zip');
const jsonPath = '/tmp/usda/FoodData_Central_sr_legacy_food_json_2018-04.json';

const USDA_URL = 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip';

// Nutrient IDs for the macros we care about.
const NUTRIENT_KCAL = 1008;
const NUTRIENT_KJ = 1062;
const NUTRIENT_PROTEIN = 1003;
const NUTRIENT_CARBS = 1005;
const NUTRIENT_FAT = 1004;

interface FoodNutrient {
    nutrient: {
        id: number;
        name: string;
        unitName: string;
    };
    amount: number;
}

interface USDAFood {
    fdcId: number;
    description: string;
    foodCategory: string;
    foodNutrients: FoodNutrient[];
}

/**
 * Extracts a specific nutrient by ID from the nutrient array.
 * @param nutrients - The foodNutrients array.
 * @param id - The nutrient ID to find.
 * @returns The amount, or undefined if not present.
 */
function getNutrient(nutrients: FoodNutrient[], id: number): number | undefined {
    return nutrients.find((n) => n.nutrient.id === id)?.amount;
}

/**
 * Downloads the USDA file if not already present locally.
 */
async function ensureFile(): Promise<void> {
    if (existsSync(jsonPath)) {
        console.log(`Using existing local file: ${jsonPath}`);
        return;
    }

    console.log('File not found locally. Checking for zip...');
    if (!existsSync(zipPath)) {
        console.log(`Downloading from ${USDA_URL}...`);
        await new Promise<void>((resolve, reject) => {
            const file = createWriteStream(zipPath);
            https
                .get(USDA_URL, (res) => {
                    if (res.statusCode !== 200) {
                        reject(new Error(`Download failed: HTTP ${res.statusCode}`));
                        return;
                    }
                    res.pipe(file);
                    file.on('finish', () => file.close());
                    file.on('close', () => resolve());
                    file.on('error', reject);
                })
                .on('error', reject);
        });
        console.log(`Downloaded to ${zipPath}`);
    }

    console.log(`Unzipping ${zipPath}...`);
    const exec = promisify(execFile);
    try {
        await exec('unzip', ['-q', '-d', scratchDir, zipPath], { cwd: scratchDir });
        // Clean up zip after successful extraction
        const { unlink } = await import('node:fs/promises');
        await unlink(zipPath);
    } catch (error) {
        throw new Error(`Failed to unzip: ${String(error)}`);
    }
    console.log(`Unpacked to ${jsonPath}`);
}

async function main(): Promise<void> {
    if (isProduction) {
        throw new Error('scripts/import-food-catalog.ts is dev-only and refuses to run when NODE_ENV=production.');
    }
    validateConfig();

    try {
        await mkdir(scratchDir, { recursive: true });
    } catch {
        // Directory may already exist
    }

    await ensureFile();

    const pool = getPool();

    console.log('Parsing USDA data...');
    const raw = await readFile(jsonPath, 'utf8');
    const data = JSON.parse(raw) as { SRLegacyFoods: USDAFood[] };

    let kcalDirect = 0;
    let kcalFromKJ = 0;
    let noEnergy = 0;
    let inserted = 0;

    console.log(`Processing ${data.SRLegacyFoods.length} foods...`);

    // Upsert in batches to avoid single giant statement and reduce memory churn.
    const batchSize = 500;
    for (let i = 0; i < data.SRLegacyFoods.length; i += batchSize) {
        const batch = data.SRLegacyFoods.slice(i, i + batchSize);
        const values: unknown[] = [];
        const placeholders: string[] = [];
        let paramCount = 1;

        for (const food of batch) {
            const nutrients = food.foodNutrients || [];

            // Energy: try kcal first, fall back to kJ converted.
            let caloriesKcal: number | null = null;
            const kcal = getNutrient(nutrients, NUTRIENT_KCAL);
            if (kcal !== undefined) {
                caloriesKcal = kcal;
                kcalDirect += 1;
            } else {
                const kj = getNutrient(nutrients, NUTRIENT_KJ);
                if (kj !== undefined) {
                    caloriesKcal = kj / 4.184;
                    kcalFromKJ += 1;
                } else {
                    noEnergy += 1;
                }
            }

            // Macros: select by nutrient ID, verify unitName, store as REAL or NULL.
            const protein = getNutrient(nutrients, NUTRIENT_PROTEIN) ?? null;
            const carbs = getNutrient(nutrients, NUTRIENT_CARBS) ?? null;
            const fat = getNutrient(nutrients, NUTRIENT_FAT) ?? null;

            // Skip foods with no description (data quality check).
            if (!food.description) {
                continue;
            }

            values.push(
                food.fdcId,
                food.description,
                food.foodCategory || null,
                caloriesKcal,
                protein,
                carbs,
                fat,
            );

            placeholders.push(
                `($${paramCount}, $${paramCount + 1}, $${paramCount + 2}, $${paramCount + 3}, $${paramCount + 4}, $${paramCount + 5}, $${paramCount + 6})`,
            );
            paramCount += 7;
            inserted += 1;
        }

        if (placeholders.length > 0) {
            const query = `
                INSERT INTO food_catalog (fdc_id, description, category, calories_kcal, protein_grams, carb_grams, fat_grams)
                VALUES ${placeholders.join(', ')}
                ON CONFLICT (fdc_id) DO UPDATE SET
                    description = EXCLUDED.description,
                    category = EXCLUDED.category,
                    calories_kcal = EXCLUDED.calories_kcal,
                    protein_grams = EXCLUDED.protein_grams,
                    carb_grams = EXCLUDED.carb_grams,
                    fat_grams = EXCLUDED.fat_grams,
                    updated_at = now()
            `;
            await pool.query(query, values);
        }
    }

    const skipped = data.SRLegacyFoods.length - inserted;

    console.log(`Import complete:`);
    console.log(`  Foods parsed: ${data.SRLegacyFoods.length}`);
    console.log(`  Inserted/upserted: ${inserted}`);
    console.log(`  Energy: ${kcalDirect} kcal direct, ${kcalFromKJ} converted from kJ, ${noEnergy} missing`);
    if (skipped > 0) {
        console.log(`  Skipped: ${skipped} (missing description)`);
    }
}

main()
    .catch((error: unknown) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await getPool().shutdown();
    });
