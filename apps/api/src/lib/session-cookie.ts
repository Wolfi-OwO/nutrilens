import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { isProduction } from '../config/index.ts';

/** Name of the HttpOnly cookie that carries the session token for browsers. */
export const SESSION_COOKIE = 'nutrilens_session';

/**
 * A browser must send this header on every state-changing request that is
 * authenticated by the cookie. A cross-site form or `<img>` cannot add a custom
 * header, and a cross-origin `fetch` that does is stopped by the CORS
 * allow-list's preflight, so the header stands in for a CSRF token.
 */
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_HEADER_VALUE = 'fetch';

/**
 * Reads one cookie from the raw `Cookie` header.
 *
 * Parsed by hand: this is the only cookie the API reads, which does not justify
 * a dependency (and a second parser) on the authentication path.
 *
 * @param req - The incoming request.
 * @param name - The cookie to read.
 * @returns The cookie value, or undefined if absent.
 */
export function readCookie(req: Request, name: string): string | undefined {
    const header = req.header('cookie');
    if (!header) return undefined;
    for (const part of header.split(';')) {
        const index = part.indexOf('=');
        if (index === -1) continue;
        if (part.slice(0, index).trim() === name) {
            try {
                return decodeURIComponent(part.slice(index + 1).trim());
            } catch {
                return undefined;
            }
        }
    }
    return undefined;
}

/**
 * Sends the session token as an HttpOnly cookie, expiring with the token itself.
 *
 * `SameSite=Lax` keeps the cookie off cross-site POSTs; `Secure` is on in
 * production, where Caddy terminates TLS (off locally, where plain http would
 * make the browser drop it).
 *
 * @param res - The response to set the cookie on.
 * @param token - The signed session JWT.
 */
export function setSessionCookie(res: Response, token: string): void {
    const decoded = jwt.decode(token);
    const exp = typeof decoded === 'object' && decoded !== null ? decoded.exp : undefined;
    const maxAge = typeof exp === 'number' ? Math.max(0, exp * 1000 - Date.now()) : undefined;
    res.cookie(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        ...(maxAge !== undefined ? { maxAge } : {}),
    });
}

/**
 * Removes the session cookie. Attributes must match the ones it was set with,
 * or the browser keeps the original.
 *
 * @param res - The response to clear the cookie on.
 */
export function clearSessionCookie(res: Response): void {
    res.clearCookie(SESSION_COOKIE, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
    });
}
