import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Check, Sparkles, Target, TrendingUp, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Completion flag is per-user so switching accounts re-shows the guide.
function storageKey(userId: string): string {
    return `nutrilens_tutorial_completed_${userId}`;
}

type Step = {
    /** Message-id stem: `onboarding.<id>.title` / `.body`. */
    id: string;
    icon: LucideIcon;
    accent: string;
};

const STEPS: Step[] = [
    { id: 'welcome', icon: Sparkles, accent: 'bg-primary/10 text-primary' },
    { id: 'targets', icon: Target, accent: 'bg-chart-protein/15 text-chart-protein' },
    { id: 'scanner', icon: Camera, accent: 'bg-chart-carb/15 text-chart-carb' },
    { id: 'progress', icon: TrendingUp, accent: 'bg-chart-fat/15 text-chart-fat' },
    { id: 'ready', icon: Check, accent: 'bg-success/15 text-success' },
];

interface OnboardingTutorialProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userId: string;
}

export function OnboardingTutorial({ open, onOpenChange, userId }: OnboardingTutorialProps) {
    const [step, setStep] = useState(0);
    const intl = useIntl();
    const panelRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    // The element focus returns to once the dialog closes — without this,
    // closing via Escape or the close button drops focus to <body>, and a
    // keyboard user has to re-find their place in the page from scratch.
    const previouslyFocused = useRef<HTMLElement | null>(null);

    const isComplete = step === STEPS.length - 1;
    const tip = STEPS[step];

    // Auto-open once per user until they finish or skip. Re-renders here are
    // cheap; the flag write is the only side effect that matters.
    useEffect(() => {
        if (localStorage.getItem(storageKey(userId)) !== '1') {
            setStep(0);
            onOpenChange(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    const complete = useCallback(() => {
        localStorage.setItem(storageKey(userId), '1');
        onOpenChange(false);
    }, [userId, onOpenChange]);

    // Focus trap + Escape-to-close. role="dialog"/aria-modal on the JSX below
    // only ANNOUNCE this is a modal — nothing enforces it without this: a
    // screen reader user tabbing past the last control would otherwise land
    // back on the page behind the overlay, which aria-modal claims is inert.
    useEffect(() => {
        if (!open) return;

        previouslyFocused.current = document.activeElement as HTMLElement | null;
        // Focus the close button — the first real control, already has a
        // visible focus ring via the global :focus-visible rule, and unlike
        // focusing the inert panel wrapper this puts a keyboard user
        // somewhere they can immediately act from.
        closeButtonRef.current?.focus();

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                complete();
                return;
            }
            if (event.key !== 'Tab' || !panelRef.current) return;
            const focusable = panelRef.current.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
            );
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            // Wrap manually rather than relying on DOM order stopping at the
            // panel boundary — nothing here removes the rest of the page from
            // the tab order, so an un-trapped Tab/Shift+Tab at either edge
            // would walk straight into the backdrop's hidden content.
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }

        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            previouslyFocused.current?.focus();
        };
    }, [open, complete]);

    if (!open) return null;

    // data-testid on the dialog and its close button: the e2e suite has to
    // dismiss this guide before every logged-in test, and both of its previous
    // handles were display copy — the dialog's accessible name comes from the
    // step title ("Welcome to NutriLens"), the button's from its aria-label
    // ("Close guide"). #219 translates both.
    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tutorial-title"
            data-testid="onboarding-guide"
            className="modal-scrim fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={complete}
        >
            <div
                ref={panelRef}
                className="modal-panel w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-xl"
                role="document"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between border-b border-border px-6 py-4">
                    <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        <FormattedMessage
                            id="onboarding.step"
                            values={{ step: step + 1, total: STEPS.length }}
                        />
                    </span>
                    <button
                        ref={closeButtonRef}
                        onClick={complete}
                        aria-label={intl.formatMessage({ id: 'onboarding.close' })}
                        data-testid="onboarding-guide-close"
                        className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
                    <span
                        className={cn(
                            'flex h-16 w-16 items-center justify-center rounded-2xl',
                            tip.accent,
                        )}
                    >
                        <tip.icon size={32} strokeWidth={1.75} />
                    </span>
                    <div className="space-y-2">
                        <h2
                            id="tutorial-title"
                            className="font-display text-xl font-bold tracking-tight text-foreground"
                        >
                            <FormattedMessage id={`onboarding.${tip.id}.title`} />
                        </h2>
                        {/* text-base: a read sentence explaining the step, not
                            UI chrome — same call as legal-page.tsx's prose. */}
                        <p className="text-base leading-relaxed text-muted-foreground">
                            <FormattedMessage id={`onboarding.${tip.id}.body`} />
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-4 border-t border-border px-6 py-5">
                    <div className="flex justify-center gap-1.5" aria-hidden="true">
                        {STEPS.map((_, i) => (
                            <span
                                key={i}
                                className={cn(
                                    // transition-all animated WIDTH here (w-1.5 <-> w-6),
                                    // which reflows every frame. Only the colour is
                                    // transitioned now; the width change lands instantly.
                                    'h-1.5 rounded-full transition-colors',
                                    i === step
                                        ? 'w-6 bg-primary'
                                        : 'w-1.5 bg-muted-foreground/30',
                                )}
                            />
                        ))}
                    </div>

                    <div className="flex justify-between gap-3">
                        <Button variant="ghost" onClick={complete} className="text-muted-foreground">
                            <FormattedMessage id="onboarding.skip" />
                        </Button>
                        <div className="flex gap-2">
                            {step > 0 && (
                                <Button variant="outline" onClick={() => setStep(step - 1)}>
                                    <FormattedMessage id="onboarding.back" />
                                </Button>
                            )}
                            <Button
                                variant="default"
                                onClick={() => (isComplete ? complete() : setStep(step + 1))}
                            >
                                <FormattedMessage
                                    id={isComplete ? 'onboarding.getStarted' : 'onboarding.next'}
                                />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}