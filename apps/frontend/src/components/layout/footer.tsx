import { Code2 } from 'lucide-react';
import { useBuildInfo } from '@/hooks/use-build-info';
import { cn } from '@/lib/utils';

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
    const { data: buildInfo } = useBuildInfo();
    if (!buildInfo) return null;

    const slug = repoSlug(buildInfo.repositoryUrl);
    const label = slug || 'local';
    const tooltip = [
        buildInfo.revision && `revision ${buildInfo.revision}`,
        buildInfo.buildDate && `built ${buildInfo.buildDate}`,
    ]
        .filter(Boolean)
        .join(' · ');

    const pill = (
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

            {buildInfo.repositoryUrl ? (
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
            )}

            {buildInfo.repositoryUrl && (
                <nav className="flex items-center gap-4 whitespace-nowrap font-medium">
                    <a
                        href={buildInfo.repositoryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-colors hover:text-foreground"
                    >
                        About
                    </a>
                </nav>
            )}
        </footer>
    );
}
