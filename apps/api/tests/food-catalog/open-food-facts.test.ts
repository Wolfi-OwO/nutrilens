import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { lookupOpenFoodFacts } from '../../src/lib/open-food-facts.ts';

const respond = (status: number, body: unknown): typeof fetch =>
    (() => Promise.resolve(new Response(JSON.stringify(body), { status })));

describe('Open Food Facts barcode lookup', () => {
    test('maps a product to per-100g nutrition', async () => {
        const product = await lookupOpenFoodFacts(
            '4008400402222',
            respond(200, {
                status: 1,
                product: {
                    product_name: 'Nuss-Nougat-Creme',
                    nutriments: {
                        'energy-kcal_100g': 539,
                        proteins_100g: 6.3,
                        carbohydrates_100g: 57.5,
                        fat_100g: 30.9,
                    },
                },
            }),
        );
        assert.equal(product?.description, 'Nuss-Nougat-Creme');
        assert.equal(product?.caloriesKcal, 539);
        assert.equal(product?.carbGrams, 57.5);
        assert.equal(product?.eanCode, '4008400402222');
        assert.equal(product?.fdcId, null);
    });

    test('an unknown or unnamed product is null', async () => {
        assert.equal(await lookupOpenFoodFacts('4008400402222', respond(200, { status: 0 })), null);
        assert.equal(await lookupOpenFoodFacts('4008400402222', respond(200, { status: 1, product: {} })), null);
    });

    test('missing nutriments stay null instead of becoming zero', async () => {
        const product = await lookupOpenFoodFacts(
            '4008400402222',
            respond(200, { status: 1, product: { product_name: 'Mystery', nutriments: {} } }),
        );
        assert.equal(product?.caloriesKcal, null);
    });

    test('a failing service never breaks the lookup', async () => {
        assert.equal(await lookupOpenFoodFacts('4008400402222', respond(503, {})), null);
        const throwing = (() => Promise.reject(new Error('offline'))) as typeof fetch;
        assert.equal(await lookupOpenFoodFacts('4008400402222', throwing), null);
    });

    test('only the validated digits go into the request path', async () => {
        let requested = '';
        const spy = ((url: string) => {
            requested = url;
            return Promise.resolve(new Response('{}', { status: 404 }));
        }) as unknown as typeof fetch;
        await lookupOpenFoodFacts('4008400402222', spy);
        assert.match(requested, /^https:\/\/world\.openfoodfacts\.org\/api\/v2\/product\/4008400402222\.json/);
    });

    test('anything that is not 12 or 13 digits is refused without a request', async () => {
        let called = false;
        const spy = (() => {
            called = true;
            return Promise.resolve(new Response('{}'));
        }) as unknown as typeof fetch;
        assert.equal(await lookupOpenFoodFacts('../../etc/passwd', spy), null);
        assert.equal(await lookupOpenFoodFacts('123', spy), null);
        assert.equal(called, false);
    });
});
