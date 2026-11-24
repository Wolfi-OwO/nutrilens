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
// The first two follow the shared bar (Status, Impressum, Privacy, Contact); the rest are this app's own documents and
// credits, kept one click away from every page.
const PRIMARY_LINKS = [
    { to: '/impressum', label: 'Impressum' },
    { to: '/datenschutz', label: 'Datenschutz' },
] as const;
const OWN_LINKS = [
    { to: '/agb', label: 'AGB' },
    // A licence obligation (ODbL §4.3 / OSMF attribution guideline): reachable in one click from every page.
    { to: '/datenquellen', label: 'Datenquellen' },
    { to: '/about', messageId: 'footer.about' },
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

    const link =
        'inline-flex min-h-8 items-center gap-2 whitespace-nowrap rounded-lg transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-0';

    const chip = (
        <span className="inline-flex items-center gap-2 rounded-lg border border-transparent bg-muted/60 px-2.5 py-1 font-mono text-muted-foreground transition-colors duration-200 group-hover:border-primary">
            <Code2 size={14} strokeWidth={2} className="text-primary" />
            <span className="text-foreground">{label}</span>
            <span className="text-border">&middot;</span>
            <span>{buildInfo?.version}</span>
        </span>
    );

    return (
        <footer
            className={cn(
                'relative z-20 shrink-0 border-t border-border bg-card/80 px-4 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm sm:px-6 lg:px-8',
                className,
            )}
        >
            <div className="grid w-full grid-cols-2 items-center gap-x-4 text-[13px] lg:h-10 lg:grid-cols-[1fr_auto_1fr]">
                <p className="order-last col-span-2 flex flex-wrap items-center justify-center gap-x-2 justify-self-center pb-1.5 pt-0.5 text-center text-muted-foreground sm:col-span-1 sm:justify-self-start sm:text-left lg:order-none lg:py-0">
                    <span className="whitespace-nowrap">
                        <span className="font-mono">&copy; {new Date().getFullYear()}</span>{' '}
                        Woofi-Developments
                    </span>
                    <span className="hidden whitespace-nowrap sm:inline">
                        <FormattedMessage id="footer.rights" />
                    </span>
                </p>

                <div
                    title={tooltip || undefined}
                    className="order-last hidden justify-self-end py-3 sm:block lg:order-none lg:justify-self-center lg:py-0"
                >
                    {buildInfo &&
                        (buildInfo.repositoryUrl ? (
                            <a
                                href={buildInfo.repositoryUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group inline-flex rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {chip}
                            </a>
                        ) : (
                            chip
                        ))}
                </div>

                {/* The legal pages are the §5 ECG/TMG mandated nav; they sit at the same 13px as the rest of the bar. */}
                <ul
                    aria-label={intl.formatMessage({ id: 'footer.legalNav' })}
                    className="order-first col-span-2 flex flex-wrap items-center justify-center gap-x-5 justify-self-stretch font-medium text-muted-foreground lg:order-none lg:col-span-1 lg:gap-4 lg:justify-self-end"
                >
                    <li>
                        <a
                            href="https://status.woofi-developments.at"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={link}
                        >
                            <span
                                className="animate-live size-[6px] shrink-0 rounded-full bg-success"
                                aria-hidden="true"
                            />
                            <FormattedMessage id="footer.status" />
                        </a>
                    </li>
                    {PRIMARY_LINKS.map((item) => (
                        <li key={item.to}>
                            <Link to={item.to} className={link}>
                                {item.label}
                            </Link>
                        </li>
                    ))}
                    <li>
                        <a href="https://www.woofi-developments.at/contact" className={link}>
                            <FormattedMessage id="footer.contact" />
                        </a>
                    </li>
                    {OWN_LINKS.map((item) => (
                        <li key={item.to}>
                            <Link to={item.to} className={link}>
                                {'messageId' in item ? (
                                    <FormattedMessage id={item.messageId} />
                                ) : (
                                    item.label
                                )}
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
        </footer>
    );
}
