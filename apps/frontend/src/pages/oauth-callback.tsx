import { useEffect } from 'react';
import { setToken } from '@/lib/api-client';

// oauth.handlers.ts redirects here with the session token in the URL
// *fragment* (`#token=...`), never a query string — a fragment never
// reaches the server, so it can't leak into access logs or a Referer
// header. A full reload to `/` (not client-side navigation) is deliberate:
// AuthProvider already fetches /users/me from a stored token on mount, so
// reusing that path means this page needs no auth-context wiring of its own.
export default function OAuthCallbackPage() {
    useEffect(() => {
        const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
        if (token) setToken(token);
        window.location.replace('/');
    }, []);

    return (
        <div className="flex min-h-dvh items-center justify-center bg-background">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
    );
}
