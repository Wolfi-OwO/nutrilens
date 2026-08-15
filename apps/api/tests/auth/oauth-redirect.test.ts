import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { Request } from 'express';

import { resolveFrontendBase } from '../../src/handlers/oauth.handlers.ts';

// Issue: the callback redirected to the configured OAUTH_FRONTEND_BASE_URL
// (the default Azure container-app FQDN in production), so a custom domain
// in front of the container app bounced the browser back to the internal
// URL. The origin must come from the request itself.

function mockRequest(host: string | undefined): Request {
    return {
        protocol: 'https',
        get: (name: string) => (name === 'host' ? host : undefined),
    } as unknown as Request;
}

describe('resolveFrontendBase', () => {
    test('uses the request origin when a Host header is present, ignoring the configured base', () => {
        const base = resolveFrontendBase(mockRequest('nutrilens.woofi-developments.at'), 'https://azure.invalid');
        assert.equal(base, 'https://nutrilens.woofi-developments.at');
    });

    test('falls back to the configured base when no Host header reached us', () => {
        const base = resolveFrontendBase(mockRequest(undefined), 'https://nutrilens.woofi-developments.at');
        assert.equal(base, 'https://nutrilens.woofi-developments.at');
    });

    test('strips a trailing slash from either source', () => {
        const byHost = resolveFrontendBase(mockRequest('example.com/'), 'https://fallback.invalid');
        assert.equal(byHost, 'https://example.com');

        const byConfig = resolveFrontendBase(mockRequest(undefined), 'https://fallback.invalid/');
        assert.equal(byConfig, 'https://fallback.invalid');
    });
});