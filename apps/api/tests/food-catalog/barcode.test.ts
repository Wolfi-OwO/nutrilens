import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import pg from 'pg';

import { apiRequest, authHeader, registerAndLogin } from '../helpers/api-client.ts';
import type { TestServer } from '../helpers/server-harness.ts';
import { startTestServer } from '../helpers/server-harness.ts';

// Test fixture ID to avoid collisions with real USDA/OFF data
const TEST_FIXTURE_ID = 999101;
const TEST_BARCODE = '5011234567890';

describe('food-catalog: barcode', () => {
    let server: TestServer;
    let pool: pg.Pool;

    before(async () => {
        server = await startTestServer();
        pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

        await pool.query(
            `INSERT INTO food_catalog (fdc_id, description, data_type, category, calories_kcal, protein_grams, carb_grams, fat_grams, ean_code)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (fdc_id) DO NOTHING`,
            [TEST_FIXTURE_ID, 'Baked Beans, canned', 'foundation_food', 'canned', 82, 5.2, 13.0, 0.6, TEST_BARCODE],
        );
    });

    after(async () => {
        try {
            await pool.query(`DELETE FROM food_catalog WHERE fdc_id = $1`, [TEST_FIXTURE_ID]);
        } finally {
            await pool.end();
        }
        await server.close();
    });

    test('requires authentication', async () => {
        const res = await apiRequest(server.baseUrl, `/food-catalog/barcode?code=${TEST_BARCODE}`);
        assert.equal(res.status, 401);
    });

    test('rejects malformed barcode', async () => {
        const user = await registerAndLogin(server.baseUrl, 'food-barcode-invalid');
        const res = await apiRequest(server.baseUrl, '/food-catalog/barcode?code=not-a-barcode', {
            headers: authHeader(user),
        });
        assert.equal(res.status, 400);
    });

    test('rejects barcode with wrong digit count', async () => {
        const user = await registerAndLogin(server.baseUrl, 'food-barcode-length');
        const res = await apiRequest(server.baseUrl, '/food-catalog/barcode?code=12345', {
            headers: authHeader(user),
        });
        assert.equal(res.status, 400);
    });

    test('accepts 12-digit UPC-A format', async () => {
        const user = await registerAndLogin(server.baseUrl, 'food-barcode-upc');
        const res = await apiRequest(server.baseUrl, '/food-catalog/barcode?code=123456789012', {
            headers: authHeader(user),
        });
        assert.equal(res.status, 200);
        assert.equal(res.body, null);
    });

    test('barcode hit returns the matching food', async () => {
        const user = await registerAndLogin(server.baseUrl, 'food-barcode-hit');
        const res = await apiRequest(server.baseUrl, `/food-catalog/barcode?code=${TEST_BARCODE}`, {
            headers: authHeader(user),
        });
        assert.equal(res.status, 200);

        const result = res.body as { fdcId: number; description: string; eanCode: string } | null;
        assert.ok(result);
        assert.equal(result.fdcId, TEST_FIXTURE_ID);
        assert.equal(result.description, 'Baked Beans, canned');
        assert.equal(result.eanCode, TEST_BARCODE);
    });

    test('barcode miss returns null', async () => {
        const user = await registerAndLogin(server.baseUrl, 'food-barcode-miss');
        const res = await apiRequest(server.baseUrl, '/food-catalog/barcode?code=9999999999999', {
            headers: authHeader(user),
        });
        assert.equal(res.status, 200);
        assert.equal(res.body, null);
    });
});
