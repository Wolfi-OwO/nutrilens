import { uniqueEmail } from './random.ts';

export interface RegisteredUser {
    id: string;
    email: string;
    password: string;
    token: string;
}

/**
 * @param baseUrl - The running test server's base URL.
 * @param path - The request path, e.g. `/diet-plans`.
 * @param init - Standard fetch options.
 * @returns The parsed JSON body (or `undefined` for a 204) alongside the response.
 */
export async function apiRequest(
    baseUrl: string,
    path: string,
    init: RequestInit = {},
): Promise<{ status: number; body: unknown }> {
    const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...init.headers },
    });
    const status = response.status;
    const body = status === 204 ? undefined : await response.json();
    return { status, body };
}

/**
 * Registers a new user with a unique email and logs in, in one step —
 * the shape almost every other test needs before it can exercise an
 * authenticated route.
 *
 * @param baseUrl - The running test server's base URL.
 * @param prefix - A label folded into the generated email, for readability.
 * @returns The new user's id, credentials, and a ready-to-use bearer token.
 */
export async function registerAndLogin(baseUrl: string, prefix: string): Promise<RegisteredUser> {
    const email = uniqueEmail(prefix);
    const password = 'correct horse battery staple';

    const register = await apiRequest(baseUrl, '/users', {
        method: 'POST',
        body: JSON.stringify({ email, password, displayName: prefix }),
    });
    if (register.status !== 201) {
        throw new Error(`registerAndLogin: register failed with ${String(register.status)}: ${JSON.stringify(register.body)}`);
    }

    const login = await apiRequest(baseUrl, '/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
    if (login.status !== 200) {
        throw new Error(`registerAndLogin: login failed with ${String(login.status)}: ${JSON.stringify(login.body)}`);
    }

    const loginBody = login.body as { token: string; user: { id: string } };
    return { id: loginBody.user.id, email, password, token: loginBody.token };
}

/**
 * @param user - A user returned by {@link registerAndLogin}.
 * @returns An `Authorization` header for that user's bearer token.
 */
export function authHeader(user: RegisteredUser): Record<string, string> {
    return { Authorization: `Bearer ${user.token}` };
}
