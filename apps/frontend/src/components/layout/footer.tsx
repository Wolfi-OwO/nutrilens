import { Code2 } from 'lucide-react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link } from 'react-router';
import { useBuildInfo } from '@/hooks/use-build-info';
import { cn } from '@/lib/utils';

// Legal links must be reachable in one click from every page, including
// while the /version request that feeds the build-info pill is still in
// flight or has failed — so this list renders unconditionally, independent
// of buildInfo below.
//
// Only /about carries a message id. Impressum, Datenschutz, AGB and
// Datenquellen keep their German names in BOTH locales on purpose: those four
// pages stay German (see components/layout/legal-page.tsx), so an English label
// on a German page would promise a translation that is deliberately not there.
// "Impressum" is also the term Austrian law names the page by.
const LEGAL_LINKS = [
    { to: '/about', messageId: 'footer.about' },
    { to: '/impressum', label: 'Impressum' },
    { to: '/datenschutz', label: 'Datenschutz' },
    { to: '/agb', label: 'AGB' },
    // Appended, never inserted: the four links above are the established legal
    // order. This one is a licence obligation (ODbL §4.3 / OSMF attribution
    // guideline) and must stay reachable in one click from every page.
    { to: '/datenquellen', label: 'Datenquellen' },
] as const;

function repoSlug(url: string): string {
    if (!url) return '';
    try {
        return new URL(url).pathname.replace(/^\/+|\/+$/g, '').replace(/\.git$/, '');
    } catch {
        return '';
    }
}

interface FooterProps {
    className?: string;
}

// Same three-zone shape and compact single-row treatment as
// network-visualizer's and portfolio-webpage's footers (copyright | repo/
// version pill | links), same border-top/backdrop-blur bar — kept as one
// component so both call sites (pinned on desktop, in-flow on mobile —
// see app-layout.tsx) share the exact same markup and styling.
export function Footer({ className }: FooterProps) {
    const intl = useIntl();
    // buildInfo is allowed to still be loading (or to have failed and
    // fallen back — see use-build-info.ts) without hiding this footer: the
    // legal nav below is a compliance requirement, not decoration, and must
    // not depend on the /version request succeeding.
    const { data: buildInfo } = useBuildInfo();

    const slug = buildInfo ? repoSlug(buildInfo.repositoryUrl) : '';
    const label = slug || 'local';
    const tooltip = buildInfo
        ? [
              buildInfo.revision &&
                  intl.formatMessage({ id: 'footer.revision' }, { revision: buildInfo.revision }),
              buildInfo.buildDate &&
                  intl.formatMessage({ id: 'footer.built' }, { date: buildInfo.buildDate }),
          ]
              .filter(Boolean)
              .join(' · ')
        : '';

    const pill = buildInfo && (
        <span
            title={tooltip || undefined}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground"
        >
            <Code2 size={12} strokeWidth={2} className="text-primary" />
            <span className="font-medium text-foreground">{label}</span>
            <span>&middot; {buildInfo.version}</span>
        </span>
    );

    return (
        <footer
            className={cn(
                'flex h-auto shrink-0 flex-col items-center justify-center gap-2 border-t border-border bg-card/80 px-4 py-3 text-xs text-muted-foreground backdrop-blur-sm sm:h-12 sm:flex-row sm:justify-between sm:gap-4 sm:py-0 lg:px-8',
                className,
            )}
        >
            <span className="leading-tight">
                &copy; {new Date().getFullYear()} Woofi-Developments
                <br />
                <FormattedMessage id="footer.rights" />
            </span>

            {pill &&
                (buildInfo?.repositoryUrl ? (
                    <a
                        href={buildInfo.repositoryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        /* Was `transition-opacity hover:opacity-80`. The pill inside
                           is text, so that faded real glyphs: light muted-foreground
                           measured 5.95:1 settled but 3.81:1 at opacity .8 — under AA,
                           and a SETTLED hover state, not a transient frame. A colour
                           hover carries the same affordance without touching opacity. */
                        className="hidden transition-colors hover:text-foreground sm:flex"
                    >
                        {pill}
                    </a>
                ) : (
                    <span className="hidden sm:flex">{pill}</span>
                ))}

            <nav
                aria-label={intl.formatMessage({ id: 'footer.legalNav' })}
                // text-sm overrides the footer's own text-xs: --font-xs is fluid
                // down to 11px below ~1280px (index.css), and these four links
                // are the §5 ECG/TMG mandated nav (Impressum, Datenschutz, AGB,
                // Datenquellen) plus /about, so they take the 13px floor instead
                // of shrinking with the rest of the type ramp. The copyright
                // line and build-info pill above are not legally mandated text
                // and keep the footer's default text-xs.
                className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm whitespace-nowrap font-medium"
            >
                {LEGAL_LINKS.map((item) => (
                    <Link
                        key={item.to}
                        to={item.to}
                        className="transition-colors hover:text-foreground"
                    >
                        {'messageId' in item ? <FormattedMessage id={item.messageId} /> : item.label}
                    </Link>
                ))}
            </nav>
        </footer>
    );
}
