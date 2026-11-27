import { ApiError } from '@/lib/api-client';

/**
 * The page never sends the password. It sends a proof derived from it, so the typed password is not in the request,
 * not in a proxy's log and not in anything that handles the request between the browser and the server. The server
 * hashes the proof again before storing it (Argon2id), so what it holds is a hash of a hash.
 *
 * The salt carries the app name and the email, so the same password gives a different proof in every app and for
 * every account. The email cannot be changed after sign-up, so the proof of an account never moves.
 *
 * What this does not do: the proof is a password for this site, so anyone who learns it can sign in. It protects the
 * password a person may have reused elsewhere, not this account from a stolen proof.
 */
const ITERATIONS = 310_000;
const PREFIX = 'pw1$';

function base64url(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

/**
 * @param email - The account's address; trimmed and lower-cased the way the server matches it.
 * @param password - What the person typed.
 * @returns `pw1$` followed by 43 characters.
 */
export async function derivePasswordProof(email: string, password: string): Promise<string> {
    const text = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        text.encode(password.normalize('NFKC')),
        'PBKDF2',
        false,
        ['deriveBits'],
    );
    const bits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            hash: 'SHA-256',
            iterations: ITERATIONS,
            salt: text.encode(`nutrilens:password:v1:${email.trim().toLowerCase()}`),
        },
        key,
        256,
    );
    return PREFIX + base64url(new Uint8Array(bits));
}

/**
 * Runs a request that checks the password, first with the proof only. An account whose password is still stored as
 * typed cannot be checked that way; the server says so on every refusal while such accounts exist, and the request is
 * repeated once with the typed password so it can be re-stored as a proof. After that the retry never happens for
 * the account.
 *
 * @param email - The account's address.
 * @param password - What the person typed.
 * @param send - Sends the request with the given fields.
 */
export async function withPasswordProof<T>(
    email: string,
    password: string,
    send: (fields: { password: string; legacyPassword?: string }) => Promise<T>,
): Promise<T> {
    const proof = await derivePasswordProof(email, password);
    try {
        return await send({ password: proof });
    } catch (error) {
        const legacyLogin =
            error instanceof ApiError && error.status === 401 && error.body?.legacyLogin === true;
        if (!legacyLogin) throw error;
        return send({ password: proof, legacyPassword: password });
    }
}
