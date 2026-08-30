import { Code2 } from 'lucide-react';
import { Link } from 'react-router';
import { useBuildInfo } from '@/hooks/use-build-info';
import { cn } from '@/lib/utils';

// Legal links must be reachable in one click from every page, including
// while the /version request that feeds the build-info pill is still in
// flight or has failed — so this list renders unconditionally, independent
// of buildInfo below.
const LEGAL_LINKS = [
    { to: '/about', label: 'Über uns' },
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
    // buildInfo is allowed to still be loading (or to have failed and
    // fallen back — see use-build-info.ts) without hiding this footer: the
    // legal nav below is a compliance requirement, not decoration, and must
    // not depend on the /version request succeeding.
    const { data: buildInfo } = useBuildInfo();

    const slug = buildInfo ? repoSlug(buildInfo.repositoryUrl) : '';
    const label = slug || 'local';
    const tooltip = buildInfo
        ? [
              buildInfo.revision && `revision ${buildInfo.revision}`,
              buildInfo.buildDate && `built ${buildInfo.buildDate}`,
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
                All Rights Reserved.
            </span>

            {pill &&
                (buildInfo?.repositoryUrl ? (
                    <a
                        href={buildInfo.repositoryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden transition-opacity hover:opacity-80 sm:flex"
                    >
                        {pill}
                    </a>
                ) : (
                    <span className="hidden sm:flex">{pill}</span>
                ))}

            <nav
                aria-label="Rechtliches"
                className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 whitespace-nowrap font-medium"
            >
                {LEGAL_LINKS.map((item) => (
                    <Link
                        key={item.to}
                        to={item.to}
                        className="transition-colors hover:text-foreground"
                    >
                        {item.label}
                    </Link>
                ))}
            </nav>
        </footer>
    );
}
