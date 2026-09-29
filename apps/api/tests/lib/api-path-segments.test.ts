import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isRateLimitedPath } from '../../src/lib/api-path-segments.ts';

// Regression for the rate-limit bypass: /discounters, /discounters/*, and
// /stores/near skipped the app-wide limiter because their first path
// segments weren't in the set isRateLimitedPath is built from. /api is the
// new GET /api discovery root, which needs the same treatment.
test('isRateLimitedPath counts the previously-exempt store-discovery and api routes', () => {
    assert.equal(isRateLimitedPath('/stores/near'), true);
    assert.equal(isRateLimitedPath('/Discounters'), true);
    assert.equal(isRateLimitedPath('/api'), true);
});

test('isRateLimitedPath still exempts static assets and non-API paths', () => {
    assert.equal(isRateLimitedPath('/assets/x.js'), false);
    assert.equal(isRateLimitedPath('/log-meal'), false);
    assert.equal(isRateLimitedPath('/'), false);
});
