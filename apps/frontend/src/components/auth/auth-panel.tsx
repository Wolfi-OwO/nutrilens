import { Link } from 'react-router';

// Re-decided against Werkbank, not carried over by inertia: the asymmetric
// 2fr/3fr SPLIT itself survives — "unequal bento spans" is Werkbank's own
// vocabulary for a layout, so a lopsided two-column grid is already on
// direction — but everything INSIDE this panel was the previous editorial
// direction's device (a blurred colour orb, a pulsing "lens" of concentric
// circles) and reads soft/organic where Werkbank reads engineered/dense. It
// is re-skinned below: no blur, no glow, no pulse. See login.tsx/register.tsx
// for the full grid-split reasoning.
//
// Every colour is a design-system token (bg-secondary/border-border/
// text-foreground/text-muted-foreground), all already measured in
// index.css; text-accent is deliberately NOT used at this small a size here
// — accent-on-secondary measures 4.09:1 in light mode, which clears the 3:1
// large-text minimum but fails 4.5:1 for body-size text, so accent is
// reserved for the icon marks below (icon/glyph contrast isn't a WCAG text
// criterion) and for the one large headline word, never for small labels.
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
            {/* Faint graph-paper grid, not a blurred orb — the previous
                treatment's soft glow is gone; this reads as instrument
                backing, not ambience. A `repeating-linear-gradient` here
                would need an index.css utility (out of scope for this task),
                so it is drawn as one large, mostly-transparent SVG instead. */}
            <svg
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.05]"
                preserveAspectRatio="none"
            >
                <defs>
                    <pattern id="auth-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                        <path
                            d="M0 0H32M0 0V32"
                            fill="none"
                            stroke="var(--foreground)"
                            strokeWidth={1}
                        />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#auth-grid)" />
            </svg>

            <Link to="/" className="relative flex items-center gap-2.5 text-foreground">
                <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border-key bg-accent text-sm font-semibold text-accent-foreground">
                    N
                </span>
                <span className="font-display text-xl font-semibold tracking-tight">
                    nutrilens
                </span>
            </Link>

            <div className="relative flex flex-col items-start gap-8">
                <ReticleMark />
                <div className="max-w-sm">
                    <p className="text-xs font-semibold tracking-wide text-foreground uppercase">
                        {eyebrow}
                    </p>
                    {/* leading-[1.05], not leading-tight: text-4xl resolves to 54px at
                        1440px and Tailwind's leading-tight is 1.25, which put 67.5px
                        between the baselines of a two-line display headline — measured
                        on the rendered page, and it read as two unrelated lines rather
                        than one headline. Display type wants its leading near 1. */}
                    <h2 className="mt-3 font-display text-4xl leading-[1.05] font-bold text-foreground">
                        {headline}
                    </h2>
                </div>
            </div>

            {/* text-base: genuine prose (a full sentence), same call as the
            page-level subtitles in login.tsx/register.tsx. */}
            <p className="relative max-w-xs border-t border-border pt-4 text-base text-muted-foreground">
                {tagline}
            </p>
        </aside>
    );
}

// Viewfinder corner brackets, replacing the old pulsing concentric-circle
// "lens" — a still, engineered mark rather than an ambient glow. app-layout.tsx
// now reserves `.lens-glow`/`.lens-glow-strong` for the one camera FAB (see
// its own comment there), so this deliberately does not reach for either
// class; a border-key stroke does the "this is a precise instrument" work
// instead. Purely decorative — the copy beside it already carries the
// meaning — so it is hidden from assistive tech. No animation at all, so
// there is nothing for the reduced-motion guard to need to collapse.
function ReticleMark() {
    return (
        <svg viewBox="0 0 80 80" width={64} height={64} aria-hidden="true" className="relative">
            <path
                d="M4 22V4h18M58 4h18v18M76 58v18H58M22 76H4V58"
                fill="none"
                stroke="var(--border-key)"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle cx="40" cy="40" r="3.5" fill="var(--accent)" />
        </svg>
    );
}
