import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Footer } from '@/components/layout/footer';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';

// Shared chrome for every standalone legal/info page (Impressum,
// Datenschutzerklärung, AGB, About). These pages must render and be
// readable while logged out, so they deliberately do NOT use AppLayout
// (which returns null without a user) — this is its own minimal shell:
// skip link, a brand-only header (no nav that requires auth), a
// comfortable-measure reading column, and the same Footer everyone else
// gets so the legal links stay reachable in one click from here too.
interface LegalPageProps {
    title: string;
    lede?: string;
    /** ISO date shown as "Stand: …" — legal text needs a visible revision date. */
    updated: string;
    children: ReactNode;
}

export function LegalPage({ title, lede, updated, children }: LegalPageProps) {
    const updatedLabel = new Date(updated).toLocaleDateString('de-AT', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    return (
        <div className="flex min-h-dvh flex-col bg-background">
            <a
                href="#legal-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
            >
                Zum Inhalt springen
            </a>

            <header className="border-b border-border bg-card/80 backdrop-blur-sm">
                <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6 sm:px-8">
                    <Link to="/" className="flex shrink-0 items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                            N
                        </span>
                        <span className="font-display text-lg font-bold tracking-tight text-foreground">
                            NutriLens
                        </span>
                    </Link>
                    <ThemeToggle />
                </div>
            </header>

            <main id="legal-content" className="flex-1">
                <div className="mx-auto w-full max-w-3xl px-6 py-12 sm:px-8 lg:py-16">
                    <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                        {title}
                    </h1>
                    <p className="mt-3 text-sm text-muted-foreground">Stand: {updatedLabel}</p>
                    {lede && (
                        <p className="mt-6 max-w-prose text-base leading-relaxed text-muted-foreground">
                            {lede}
                        </p>
                    )}

                    <div className="mt-10 flex flex-col gap-10">{children}</div>
                </div>
            </main>

            <Footer />
        </div>
    );
}

interface LegalSectionProps {
    id: string;
    heading: string;
    children: ReactNode;
}

// One <section>/<h2> pair per legal clause — keeps heading order flat (h1 →
// h2, no skipped levels) and gives every clause an anchorable id.
export function LegalSection({ id, heading, children }: LegalSectionProps) {
    return (
        <section aria-labelledby={id} className="scroll-mt-24">
            <h2
                id={id}
                className="font-display text-xl font-semibold tracking-tight text-foreground"
            >
                {heading}
            </h2>
            <div className="mt-3 flex max-w-prose flex-col gap-3 text-[15px] leading-relaxed text-foreground/90">
                {children}
            </div>
        </section>
    );
}

export function LegalList({ children }: { children: ReactNode }) {
    return <ul className="ml-5 flex list-disc flex-col gap-1.5">{children}</ul>;
}

// Marks a value that could not be sourced (real address, legal form, …).
// Deliberately loud — a plausible-looking fake address is worse than an
// obvious gap, so this must not read like normal body text.
export function Placeholder({ children }: { children: ReactNode }) {
    return (
        <span
            className={cn(
                'inline-flex items-center rounded border border-dashed border-destructive bg-destructive/10 px-1.5 py-0.5',
                'font-mono text-[13px] font-medium text-destructive',
            )}
        >
            {children}
        </span>
    );
}
