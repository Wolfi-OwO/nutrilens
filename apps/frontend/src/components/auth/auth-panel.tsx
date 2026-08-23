import { Link } from 'react-router';

// Shared brand panel for login/register — the two pages differ only in
// copy, so this stays one component rather than duplicating the same
// aside markup twice. Every colour is a design-system token (bg-secondary/
// border-border/text-foreground/text-muted-foreground), all already
// measured in index.css; text-accent is deliberately NOT used at this
// small a size here — accent-on-secondary measures 4.09:1 in light mode,
// which clears the 3:1 large-text minimum but fails 4.5:1 for body-size
// text, so accent is reserved for the icon marks below (icon/glyph
// contrast isn't a WCAG text criterion) and for the one large headline
// word, never for small labels.
export function AuthPanel({
    eyebrow,
    headline,
    tagline,
}: {
    eyebrow: string;
    headline: string;
    tagline: string;
}) {
    return (
        <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-secondary px-10 py-12 lg:flex">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-accent/10 blur-3xl"
            />

            <Link to="/" className="relative flex items-center gap-2.5 text-foreground">
                <span className="lens-glow flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                    N
                </span>
                <span className="font-display text-xl font-semibold tracking-tight">
                    nutrilens
                </span>
            </Link>

            <div className="relative flex flex-col items-start gap-8">
                <LensMark />
                <div className="max-w-sm">
                    <p className="text-xs font-semibold tracking-wide text-foreground uppercase">
                        {eyebrow}
                    </p>
                    <h2 className="mt-3 font-display text-4xl leading-tight font-bold text-foreground">
                        {headline}
                    </h2>
                </div>
            </div>

            <p className="relative max-w-xs border-t border-border pt-4 text-sm text-muted-foreground">
                {tagline}
            </p>
        </aside>
    );
}

// Camera-aperture rings, the same visual family as EmptyState's
// LensIllustration (see empty-state.tsx) so the "lens" motif reads as one
// idea across the whole app, not a one-off graphic for this screen. Purely
// decorative — the copy beside it already carries the meaning — so it is
// hidden from assistive tech. animate-pulse is Tailwind's built-in utility
// (no new keyframes needed) and the app's global prefers-reduced-motion
// guard in index.css already collapses its duration to 0.01ms.
function LensMark() {
    return (
        <div className="lens-glow-strong relative flex h-20 w-20 items-center justify-center rounded-full">
            <div className="absolute inset-0 animate-pulse rounded-full bg-accent/10" />
            <svg viewBox="0 0 80 80" width={80} height={80} aria-hidden="true" className="relative">
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--accent)" strokeWidth={2} opacity={0.35} />
                <circle cx="40" cy="40" r="24" fill="none" stroke="var(--accent)" strokeWidth={3} />
                <circle cx="40" cy="40" r="13" fill="none" stroke="var(--accent)" strokeWidth={3} />
                <circle cx="40" cy="40" r="4" fill="var(--accent)" />
            </svg>
        </div>
    );
}
