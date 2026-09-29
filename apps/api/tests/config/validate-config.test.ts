import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';

import { config, validateConfig } from '../../src/config/index.ts';

// config is a plain mutable object (see config/index.ts) — tests restore
// their own mutations rather than relying on process isolation, in case
// this file ever runs alongside others in the same process.
describe('validateConfig — METRICS_TOKEN in production', () => {
    const originalNodeEnv = config.nodeEnv;
    const originalMetricsToken = config.metricsToken;

    after(() => {
        config.nodeEnv = originalNodeEnv;
        config.metricsToken = originalMetricsToken;
    });

    test('throws when NODE_ENV=production and METRICS_TOKEN is unset', () => {
        config.nodeEnv = 'production';
        config.metricsToken = undefined;
        assert.throws(() => {
            validateConfig();
        }, /METRICS_TOKEN is not set/);
    });

    test('does not throw for production with METRICS_TOKEN set', () => {
        config.nodeEnv = 'production';
        config.metricsToken = 'a-real-token';
        assert.doesNotThrow(() => {
            validateConfig();
        });
    });

    test('does not require METRICS_TOKEN outside production', () => {
        config.nodeEnv = 'development';
        config.metricsToken = undefined;
        assert.doesNotThrow(() => {
            validateConfig();
        });
    });
});
