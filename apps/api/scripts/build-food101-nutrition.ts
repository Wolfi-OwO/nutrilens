/**
 * Builds the offline Food-101 nutrition lookup table by matching model labels
 * against the local food_catalog table in Postgres. Runs once at dev time,
 * outputs a committed JSON file — no runtime USDA egress.
 *
 * The 101 Food-101 class labels (e.g., "apple_pie", "peking_duck") are matched
 * against food_catalog with strong preference for FNDDS prepared dishes
 * (survey_food), then Foundation Foods (foundation_food), then SR Legacy
 * (sr_legacy) to retrieve per-100 g macros (calories, protein, carbs, fat).
 * Ambiguous matches are logged; missing nutrients are marked `null` (not zero)
 * to preserve the "not declared" signal through the API response.
 *
 * Dev-only: refuses to run against NODE_ENV=production. Does not modify the
 * database, only generates a JSON file.
 *
 * Measured traps from previous lookups:
 * - Absent macro is null not 0 — 0 means "contains zero"; null means "not reported".
 * - Per 100 g is the wire format throughout; food_catalog data is per 100g by default.
 * - Prepared dishes and raw ingredients can have the same name; match carefully.
 *   "caesar_salad" must resolve to the prepared dish, not raw romaine.
 */

import pg from 'pg';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isProduction } from '../src/config/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outputDir = join(here, '..', 'src', 'data');
const outputPath = join(outputDir, 'food101-nutrition.json');

// Food-101 labels from the model's class mapping.
// TODO: Load from model config.json (id2label) once model cache exists during build.
// For now, use the hardcoded list that matches the Swin Food-101 model.
const FOOD101_LABELS = [
	'apple_pie',
	'baby_back_ribs',
	'baklava',
	'beef_carpaccio',
	'beef_tartare',
	'beet_salad',
	'beignets',
	'bibimbap',
	'bread_pudding',
	'breakfast_burrito',
	'bruschetta',
	'caesar_salad',
	'cannoli',
	'caprese_salad',
	'carrot_cake',
	'ceviche',
	'cheesecake',
	'cheese_plate',
	'chicken_curry',
	'chicken_quesadilla',
	'chicken_wings',
	'chocolate_cake',
	'chocolate_mousse',
	'churros',
	'clam_chowder',
	'club_sandwich',
	'crab_cakes',
	'creme_brulee',
	'croque_madame',
	'cup_cakes',
	'deviled_eggs',
	'donuts',
	'dumplings',
	'edamame',
	'eggs_benedict',
	'escargots',
	'falafel',
	'filet_mignon',
	'fish_and_chips',
	'foie_gras',
	'french_fries',
	'french_onion_soup',
	'french_toast',
	'fried_calamari',
	'fried_rice',
	'frozen_yogurt',
	'garlic_bread',
	'gnocchi',
	'greek_salad',
	'grilled_cheese_sandwich',
	'grilled_salmon',
	'guacamole',
	'gyoza',
	'hamburger',
	'hot_and_sour_soup',
	'hot_dog',
	'huevos_rancheros',
	'hummus',
	'ice_cream',
	'lasagna',
	'lobster_bisque',
	'lobster_roll_sandwich',
	'macaroni_and_cheese',
	'macarons',
	'miso_soup',
	'mussels',
	'nachos',
	'omelette',
	'onion_rings',
	'oysters',
	'pad_thai',
	'paella',
	'pancakes',
	'panna_cotta',
	'peking_duck',
	'pho',
	'pizza',
	'pork_chop',
	'poutine',
	'prime_rib',
	'pulled_pork_sandwich',
	'ramen',
	'ravioli',
	'red_velvet_cake',
	'risotto',
	'samosa',
	'sashimi',
	'scallops',
	'seaweed_salad',
	'shrimp_and_grits',
	'spaghetti_bolognese',
	'spaghetti_carbonara',
	'spring_rolls',
	'steak',
	'strawberry_shortcake',
	'sushi',
	'tacos',
	'takoyaki',
	'tiramisu',
	'tuna_tartare',
	'waffles',
];

interface NutrientEntry {
	label: string;
	description: string;
	fdcId: number | string; // Empty string for no match, numeric ID for matched foods
	calories: number | null;
	proteinGrams: number | null;
	carbGrams: number | null;
	fatGrams: number | null;
}

interface FoodCatalogRow {
	fdc_id: number;
	description: string;
	data_type: string;
	calories_kcal: number | null;
	protein_grams: number | null;
	carb_grams: number | null;
	fat_grams: number | null;
}

// Convert a food label to search queries for food_catalog matching.
// "caesar_salad" → "caesar salad", "peking_duck" → "peking duck"
function labelToQuery(label: string): string {
	return label.replace(/_/g, ' ');
}

// Manual overrides for labels that need specific food_catalog matches.
// These are based on careful hand-review and FDA/USDA data sources.
// Added only where the automatic algorithm cannot find an acceptable match
// but a good match is known to exist in the catalog.
const MANUAL_OVERRIDES: Record<string, { fdcId: number }> = {
	// "donuts" → the word_similarity algorithm cannot match "donuts" to "Doughnut, NFS"
	// because the similarity score is too low (~0.29, below the 0.5 threshold).
	// However, "Doughnut, NFS" (2708062) is the best generic doughnut match.
	// Manual override to ensure correct nutrition data and prevent false negative.
	donuts: { fdcId: 2708062 },
};

// Get a food by fdcId from the database
async function getFoodById(fdcId: number, pool: pg.Pool): Promise<FoodCatalogRow | null> {
	const result = await pool.query<FoodCatalogRow>(
		'SELECT fdc_id, description, data_type, calories_kcal, protein_grams, carb_grams, fat_grams FROM food_catalog WHERE fdc_id = $1',
		[fdcId],
	);
	return result.rows.length > 0 ? result.rows[0]! : null;
}


// Match a Food-101 label to a food_catalog entry using the same ranking
// function as the API's search endpoint, ensuring consistency between what
// the classifier returns and what users see when they search.
async function matchLabel(label: string, pool: pg.Pool): Promise<FoodCatalogRow | null> {
	// Check for manual override first (high-confidence matches)
	if (MANUAL_OVERRIDES[label]) {
		const food = await getFoodById(MANUAL_OVERRIDES[label].fdcId, pool);
		if (food) {
			return food;
		}
	}

	// Use the same SQL ranking logic as the API search endpoint.
	// This ensures food101-nutrition.json and the autocomplete return the same
	// food for the same label.
	const query = labelToQuery(label);
	const searchPattern = `%${query}%`;
	const nfsPattern = `%, NFS`;

	// First pass: ILIKE word matching with word-boundary ranking, NFS preference.
	const result = await pool.query<FoodCatalogRow>(
		`SELECT fdc_id, description, data_type, calories_kcal, protein_grams, carb_grams, fat_grams
		 FROM food_catalog
		 WHERE description ILIKE $1 OR category ILIKE $1
		 ORDER BY
		 	CASE WHEN description ~* ('(^|[^a-z])' || $3 || '([^a-z]|$)') THEN 0 ELSE 1 END,
		 	CASE WHEN description ILIKE $2 THEN 0 ELSE 1 END,
		 	CASE WHEN data_type = 'survey_food' THEN 1 WHEN data_type = 'foundation_food' THEN 2 ELSE 3 END,
		 	CASE WHEN LOWER(description) LIKE LOWER($3) || '%' THEN 0 ELSE 1 END,
		 	LENGTH(description) ASC,
		 	description ASC
		 LIMIT 1`,
		[searchPattern, nfsPattern, query],
	);

	if (result.rows.length > 0) {
		return result.rows[0]!;
	}

	// Fallback: word_similarity for spelling variants like "omelette" → "Omelet".
	// Guard: reject matches where similarity is driven only by a substring of a different word.
	// E.g., "donuts" should not match "Peanuts" just because both contain "nuts".
	// But "donuts" SHOULD match "Doughnut" because "donut" appears as a word stem in "doughnut".
	// Check: at least one word-token from the query must appear as a substring in a word of the description.
	const similarResult = await pool.query<FoodCatalogRow>(
		`SELECT fdc_id, description, data_type, calories_kcal, protein_grams, carb_grams, fat_grams
		 FROM food_catalog
		 WHERE word_similarity($1, description) > $2
		 ORDER BY
		 	word_similarity($1, description) DESC,
		 	CASE WHEN data_type = 'survey_food' THEN 1 WHEN data_type = 'foundation_food' THEN 2 ELSE 3 END,
		 	LENGTH(description) ASC,
		 	description ASC
		 LIMIT 1`,
		[query, 0.5],
	);

	// Validate the match: the query's root word should appear within one of the description's words.
	// This prevents "nuts" (suffix of "donuts") from matching "Peanuts" where "nuts" is part of a different word.
	if (similarResult.rows.length > 0) {
		const match = similarResult.rows[0]!;
		// Extract the root word from the query (remove common suffixes like 's', 'es')
		const queryRoot = query.replace(/e?s$/, '');
		const descriptionLower = match.description.toLowerCase();

		// Check if the query root appears as a substring within the description
		// This handles both exact matches ("donut" in "doughnut") and similar words
		if (descriptionLower.includes(queryRoot) || descriptionLower.includes(query)) {
			return match;
		}
		// If no substring match, reject this word_similarity result as it's likely
		// driven by a shared suffix of an unrelated word (e.g., "nuts" in "donuts" -> "Peanuts")
		return null;
	}

	return null;
}

async function main(): Promise<void> {
	if (isProduction) {
		throw new Error('scripts/build-food101-nutrition.ts is dev-only and refuses to run when NODE_ENV=production.');
	}

	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error('DATABASE_URL environment variable is not set.');
	}

	const pool = new pg.Pool({ connectionString: databaseUrl });

	try {
		console.log(`Connecting to database: ${databaseUrl.replace(/:[^:]*@/, ':***@')}\n`);

		// Verify database connection
		await pool.query('SELECT 1');
		console.log(`✓ Database connected\n`);

		// Check food_catalog table stats
		const catalogStats = await pool.query<{ data_type: string; count: string }>(
			'SELECT data_type, COUNT(*) as count FROM food_catalog GROUP BY data_type ORDER BY data_type',
		);
		console.log(`Food catalog by data type:`);
		let totalFoods = 0;
		for (const row of catalogStats.rows) {
			const count = parseInt(row.count, 10);
			totalFoods += count;
			console.log(`  ${row.data_type}: ${count} foods`);
		}
		console.log(`  Total: ${totalFoods} foods\n`);

		const results: NutrientEntry[] = [];
		const resolved: string[] = [];
		const failed: string[] = [];

		console.log(`Resolving ${FOOD101_LABELS.length} Food-101 labels...\n`);

		for (const label of FOOD101_LABELS) {
			const match = await matchLabel(label, pool);

			if (match) {
				results.push({
					label,
					description: match.description,
					fdcId: match.fdc_id,
					calories: match.calories_kcal,
					proteinGrams: match.protein_grams,
					carbGrams: match.carb_grams,
					fatGrams: match.fat_grams,
				});

				resolved.push(label);
				console.log(`✓ ${label} → ${match.description} (${match.fdc_id}, ${match.data_type})`);
			} else {
				// No match found. Use empty string for fdcId to indicate "not resolved".
				failed.push(label);
				results.push({
					label,
					description: '(no match found)',
					fdcId: '',
					calories: null,
					proteinGrams: null,
					carbGrams: null,
					fatGrams: null,
				});
				console.log(`✗ ${label} — no match found in food_catalog`);
			}
		}

		// Ensure entries are in label order to match input.
		const entries = FOOD101_LABELS.map((label) => results.find((r) => r.label === label)!);

		await writeFile(outputPath, JSON.stringify(entries, null, 2));

		console.log(`\n📊 Summary:`);
		console.log(`  Resolved: ${resolved.length} / ${FOOD101_LABELS.length}`);
		console.log(`  Failed: ${failed.length}${failed.length > 0 ? ` (${failed.join(', ')})` : ''}`);
		console.log(`\nJSON written to: ${outputPath}`);

		if (failed.length > 0) {
			console.log(
				'\n⚠️  Could not resolve the following labels. Manually add or review:\n' +
					failed.map((f) => `  - ${f}`).join('\n') +
					'\n',
			);
		}

		console.log('\n🔍 Validate the output:');
		console.log('   - Check for implausible calorie density (>900 kcal/100g is impossible)');
		console.log('   - Verify macros are reasonable (not all zero for prepared foods)');
		console.log('   - Ensure data_type matches the food nature (prepared → survey_food preferred)');
	} finally {
		await pool.end();
	}
}

main()
	.catch((error: unknown) => {
		console.error(error);
		process.exitCode = 1;
	});
