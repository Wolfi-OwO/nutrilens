import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AlertCircle } from 'lucide-react';
import { setToken } from '@/lib/api-client';

// oauth.handlers.ts redirects here with the session token in the URL
// *fragment* (`#token=...`), never a query string — a fragment never
// reaches the server, so it can't leak into access logs or a Referer
// header. A full reload to `/` (not client-side navigation) is deliberate:
// AuthProvider already fetches /users/me from a stored token on mount, so
// reusing that path means this page needs no auth-context wiring of its own.
//
// The backend only ever lands a browser here on SUCCESS — a failed exchange
// redirects straight to `/login?error=...` instead (see oauth.handlers.ts),
// which login.tsx already renders as a field-adjacent error. So the one
// failure this page can genuinely reach on its own is a missing/garbled
// token in the fragment (a stale bookmark, a link opened without its hash,
// a proxy that stripped it) — that case used to redirect home silently,
// landing a signed-out visitor on '/' with zero explanation. It now gets an
// explicit, designed failure state instead.
export default function OAuthCallbackPage() {
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
        if (!token) {
            setFailed(true);
            return;
        }
        setToken(token);
        window.location.replace('/');
    }, []);

    if (failed) {
        return (
            <div className="page-enter flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
                <div className="icon-circle bg-destructive/10">
                    <AlertCircle size={28} strokeWidth={2} className="text-destructive" />
                </div>
                <div className="max-w-xs">
                    <h1 className="font-display text-xl font-semibold text-foreground">
                        Sign-in didn&apos;t go through
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        We didn&apos;t get a valid session back from the provider. Nothing was
                        signed in — try again from the login page.
                    </p>
                </div>
                <Link
                    to="/login"
                    className="mt-2 inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                    Back to login
                </Link>
            </div>
        );
    }

    return (
        <div className="page-enter flex min-h-dvh flex-col items-center justify-center gap-4 bg-background">
            <div className="lens-glow-strong flex h-14 w-14 items-center justify-center rounded-full">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-accent" />
            </div>
            <p className="text-sm text-muted-foreground">Signing you in…</p>
        </div>
    );
}
