import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { getAnalyticsConsent, setAnalyticsConsent } from '@/lib/consent';

// Preventive: nutrilens loads no analytics or tracking script today. This
// exists so that whenever one is added, it has a consent decision to check
// instead of shipping unconditionally on day one.
export function ConsentBanner() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        setVisible(getAnalyticsConsent() === null);
    }, []);

    if (!visible) return null;

    const decide = (accepted: boolean) => {
        setAnalyticsConsent(accepted);
        setVisible(false);
    };

    // data-testid on the banner and its decline button: the e2e suite has to
    // dismiss this before it can click the footer underneath (it is
    // `fixed bottom-0 z-50` on every page until a decision is stored), and
    // both handles were display copy.
    return (
        <div
            role="dialog"
            aria-label="Cookie-Einstellungen"
            data-testid="consent-banner"
            className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 p-4 text-sm text-muted-foreground backdrop-blur-sm"
        >
            <div className="mx-auto flex max-w-3xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p>
                    Wir verwenden aktuell keine Analytics-Cookies. Sollte sich das ändern,
                    entscheidet Ihre Wahl hier, ob sie geladen werden.{' '}
                    <Link to="/datenschutz" className="underline hover:text-foreground">
                        Mehr erfahren
                    </Link>
                </p>
                <div className="flex shrink-0 gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => decide(false)}
                        data-testid="consent-decline"
                    >
                        Ablehnen
                    </Button>
                    <Button size="sm" onClick={() => decide(true)}>
                        Akzeptieren
                    </Button>
                </div>
            </div>
        </div>
    );
}
