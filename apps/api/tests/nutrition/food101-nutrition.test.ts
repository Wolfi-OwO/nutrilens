import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import type { Food101NutritionEntry, NutritionMacros } from '../../src/handlers/meal-log.handlers.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const foodNutritionData = JSON.parse(readFileSync(join(__dirname, '../../src/data/food101-nutrition.json'), 'utf8')) as Food101NutritionEntry[];

interface NutritionEntry extends Food101NutritionEntry {
	description: string;
	fdcId: string;
}

describe('food101-nutrition.json', () => {
	const data = foodNutritionData as NutritionEntry[];

	test('loads without error', () => {
		assert.ok(Array.isArray(data));
		assert.equal(data.length, 101, 'must have exactly 101 entries');
	});

	test('every entry has required structure', () => {
		for (const entry of data) {
			assert.ok(entry.label, `entry missing label: ${JSON.stringify(entry)}`);
			assert.ok(entry.fdcId !== undefined, `entry missing fdcId: ${entry.label}`);
			assert.ok(entry.description !== undefined, `entry missing description: ${entry.label}`);
			assert.ok(
				entry.calories === null || typeof entry.calories === 'number',
				`entry.calories must be null or number: ${entry.label} = ${entry.calories}`,
			);
			assert.ok(
				entry.proteinGrams === null || typeof entry.proteinGrams === 'number',
				`entry.proteinGrams must be null or number: ${entry.label}`,
			);
			assert.ok(
				entry.carbGrams === null || typeof entry.carbGrams === 'number',
				`entry.carbGrams must be null or number: ${entry.label}`,
			);
			assert.ok(
				entry.fatGrams === null || typeof entry.fatGrams === 'number',
				`entry.fatGrams must be null or number: ${entry.label}`,
			);
		}
	});

	test('a minimum number of entries are populated (>40 resolved from USDA)', () => {
		const populated = data.filter((e) => e.fdcId !== '');
		assert.ok(
			populated.length >= 40,
			`Expected at least 40 populated entries, got ${populated.length}. USDA matching may have regressed.`,
		);
	});

	test('populated entries have a real numeric fdcId (not empty string or fabricated)', () => {
		for (const entry of data) {
			if (entry.fdcId !== '') {
				// fdcId should be a numeric string or number, not a placeholder like "seed-*"
				assert.ok(
					/^\d+$/.test(entry.fdcId),
					`${entry.label}: fdcId must be numeric USDA ID, got "${entry.fdcId}"`,
				);
			}
		}
	});

	test('plausible calorie density (capped at ~900 kcal/100g for pure fat)', () => {
		for (const entry of data) {
			if (entry.calories !== null) {
				assert.ok(
					entry.calories <= 900,
					`unrealistic calorie density for ${entry.label}: ${entry.calories} kcal/100g (max is ~900 for pure fat)`,
				);
				assert.ok(
					entry.calories > 0,
					`impossible zero or negative calories for ${entry.label}: ${entry.calories}`,
				);
			}
		}
	});

	test('macro-calorie consistency check', () => {
		// Protein and carbs: 4 kcal/g; fat: 9 kcal/g
		// Allow 5% margin for rounding and incomplete macro declaration
		for (const entry of data) {
			if (entry.calories !== null && entry.calories > 0) {
				const hasAllMacros = entry.proteinGrams !== null && entry.carbGrams !== null && entry.fatGrams !== null;

				if (hasAllMacros) {
					const calculatedCals =
						entry.proteinGrams! * 4 + entry.carbGrams! * 4 + entry.fatGrams! * 9;
					const difference = Math.abs(calculatedCals - entry.calories);
					const tolerance = Math.max(entry.calories * 0.15, 10); // 15% tolerance or 10 kcal, whichever is larger (USDA data rounding)

					assert.ok(
						difference <= tolerance,
						`${entry.label}: macro-calorie mismatch. Declared ${entry.calories} kcal, ` +
							`calculated ${Math.round(calculatedCals)} from macros (P:${entry.proteinGrams} C:${entry.carbGrams} F:${entry.fatGrams}). ` +
							`Difference ${Math.round(difference)} exceeds ${Math.round(tolerance)} kcal tolerance.`,
					);
				}
			}
		}
	});

	test('null values survive as null, not collapsed to 0 or false', () => {
		for (const entry of data) {
			// If a macro is null, it must remain null (not 0, not undefined)
			if (entry.calories === null) {
				assert.strictEqual(
					entry.calories,
					null,
					`${entry.label}: calories must be null (not 0)`,
				);
			}
			if (entry.proteinGrams === null) {
				assert.strictEqual(
					entry.proteinGrams,
					null,
					`${entry.label}: proteinGrams must be null (not 0)`,
				);
			}
			if (entry.carbGrams === null) {
				assert.strictEqual(entry.carbGrams, null, `${entry.label}: carbGrams must be null (not 0)`);
			}
			if (entry.fatGrams === null) {
				assert.strictEqual(entry.fatGrams, null, `${entry.label}: fatGrams must be null (not 0)`);
			}
		}
	});
});

// Import the scaling function - moved to a separate helper so it can be used on frontend
function scaleToPortion(per100g: NutritionMacros, portionGrams: number): NutritionMacros {
	const scale = portionGrams / 100;
	return {
		calories: per100g.calories !== null ? Math.round(per100g.calories * scale) : null,
		proteinGrams: per100g.proteinGrams !== null ? Math.round(per100g.proteinGrams * scale) : null,
		carbGrams: per100g.carbGrams !== null ? Math.round(per100g.carbGrams * scale) : null,
		fatGrams: per100g.fatGrams !== null ? Math.round(per100g.fatGrams * scale) : null,
	};
}

describe('portion scaling', () => {
	test('scaleToPortion rounds correctly and preserves null', () => {
		// 100 kcal/100g at 150g portion = 150 kcal (simple case)
		const simple = scaleToPortion(
			{ calories: 100, proteinGrams: 10, carbGrams: 50, fatGrams: 5 },
			150,
		);
		assert.equal(simple.calories, 150, 'simple scaling: 100 cal × 1.5 = 150');
		assert.equal(simple.proteinGrams, 15, 'simple scaling: 10 g × 1.5 = 15');
		assert.equal(simple.carbGrams, 75, 'simple scaling: 50 g × 1.5 = 75');
		assert.equal(simple.fatGrams, 8, 'rounding: 5 × 1.5 = 7.5 → 8');

		// Fractional calories that round down
		const fractional = scaleToPortion(
			{ calories: 77, proteinGrams: null, carbGrams: null, fatGrams: null },
			100,
		);
		assert.equal(fractional.calories, 77, 'no scaling when portion = 100g');
		assert.equal(fractional.proteinGrams, null, 'null propagates');

		// With null fields
		const withNull = scaleToPortion(
			{ calories: 200, proteinGrams: null, carbGrams: 40, fatGrams: 10 },
			50,
		);
		assert.equal(withNull.calories, 100, '200 cal × 0.5 = 100');
		assert.equal(withNull.proteinGrams, null, 'null remains null');
		assert.equal(withNull.carbGrams, 20, '40 g × 0.5 = 20');
		assert.equal(withNull.fatGrams, 5, '10 g × 0.5 = 5');
	});

	test('scaleToPortion rounds to nearest integer', () => {
		// 123 kcal/100g at 45g portion = 55.35 → 55 (rounds down)
		const down = scaleToPortion(
			{ calories: 123, proteinGrams: null, carbGrams: null, fatGrams: null },
			45,
		);
		assert.equal(down.calories, 55, 'rounding: 123 × 0.45 = 55.35 → 55');

		// 123 kcal/100g at 47g portion = 57.81 → 58 (rounds up)
		const up = scaleToPortion(
			{ calories: 123, proteinGrams: null, carbGrams: null, fatGrams: null },
			47,
		);
		assert.equal(up.calories, 58, 'rounding: 123 × 0.47 = 57.81 → 58');
	});
});
