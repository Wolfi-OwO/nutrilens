import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import '../helpers/high-login-limit.ts';

import { apiRequest } from '../helpers/api-client.ts';
import { uniqueEmail } from '../helpers/random.ts';
import type { TestServer } from '../helpers/server-harness.ts';
import { startTestServer } from '../helpers/server-harness.ts';

/** What the browser sends: a derived proof, never the typed password. */
const proof = (tag: string): string => 'pw1$' + tag.padEnd(43, 'x');
const TYPED = 'correct horse battery staple';

const post = (
    server: TestServer,
    path: string,
    body: unknown,
    token?: string,
): Promise<{ status: number; body: unknown }> =>
    apiRequest(server.baseUrl, path, {
        method: 'POST',
        body: JSON.stringify(body),
        ...(token ? { headers: { Authorization: 'Bearer ' + token } } : {}),
    });

describe('auth: password proof', () => {
    let server: TestServer;
    before(async () => {
        server = await startTestServer();
    });
    after(async () => {
        await server.close();
    });

    test('an account created with a proof signs in with the proof, and a wrong proof is refused', async () => {
        const email = uniqueEmail('proof');
        const made = await post(server, '/users', {
            email,
            password: proof('a'),
            displayName: 'Proof',
        });
        assert.equal(made.status, 201);
        assert.equal(
            (await post(server, '/auth/login', { email, password: proof('a') })).status,
            200,
        );
        const wrong = await post(server, '/auth/login', { email, password: proof('b') });
        assert.equal(wrong.status, 401);
        assert.equal(typeof (wrong.body as { legacyLogin: boolean }).legacyLogin, 'boolean');
    });

    test('a legacy account moves to the proof scheme on its first proof sign-in, with one retry carrying the typed password', async () => {
        const email = uniqueEmail('legacy');
        await post(server, '/users', { email, password: TYPED, displayName: 'Legacy' }); // stored the old way
        const refused = await post(server, '/auth/login', { email, password: proof('a') });
        assert.equal(refused.status, 401);
        assert.equal((refused.body as { legacyLogin: boolean }).legacyLogin, true);

        const retried = await post(server, '/auth/login', {
            email,
            password: proof('a'),
            legacyPassword: TYPED,
        });
        assert.equal(retried.status, 200);
        assert.equal(
            (await post(server, '/auth/login', { email, password: proof('a') })).status,
            200,
        );
    });

    test('the retry is refused when the typed password is wrong', async () => {
        const email = uniqueEmail('legacy-wrong');
        await post(server, '/users', { email, password: TYPED, displayName: 'Legacy' });
        const reply = await post(server, '/auth/login', {
            email,
            password: proof('a'),
            legacyPassword: 'not the password at all',
        });
        assert.equal(reply.status, 401);
    });

    test('a page that has not reloaded yet can still sign a legacy account in with the typed password alone', async () => {
        const email = uniqueEmail('stale-page');
        await post(server, '/users', { email, password: TYPED, displayName: 'Legacy' });
        assert.equal((await post(server, '/auth/login', { email, password: TYPED })).status, 200);
    });
});

describe('auth: passkeys', () => {
    let server: TestServer;
    before(async () => {
        server = await startTestServer();
    });
    after(async () => {
        await server.close();
    });

    test('hands out sign-in options without an email, and refuses to register a passkey when signed out', async () => {
        const options = await post(server, '/auth/passkey/options', {});
        assert.equal(options.status, 200);
        const body = options.body as { ceremonyId: string; options: { challenge: string } };
        assert.match(body.options.challenge, /\S{20,}/);
        assert.match(body.ceremonyId, /^[0-9a-f-]{36}$/);
        assert.equal((await post(server, '/users/me/passkeys/register/options', {})).status, 401);
    });

    test('offers a signed-in user registration options and lists no passkeys yet', async () => {
        const email = uniqueEmail('passkey-user');
        await post(server, '/users', { email, password: proof('a'), displayName: 'Key' });
        const login = await post(server, '/auth/login', { email, password: proof('a') });
        const token = (login.body as { token: string }).token;
        const options = await post(server, '/users/me/passkeys/register/options', {}, token);
        assert.equal(options.status, 200);
        const rp = (options.body as { options: { rp: { name: string } } }).options.rp;
        assert.equal(rp.name, 'NutriLens');
        const list = await apiRequest(server.baseUrl, '/users/me/passkeys', {
            headers: { Authorization: 'Bearer ' + token },
        });
        assert.deepEqual((list.body as { passkeys: unknown[] }).passkeys, []);
    });

    test('rejects a made-up answer, and the ceremony cannot be tried twice', async () => {
        const options = await post(server, '/auth/passkey/options', {});
        const ceremonyId = (options.body as { ceremonyId: string }).ceremonyId;
        const response = { id: 'AAAA', rawId: 'AAAA', type: 'public-key', response: {} };
        assert.equal(
            (await post(server, '/auth/passkey/login', { ceremonyId, response })).status,
            401,
        );
        assert.equal(
            (await post(server, '/auth/passkey/login', { ceremonyId, response })).status,
            401,
        );
    });
});
