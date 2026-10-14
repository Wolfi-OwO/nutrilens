// A live per-barcode lookup against Open Food Facts for products the local catalog does not
// carry. Nothing is stored: each hit is fetched when scanned, so the ODbL share-alike duty
// for a derived database is not triggered, and the attribution lives on the data-sources page.
const HOST = 'https://world.openfoodfacts.org';
const TIMEOUT_MS = 5000;
const BARCODE = /^\d{12,13}$/;

export interface BarcodeProduct {
    /** Always null here: this food has no USDA id. */
    fdcId: null;
    description: string;
    category: null;
    caloriesKcal: number | null;
    proteinGrams: number | null;
    carbGrams: number | null;
    fatGrams: number | null;
    eanCode: string;
    source: 'open_food_facts';
}

interface OffResponse {
    status?: number;
    product?: {
        product_name?: string;
        nutriments?: Record<string, unknown>;
    };
}

const num = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 10) / 10 : null;

/**
 * @param code - A validated 12 or 13 digit barcode (the route schema guarantees the shape,
 *   which also keeps it from ever shaping the request path).
 * @param fetchImpl - Injected so tests never touch the network.
 * @returns Per-100g nutrition, or null when the product is unknown, unnamed or the service
 *   is unreachable. A failure here must never break barcode lookup, so errors become null.
 */
export async function lookupOpenFoodFacts(
    code: string,
    fetchImpl: typeof fetch = fetch,
): Promise<BarcodeProduct | null> {
    // Checked again here, not only by the route schema: this function builds a URL from its
    // argument, so it must be safe no matter who calls it.
    if (!BARCODE.test(code)) return null;
    try {
        const url = `${HOST}/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,nutriments`;
        const response = await fetchImpl(url, {
            headers: { 'User-Agent': 'NutriLens/1.0 (https://github.com/Wolfi-OwO/nutrilens)' },
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!response.ok) return null;
        const body = (await response.json()) as OffResponse;
        const name = body.product?.product_name?.trim();
        if (body.status !== 1 || !name) return null;
        const n = body.product?.nutriments ?? {};
        return {
            fdcId: null,
            description: name,
            category: null,
            caloriesKcal: num(n['energy-kcal_100g']),
            proteinGrams: num(n['proteins_100g']),
            carbGrams: num(n['carbohydrates_100g']),
            fatGrams: num(n['fat_100g']),
            eanCode: code,
            source: 'open_food_facts',
        };
    } catch {
        return null;
    }
}
