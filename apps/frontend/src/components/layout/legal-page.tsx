import type { ReactNode } from 'react';
import { FormattedDate, FormattedMessage } from 'react-intl';
import { Link } from 'react-router';
import { Footer } from '@/components/layout/footer';
import { ThemeToggle } from '@/components/theme-toggle';
import { LocaleToggle } from '@/components/locale-toggle';
import { useLocale } from '@/i18n/locale-context';
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
    /**
     * BCP-47 language of `title`, `lede` and `children`.
     *
     * Impressum, Datenschutzerklärung, AGB and Datenquellen stay German in BOTH
     * UI locales — PRIVACY.md:3 records that the in-app German page "is the one
     * users actually saw and is the one that governs", and a machine-translated
     * clause that a locale switch could substitute for it would be materially
     * worse than no translation at all. So their body carries lang="de"
     * regardless of the active locale: without it a screen reader running in
     * English voices German legal text with English phonemes.
     *
     * Passing it also renders the "German governs" note below the lede. About
     * (`/about`) is product copy, not a legal instrument, so it omits this and
     * is fully bilingual.
     */
    contentLang?: 'de';
    children: ReactNode;
}

export function LegalPage({ title, lede, updated, contentLang, children }: LegalPageProps) {
    const { locale } = useLocale();
    return (
        <div className="flex min-h-dvh flex-col bg-background">
            <a
                href="#legal-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
            >
                <FormattedMessage id="common.skipToContent" />
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
                    <div className="flex items-center gap-1">
                        <LocaleToggle />
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            <main id="legal-content" className="flex-1">
                <div className="mx-auto w-full max-w-3xl px-6 py-12 sm:px-8 lg:py-16" lang={contentLang}>
                    <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                        {title}
                    </h1>
                    {/* The revision date and the note below are chrome, not
                        clause text, so they follow the UI locale and are marked
                        as such — nested lang wins over the German wrapper. */}
                    <p className="mt-3 text-sm text-muted-foreground" lang={locale}>
                        <FormattedMessage
                            id="legal.updated"
                            values={{
                                date: (
                                    <FormattedDate
                                        value={updated}
                                        year="numeric"
                                        month="long"
                                        day="numeric"
                                    />
                                ),
                            }}
                        />
                    </p>
                    {lede && (
                        <p className="mt-6 max-w-prose text-base leading-relaxed text-muted-foreground">
                            {lede}
                        </p>
                    )}
                    {contentLang && <GermanGovernsNote lang={locale} />}

                    <div className="mt-10 flex flex-col gap-10">{children}</div>
                </div>
            </main>

            <Footer />
        </div>
    );
}

// Says out loud what the lang attribute above only encodes: this page is not
// translated, and the German wording is the one that binds. Rendered in the
// ACTIVE locale — an English reader has to be able to read the reason the rest
// of the page is not English.
function GermanGovernsNote({ lang }: { lang: string }) {
    return (
        <p
            lang={lang}
            className="mt-6 max-w-prose rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm leading-relaxed text-muted-foreground"
        >
            <FormattedMessage id="legal.germanGoverns" />
        </p>
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
                'font-mono text-[13px] font-medium text-destructive-strong',
            )}
        >
            {children}
        </span>
    );
}
