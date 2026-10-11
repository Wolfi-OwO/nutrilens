/** What a drink counts as when judging the day (see {@link summarizeDrinks}). */
export type DrinkKind = 'water' | 'unsweetened' | 'sweetened' | 'alcohol';

export interface DrinkDefinition {
    id: string;
    kind: DrinkKind;
    /** All nutrition values are per 100 ml. */
    kcal: number;
    carbsG: number;
    sugarG: number;
    alcoholG: number;
    /**
     * Share of the volume that counts towards hydration. Rough planning values, not clinical
     * ones: alcohol dehydrates, so beer and wine count for much less than their volume.
     */
    hydration: number;
}

// Typical values per 100 ml from common food-composition tables; a product label beats them.
export const DRINKS: readonly DrinkDefinition[] = [
    { id: 'water', kind: 'water', kcal: 0, carbsG: 0, sugarG: 0, alcoholG: 0, hydration: 1 },
    { id: 'tea', kind: 'unsweetened', kcal: 1, carbsG: 0.2, sugarG: 0, alcoholG: 0, hydration: 0.95 },
    { id: 'coffee', kind: 'unsweetened', kcal: 2, carbsG: 0.3, sugarG: 0, alcoholG: 0, hydration: 0.85 },
    { id: 'milk', kind: 'unsweetened', kcal: 47, carbsG: 4.8, sugarG: 4.8, alcoholG: 0, hydration: 0.9 },
    { id: 'juice', kind: 'sweetened', kcal: 45, carbsG: 10, sugarG: 8.4, alcoholG: 0, hydration: 0.9 },
    { id: 'soft-drink', kind: 'sweetened', kcal: 42, carbsG: 10.6, sugarG: 10.6, alcoholG: 0, hydration: 0.9 },
    { id: 'beer', kind: 'alcohol', kcal: 43, carbsG: 3.6, sugarG: 0, alcoholG: 3.9, hydration: 0.4 },
    { id: 'wine', kind: 'alcohol', kcal: 83, carbsG: 2.6, sugarG: 0.6, alcoholG: 9.5, hydration: 0.2 },
];

/**
 * @param id - A drink id from the catalog.
 * @returns The definition, or undefined for an unknown id.
 */
export function findDrink(id: string): DrinkDefinition | undefined {
    return DRINKS.find((drink) => drink.id === id);
}

export interface DrinkNutrition {
    kcal: number;
    carbsG: number;
    sugarG: number;
    alcoholG: number;
    hydrationMl: number;
}

/**
 * @param drink - The catalog entry.
 * @param volumeMl - How much was drunk.
 * @returns The nutrition and hydration for exactly that volume.
 */
export function nutritionFor(drink: DrinkDefinition, volumeMl: number): DrinkNutrition {
    const factor = volumeMl / 100;
    return {
        kcal: drink.kcal * factor,
        carbsG: drink.carbsG * factor,
        sugarG: drink.sugarG * factor,
        alcoholG: drink.alcoholG * factor,
        hydrationMl: volumeMl * drink.hydration,
    };
}

export type DayQuality = 'none' | 'mostly-unsweetened' | 'mixed' | 'mostly-sweetened';

export interface DrinkSummary {
    volumeMl: number;
    hydrationMl: number;
    kcal: number;
    carbsG: number;
    sugarG: number;
    alcoholG: number;
    /** Share of the volume that was water or unsweetened (0 to 1); null when nothing was logged. */
    unsweetenedShare: number | null;
    /**
     * The rule, written down so it is not a hidden score: by volume, at least 75% water or
     * unsweetened drinks is "mostly-unsweetened", under 50% is "mostly-sweetened", otherwise
     * "mixed". Alcohol is reported as grams next to this, not folded into a verdict. A day
     * with nothing logged is "none", never a bad day.
     */
    quality: DayQuality;
}

export interface LoggedDrink extends DrinkNutrition {
    drinkType: string;
    volumeMl: number;
}

/**
 * @param logs - The day's logged drinks.
 * @returns Totals plus the explicit quality signal.
 */
export function summarizeDrinks(logs: readonly LoggedDrink[]): DrinkSummary {
    const sum = { volumeMl: 0, hydrationMl: 0, kcal: 0, carbsG: 0, sugarG: 0, alcoholG: 0 };
    let plain = 0;
    for (const log of logs) {
        sum.volumeMl += log.volumeMl;
        sum.hydrationMl += log.hydrationMl;
        sum.kcal += log.kcal;
        sum.carbsG += log.carbsG;
        sum.sugarG += log.sugarG;
        sum.alcoholG += log.alcoholG;
        const kind = findDrink(log.drinkType)?.kind;
        if (kind === 'water' || kind === 'unsweetened') plain += log.volumeMl;
    }
    const share = sum.volumeMl > 0 ? plain / sum.volumeMl : null;
    let quality: DayQuality = 'none';
    if (share !== null) {
        quality = share >= 0.75 ? 'mostly-unsweetened' : share < 0.5 ? 'mostly-sweetened' : 'mixed';
    }
    const round = (n: number): number => Math.round(n * 10) / 10;
    return {
        volumeMl: sum.volumeMl,
        hydrationMl: Math.round(sum.hydrationMl),
        kcal: round(sum.kcal),
        carbsG: round(sum.carbsG),
        sugarG: round(sum.sugarG),
        alcoholG: round(sum.alcoholG),
        unsweetenedShare: share === null ? null : Math.round(share * 100) / 100,
        quality,
    };
}
