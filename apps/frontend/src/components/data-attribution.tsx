import { cn } from '@/lib/utils';

// Renders the credit the API sends alongside licensed rows.
//
// GET /discounters, /discounters/:code/stores and /stores/near carry an
// `attribution` field whenever the body contains OpenStreetMap rows, and omit
// it entirely when nothing is owed (see apps/api/src/handlers/
// store-discovery.handlers.ts). Anything rendering those rows renders this
// component with that field — undefined in, nothing out, so a list of purely
// purchased rows never claims an OSM provenance it does not have.
//
// WHY THE COMPONENT AND NOT A HARDCODED LINE IN EACH VIEW — the OSMF
// attribution guideline wants the credit where the data is displayed, not on a
// separate credits page. A view that forgets it puts the project in breach of
// ODbL §4.3, so the forgettable part is reduced to passing one field through.

/**
 * Known credit strings, mapped to the German wording OSM itself uses and to
 * the licence page the guideline requires the credit to link to.
 *
 * Keyed by the API's exact English string: the API deliberately does not
 * localise (it has no locale to localise to), so the translation happens here,
 * in the layer that knows the UI language. "© OpenStreetMap-Mitwirkende" is
 * OSM's own German form, not a paraphrase — the guideline permits the local
 * language, it does not permit shortening the credit to "OpenStreetMap".
 */
const KNOWN_CREDITS: Record<string, { label: string; lang: string; href: string }> = {
    '© OpenStreetMap contributors': {
        label: '© OpenStreetMap-Mitwirkende',
        // NOT routed through the i18n catalogue, deliberately (#219). This is a
        // licence term with a prescribed form, not UI copy: the guideline
        // permits OSM's own local-language wording and nothing else, so it must
        // not be reachable by a translator editing a message file. It stays the
        // German form in both UI locales for the same reason — but it then has
        // to declare its own language, or a screen reader running in English
        // voices "Mitwirkende" with English phonemes.
        lang: 'de',
        href: 'https://www.openstreetmap.org/copyright',
    },
};

interface DataAttributionProps {
    /** The API's `attribution` field, passed straight through — `undefined` when nothing is owed. */
    attribution: string | undefined;
    className?: string;
}

export function DataAttribution({ attribution, className }: DataAttributionProps) {
    if (!attribution) return null;

    const credit = KNOWN_CREDITS[attribution];

    return (
        // Every call site (shop-picker.tsx) renders this inside a bg-card
        // section, so the pair that matters is muted-foreground/card, not
        // muted-foreground/background: measured (npm run contrast) at 5.95:1
        // light / 7.11:1 dark — both comfortably above the 4.5:1 floor this
        // licence term has to clear.
        //
        // text-sm rather than text-xs: --font-xs is fluid down to 11px below
        // ~1280px (index.css), and this is the ODbL §4.3 credit, so it takes
        // the 13px floor instead of shrinking with the rest of the type
        // ramp — deliberately net ahead of the pre-overhaul flat 12px.
        <p className={cn('text-sm leading-relaxed text-muted-foreground', className)}>
            {credit ? (
                <a
                    href={credit.href}
                    lang={credit.lang}
                    target="_blank"
                    rel="noopener noreferrer"
                    // Underlined, on --foreground rather than --primary: 17.27:1
                    // instead of 4.36:1, which matters at this size, and the
                    // underline carries the link affordance without colour.
                    className="font-medium text-foreground underline underline-offset-2 transition-colors hover:text-primary"
                >
                    {credit.label}
                </a>
            ) : (
                // An unrecognised credit is still a credit. Rendering it
                // verbatim and unlinked is the only safe fallback: dropping it
                // would be the licence breach, and guessing a licence URL for
                // an unknown source would be a false statement about it.
                attribution
            )}
        </p>
    );
}
