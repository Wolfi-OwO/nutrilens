import { useEffect, useState } from 'react';
import { FormattedMessage } from 'react-intl';
import { Link } from 'react-router';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
                        <FormattedMessage id="oauth.callback.failedTitle" />
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        <FormattedMessage id="oauth.callback.failedBody" />
                    </p>
                </div>
                {/* Routed through Button rather than a hand-rolled link: the
                    hand-rolled version used hover:bg-primary/90, the same
                    alpha-hover pattern button.tsx documents as a measured
                    contrast failure. */}
                <Button asChild className="mt-2">
                    <Link to="/login">
                        <FormattedMessage id="oauth.callback.backToLogin" />
                    </Link>
                </Button>
            </div>
        );
    }

    return (
        // .lens-glow-strong dropped: app-layout.tsx now reserves that halo
        // for the one camera FAB (see its own comment there). A plain
        // border-key ring reads as "this is loading" without competing for
        // the same visual signature.
        <div className="page-enter flex min-h-dvh flex-col items-center justify-center gap-4 bg-background">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border-key">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-accent" />
            </div>
            <p className="text-sm text-muted-foreground">
                <FormattedMessage id="oauth.callback.signingIn" />
            </p>
        </div>
    );
}
