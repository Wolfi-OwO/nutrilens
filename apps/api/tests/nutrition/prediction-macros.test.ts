import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import type { Food101NutritionEntry, NutritionMacros } from '../../src/handlers/meal-log.handlers.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const foodNutritionData = JSON.parse(readFileSync(join(__dirname, '../../src/data/food101-nutrition.json'), 'utf8')) as Food101NutritionEntry[];

describe('prediction macro attachment', () => {
	// Build the same lookup as the handler
	function buildNutritionLookup(): Map<string, NutritionMacros> {
		const lookup = new Map<string, NutritionMacros>();
		for (const entry of foodNutritionData) {
			lookup.set(entry.label, {
				calories: entry.calories,
				proteinGrams: entry.proteinGrams,
				carbGrams: entry.carbGrams,
				fatGrams: entry.fatGrams,
			});
		}
		return lookup;
	}

	test('seeded prediction includes macros', () => {
		const lookup = buildNutritionLookup();
		const prediction = { label: 'beignets', confidence: 0.95 };

		const macros = lookup.get(prediction.label);
		assert.ok(macros, 'beignets should have macros in lookup');
		// Values from USDA food_catalog entry: Beignet (fdcId: 2708071)
		assert.equal(macros.calories, 417, 'beignets should be 417 kcal/100g');
		assert.equal(macros.proteinGrams, 5.46, 'beignets protein should be 5.46g/100g');
	});

	test('unknown label returns prediction without macros', () => {
		const lookup = buildNutritionLookup();
		const prediction = { label: 'imaginary_food_xyz', confidence: 0.99 };

		const macros = lookup.get(prediction.label);
		assert.equal(macros, undefined, 'unknown label should not be in lookup');

		// Simulate the handler's behavior: attach macros only if found
		const withMacros: { label: string; confidence: number; macros?: { calories: number | null; proteinGrams: number | null; carbGrams: number | null; fatGrams: number | null } } = {
			label: prediction.label,
			confidence: prediction.confidence,
		};
		if (macros) {
			withMacros.macros = macros;
		}

		assert.equal(withMacros.macros, undefined, 'unknown label should not have macros field');
		assert.equal(withMacros.label, 'imaginary_food_xyz', 'prediction should still be returned');
	});

	test('all Food-101 labels exist in lookup (even if unpopulated)', () => {
		const lookup = buildNutritionLookup();
		const allLabels = (foodNutritionData as Array<{ label: string }>).map((e) => e.label);

		assert.equal(allLabels.length, 101, 'must have 101 labels');

		for (const label of allLabels) {
			const macros = lookup.get(label);
			assert.ok(macros !== undefined, `all Food-101 labels must be in lookup, but ${label} is missing`);
			// Unpopulated entries will have all-null macros, which is fine
		}
	});

	test('null macros propagate to prediction response', () => {
		const lookup = buildNutritionLookup();
		// Find an entry with null calories to test null propagation
		// (Some Food-101 labels have no acceptable USDA match)
		const nullEntry = foodNutritionData.find((e) => e.calories === null);
		assert.ok(nullEntry, 'must have at least one Food-101 label with no USDA match');

		const prediction = { label: nullEntry.label, confidence: 0.87 };
		const macros = lookup.get(prediction.label);
		assert.ok(macros, `${prediction.label} should be in lookup`);

		// Even if unpopulated (all null), the entry exists to signal no data is available
		const withMacros: { label: string; confidence: number; macros?: NutritionMacros } = {
			label: prediction.label,
			confidence: prediction.confidence,
		};
		if (macros) {
			withMacros.macros = macros;
		}

		assert.ok(withMacros.macros, 'macros field should be present');
		assert.equal(withMacros.macros.calories, null, 'unpopulated calories should be null');
		assert.equal(withMacros.macros.proteinGrams, null, 'unpopulated proteinGrams should be null');
	});
});
