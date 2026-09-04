import React from 'react';
import { useNavigate } from 'react-router';
import { cn } from '@/lib/utils';
import { Button } from './button';

export interface EmptyStateAction {
    label: string;
    href?: string;
    onClick?: () => void;
}

export interface EmptyStateProps {
    icon: React.ComponentType<{ size: number; strokeWidth?: number; className?: string }>;
    title: string;
    description: string;
    action?: EmptyStateAction;
    variant?: 'default' | 'illustrated';
    // Every existing call site was written assuming an h3, several of them
    // directly under a page h1 with no h2 in between — a real skipped
    // heading level. Defaulting to 3 keeps those call sites unchanged; new
    // and audited call sites pass the level that is actually correct for
    // where they sit in the page outline.
    headingLevel?: 2 | 3 | 4 | 5 | 6;
    /**
     * Opt-in `data-testid` for the wrapper. An empty state is identifiable
     * only by its title and description — both display copy that #219
     * translates — so the call sites the e2e suite asserts on pass a stable
     * handle instead of the suite matching the wording.
     */
    testId?: string;
}

export function EmptyState({
    icon,
    title,
    description,
    action,
    variant = 'default',
    headingLevel = 3,
    testId,
}: EmptyStateProps) {
    const navigate = useNavigate();
    const HeadingTag = `h${headingLevel}` as const;

    // Shared by both variants: run the caller's onClick (if any), then
    // navigate client-side through React Router — a plain `window.location`
    // assignment would have forced a full page reload.
    const handleAction = () => {
        action?.onClick?.();
        if (action?.href) navigate(action.href);
    };

    if (variant === 'illustrated') {
        return (
            <div
                className={cn('center-empty-state')}
                data-testid={testId}
            >
                <div className="illustration-wrapper">
                    <LensIllustration />
                </div>
                <HeadingTag className="my-4 text-xl font-display font-semibold text-foreground">
                    {title}
                </HeadingTag>
                <p className="mb-6 text-base text-muted-foreground">{description}</p>

                {action && (action.href ?? action.onClick) && (
                    // Reuses Button rather than a second hand-rolled fill —
                    // this used to hardcode hover:bg-primary/90, the same
                    // alpha-hover pattern button.tsx documents as a measured
                    // contrast failure. Routing through Button means this
                    // can never drift out of sync with that fix again.
                    <Button onClick={handleAction}>
                        {action.href && (
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                        )}
                        {action.label}
                    </Button>
                )}
            </div>
        );
    }

    // default variant
    return (
        <div
            className={cn('center-empty-state')}
            data-testid={testId}
        >
            <div className="icon-wrapper">
                <div className="icon-circle bg-accent/10">
                    {React.createElement(icon, { size: 48, strokeWidth: 2, className: 'text-accent' })}
                </div>
            </div>
            <HeadingTag className="my-4 text-xl font-display font-semibold text-foreground">
                {title}
            </HeadingTag>
            <p className="mb-6 text-base text-muted-foreground">{description}</p>

            {action && <Button onClick={handleAction}>{action.label}</Button>}
        </div>
    );
}

// Lens illustration SVG component, colored from --accent (Werkbank's lime;
// previously the old mint palette's brand green — the token, not a literal
// hex, is what this reads, so it followed the palette switch automatically).
// Decorative only — title/description already carry the meaning — so it is
// hidden from assistive tech and given an explicit size (an SVG with neither
// a width/height attribute nor CSS sizing collapses to the browser's default
// replaced-element size, ~300x150, and looked broken here).
function LensIllustration() {
    return (
        <svg
            viewBox="0 0 120 120"
            width={120}
            height={120}
            aria-hidden="true"
        >
            <circle cx="60" cy="60" r="50" fill="var(--muted)" />

            <circle cx="60" cy="60" r="38" fill="none" stroke="var(--accent)" strokeWidth={8} />
            <circle cx="60" cy="60" r="26" fill="none" stroke="var(--accent)" strokeWidth={4} />
            <circle cx="60" cy="60" r="14" fill="none" stroke="var(--accent)" strokeWidth={4} />

            <polygon
                points="60,10 70,30 100,30 100,90 70,90 60,110"
                fill="none"
                stroke="var(--accent)"
                strokeWidth={2}
                opacity={0.6}
            />

            <circle cx="60" cy="60" r="4" fill="var(--accent)" />
        </svg>
    );
}

export default EmptyState;
