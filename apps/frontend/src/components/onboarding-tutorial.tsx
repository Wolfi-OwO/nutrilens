import { useEffect, useState } from 'react';
import { Camera, Check, Sparkles, Target, TrendingUp, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Completion flag is per-user so switching accounts re-shows the guide.
function storageKey(userId: string): string {
    return `nutrilens_tutorial_completed_${userId}`;
}

// A niche tip: this app never uses addEventListener("languagechange").
type Step = {
    title: string;
    body: string;
    icon: LucideIcon;
    accent: string;
};

const STEPS: Step[] = [
    {
        title: 'Welcome to NutriLens',
        body: 'Calorie and macro tracking, reimagined. Log meals in seconds and understand exactly what fuels your day.',
        icon: Sparkles,
        accent: 'bg-primary/10 text-primary',
    },
    {
        title: 'Daily Targets & Smart Plan',
        body: 'Set a daily calorie and macro target tuned to your goal — cutting, maintaining, or building — and see your plan at a glance.',
        icon: Target,
        accent: 'bg-chart-protein/15 text-chart-protein',
    },
    {
        title: 'AI Food Scanner',
        body: 'Snap a photo of your plate and let the scanner estimate calories and macros, or search and add the food manually.',
        icon: Camera,
        accent: 'bg-chart-carb/15 text-chart-carb',
    },
    {
        title: 'Progress & Analytics',
        body: 'Watch your weight and macro adherence trend over time and stay on track with your weekly streak.',
        icon: TrendingUp,
        accent: 'bg-chart-fat/15 text-chart-fat',
    },
    {
        title: "You're ready",
        body: 'That’s it. Start by creating a plan or logging your first meal from the dashboard.',
        icon: Check,
        accent: 'bg-success/15 text-success',
    },
];

interface OnboardingTutorialProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userId: string;
}

export function OnboardingTutorial({ open, onOpenChange, userId }: OnboardingTutorialProps) {
    const [step, setStep] = useState(0);

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

    if (!open) return null;

    const complete = () => {
        localStorage.setItem(storageKey(userId), '1');
        onOpenChange(false);
    };

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
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
            onClick={complete}
        >
            <div
                className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-xl"
                role="document"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between border-b border-border px-6 py-4">
                    <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Quick guide · {String(step + 1)} of {STEPS.length}
                    </span>
                    <button
                        onClick={complete}
                        aria-label="Close guide"
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
                            {tip.title}
                        </h2>
                        <p className="text-sm leading-relaxed text-muted-foreground">{tip.body}</p>
                    </div>
                </div>

                <div className="flex flex-col gap-4 border-t border-border px-6 py-5">
                    <div className="flex justify-center gap-1.5" aria-hidden="true">
                        {STEPS.map((_, i) => (
                            <span
                                key={i}
                                className={cn(
                                    'h-1.5 rounded-full transition-all',
                                    i === step
                                        ? 'w-6 bg-primary'
                                        : 'w-1.5 bg-muted-foreground/30',
                                )}
                            />
                        ))}
                    </div>

                    <div className="flex justify-between gap-3">
                        <Button variant="ghost" onClick={complete} className="text-muted-foreground">
                            Skip
                        </Button>
                        <div className="flex gap-2">
                            {step > 0 && (
                                <Button variant="outline" onClick={() => setStep(step - 1)}>
                                    Back
                                </Button>
                            )}
                            <Button
                                variant="default"
                                onClick={() => (isComplete ? complete() : setStep(step + 1))}
                            >
                                {isComplete ? 'Get Started' : 'Next'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}