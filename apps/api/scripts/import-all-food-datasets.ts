/**
 * Ingests USDA food catalogs into the food_catalog table:
 * 1. SR Legacy (7,793 raw ingredients and branded products)
 * 2. Survey Foods (prepared dishes from dietary surveys, ~7k+ foods)
 * 3. Foundation Foods (~462 KB, higher-quality nutrient data)
 *
 * Dev-only: refuses to run against NODE_ENV=production.
 *
 * Each dataset is marked with its data_type for provenance tracking and
 * ranking: prepared dishes (survey_food) rank higher than raw ingredients
 * for matching common meal names like "pizza" or "hamburger".
 */
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import https from 'node:https';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';

import { isProduction, validateConfig } from '../src/config/index.ts';
import { getPool } from '../src/database/connection.ts';
import type { Queryable } from '../src/database/connection.ts';

const scratchDir = '/tmp/nutrilens-import-scratch';

interface ImportStats {
  total: number;
  inserted: number;
  kcalDirect: number;
  kcalFromKJ: number;
  noEnergy: number;
}

interface Dataset {
  name: 'sr_legacy' | 'survey_food' | 'foundation_food';
  url: string;
  jsonPath: string;
  zipPath?: string;
  jsonKey: string;
}

const datasets: Dataset[] = [
  {
    name: 'sr_legacy',
    url: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip',
    jsonPath: '/tmp/usda/FoodData_Central_sr_legacy_food_json_2018-04.json',
    jsonKey: 'SRLegacyFoods',
  },
  {
    name: 'survey_food',
    url: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_survey_food_json_2024-10-31.zip',
    zipPath: join(scratchDir, 'survey_food.zip'),
    jsonPath: join(scratchDir, 'surveyDownload.json'),
    jsonKey: 'SurveyFoods',
  },
  {
    name: 'foundation_food',
    url: 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2026-04-30.zip',
    zipPath: join(scratchDir, 'foundation_food.zip'),
    jsonPath: join(scratchDir, 'FoodData_Central_foundation_food_json_2026-04-30.json'),
    jsonKey: 'FoundationFoods',
  },
];

// Nutrient IDs for macros.
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

function getNutrient(nutrients: FoodNutrient[], id: number): number | undefined {
  return nutrients.find((n) => n.nutrient.id === id)?.amount;
}

async function downloadFile(url: string, outPath: string): Promise<void> {
  console.log(`Downloading ${url}...`);
  await new Promise<void>((resolve, reject) => {
    const file = createWriteStream(outPath);
    https
      .get(url, (res) => {
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
  console.log(`Downloaded to ${outPath}`);
}

async function unzipFile(zipPath: string, scratchDir: string): Promise<void> {
  console.log(`Unzipping ${zipPath}...`);
  const exec = promisify(execFile);
  try {
    await exec('unzip', ['-q', '-d', scratchDir, zipPath], { cwd: scratchDir });
    // Clean up zip after extraction
    await rm(zipPath);
  } catch (error) {
    throw new Error(`Failed to unzip: ${String(error)}`);
  }
  console.log(`Unpacked to ${scratchDir}`);
}

async function ensureDataset(dataset: Dataset): Promise<{ jsonPath: string; jsonKey: string }> {
  // SR Legacy is already present locally.
  if (dataset.name === 'sr_legacy') {
    if (!existsSync(dataset.jsonPath)) {
      throw new Error(`SR Legacy file not found at ${dataset.jsonPath}`);
    }
    console.log(`Using existing local file: ${dataset.jsonPath}`);
    return { jsonPath: dataset.jsonPath, jsonKey: dataset.jsonKey };
  }

  // For other datasets, check if JSON exists; if not, download and unzip.
  if (!dataset.zipPath) {
    throw new Error(`No zipPath defined for dataset ${dataset.name}`);
  }

  if (existsSync(dataset.jsonPath)) {
    console.log(`Using existing local file: ${dataset.jsonPath}`);
  } else {
    if (!existsSync(dataset.zipPath)) {
      await downloadFile(dataset.url, dataset.zipPath);
    }
    await unzipFile(dataset.zipPath, scratchDir);
  }

  return { jsonPath: dataset.jsonPath, jsonKey: dataset.jsonKey };
}

async function importDataset(
  pool: Queryable,
  dataset: Dataset,
  jsonPath: string,
  jsonKey: string,
): Promise<ImportStats> {
  console.log(`Parsing ${dataset.name}...`);
  const raw = await readFile(jsonPath, 'utf8');
  const data = JSON.parse(raw) as Record<string, USDAFood[]>;
  const foods = data[jsonKey];

  if (!foods || !Array.isArray(foods)) {
    throw new Error(`No foods found under key "${jsonKey}" in ${jsonPath}`);
  }

  let kcalDirect = 0;
  let kcalFromKJ = 0;
  let noEnergy = 0;
  let inserted = 0;

  console.log(`Processing ${foods.length} foods from ${dataset.name}...`);

  const batchSize = 500;
  for (let i = 0; i < foods.length; i += batchSize) {
    const batch = foods.slice(i, i + batchSize);
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let paramCount = 1;

    for (const food of batch) {
      // Skip foods with no description or null food object.
      if (!food || !food.description) {
        continue;
      }

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

      // Macros.
      const protein = getNutrient(nutrients, NUTRIENT_PROTEIN) ?? null;
      const carbs = getNutrient(nutrients, NUTRIENT_CARBS) ?? null;
      const fat = getNutrient(nutrients, NUTRIENT_FAT) ?? null;

      values.push(
        food.fdcId,
        food.description,
        food.foodCategory || null,
        caloriesKcal,
        protein,
        carbs,
        fat,
        dataset.name,
      );

      placeholders.push(
        `($${paramCount}, $${paramCount + 1}, $${paramCount + 2}, $${paramCount + 3}, $${paramCount + 4}, $${paramCount + 5}, $${paramCount + 6}, $${paramCount + 7})`,
      );
      paramCount += 8;
      inserted += 1;
    }

    if (placeholders.length > 0) {
      const query = `
        INSERT INTO food_catalog (fdc_id, description, category, calories_kcal, protein_grams, carb_grams, fat_grams, data_type)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (fdc_id) DO UPDATE SET
          description = EXCLUDED.description,
          category = EXCLUDED.category,
          calories_kcal = EXCLUDED.calories_kcal,
          protein_grams = EXCLUDED.protein_grams,
          carb_grams = EXCLUDED.carb_grams,
          fat_grams = EXCLUDED.fat_grams,
          data_type = EXCLUDED.data_type,
          updated_at = now()
      `;
      await pool.query(query, values);
    }
  }

  return { total: foods.length, inserted, kcalDirect, kcalFromKJ, noEnergy };
}

async function main(): Promise<void> {
  if (isProduction) {
    throw new Error('scripts/import-all-food-datasets.ts is dev-only and refuses to run when NODE_ENV=production.');
  }
  validateConfig();

  try {
    await mkdir(scratchDir, { recursive: true });
  } catch {
    // Directory may already exist
  }

  const pool = getPool();

  const results: Record<string, ImportStats> = {};

  for (const dataset of datasets) {
    const { jsonPath, jsonKey } = await ensureDataset(dataset);
    const stats = await importDataset(pool, dataset, jsonPath, jsonKey);
    results[dataset.name] = stats;

    console.log(`${dataset.name} complete:`);
    console.log(`  Total foods: ${stats.total}`);
    console.log(`  Inserted/upserted: ${stats.inserted}`);
    console.log(
      `  Energy: ${stats.kcalDirect} kcal direct, ${stats.kcalFromKJ} converted from kJ, ${stats.noEnergy} missing`,
    );
  }

  console.log('\n=== Import Summary ===');
  let totalInserted = 0;
  for (const [name, stats] of Object.entries(results)) {
    totalInserted += stats.inserted;
    console.log(`${name}: ${stats.inserted} foods`);
  }
  console.log(`Total: ${totalInserted} foods in catalog`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().shutdown();
  });
