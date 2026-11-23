import { Camera, ClipboardCheck, ShieldCheck, Sparkles, Target } from 'lucide-react';
import { useEffect } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link } from 'react-router';
import { Footer } from '@/components/layout/footer';
import { LocaleToggle } from '@/components/locale-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';

// What a logged-out visitor sees at "/" (a signed-in one gets the dashboard there). It is the page search engines
// land on for the product, so it says in plain words what NutriLens does and shows the entry the app produces. The
// figures in the sample card are an invented example and labelled as one; nothing here claims users or results.
const STEPS = [
    { icon: Camera, id: 'photo' },
    { icon: ClipboardCheck, id: 'review' },
    { icon: Target, id: 'plan' },
] as const;

// --primary-strong, not --primary, for small text: the measured contrast is in index.css and about.tsx.
const LINK_CLASS = 'font-medium text-primary-strong hover:underline';

function ExampleCard() {
    const intl = useIntl();
    const macros = [
        { id: 'protein', value: '9 g' },
        { id: 'carbs', value: '58 g' },
        { id: 'fat', value: '5 g' },
    ] as const;
    return (
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    <FormattedMessage id="landing.example.label" />
                </p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Sparkles size={14} className="text-accent" aria-hidden="true" />
                    <FormattedMessage id="landing.example.recognised" />
                </p>
            </div>
            <p className="mt-4 font-display text-xl font-semibold tracking-tight text-foreground">
                <FormattedMessage id="landing.example.meal" />
            </p>
            <p className="mt-1 flex items-baseline gap-1.5">
                <span className="font-display text-5xl leading-none font-bold text-foreground tabular-nums">
                    312
                </span>
                <span className="text-sm text-muted-foreground">
                    {intl.formatMessage({ id: 'landing.example.kcal' })}
                </span>
            </p>
            <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4">
                {macros.map((m) => (
                    <div key={m.id}>
                        <dt className="text-xs text-muted-foreground">
                            <FormattedMessage id={`landing.example.${m.id}`} />
                        </dt>
                        <dd className="mt-0.5 text-base font-semibold text-foreground tabular-nums">
                            {m.value}
                        </dd>
                    </div>
                ))}
            </dl>
            <div className="mt-5 border-t border-border pt-4">
                <div className="flex items-baseline justify-between text-sm">
                    <span className="text-muted-foreground">
                        <FormattedMessage id="landing.example.left" />
                    </span>
                    <span className="font-semibold text-foreground tabular-nums">
                        {intl.formatNumber(1288)}{' '}
                        {intl.formatMessage({ id: 'landing.example.kcal' })}
                    </span>
                </div>
                <div
                    className="mt-2 h-2 overflow-hidden rounded-full bg-secondary"
                    role="img"
                    aria-label={`312 / ${intl.formatNumber(1600)} ${intl.formatMessage({ id: 'landing.example.kcal' })}`}
                >
                    <div className="h-full rounded-full bg-primary" style={{ width: '19.5%' }} />
                </div>
            </div>
        </div>
    );
}

export default function LandingPage() {
    const intl = useIntl();

    // The shell's title and description are the English fallback; this page follows the active language.
    useEffect(() => {
        const previous = document.title;
        document.title = intl.formatMessage({ id: 'landing.title' });
        const meta = document.querySelector('meta[name="description"]');
        const before = meta?.getAttribute('content') ?? null;
        meta?.setAttribute('content', intl.formatMessage({ id: 'landing.description' }));
        return () => {
            document.title = previous;
            if (before !== null) meta?.setAttribute('content', before);
        };
    }, [intl]);

    return (
        <div className="flex min-h-dvh flex-col bg-background text-foreground">
            <a
                href="#main"
                className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
            >
                <FormattedMessage id="landing.skip" />
            </a>
            <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
                <Link to="/" className="flex items-center gap-2.5 text-foreground">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border-key bg-accent text-sm font-semibold text-accent-foreground">
                        N
                    </span>
                    <span className="font-display text-xl font-semibold tracking-tight">
                        nutrilens
                    </span>
                </Link>
                <div className="flex items-center gap-1.5">
                    <LocaleToggle />
                    <ThemeToggle />
                    <Button asChild variant="outline" size="sm" className="ml-1">
                        <Link to="/login">
                            <FormattedMessage id="landing.cta.login" />
                        </Link>
                    </Button>
                </div>
            </header>

            <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 sm:px-8">
                <section className="grid items-center gap-10 py-10 lg:grid-cols-[3fr_2fr] lg:gap-16 lg:py-16">
                    <div>
                        <p className="text-xs font-semibold tracking-wide text-foreground uppercase">
                            <FormattedMessage id="landing.eyebrow" />
                        </p>
                        <h1 className="mt-3 max-w-2xl font-display text-4xl leading-[1.05] font-bold text-foreground sm:text-5xl">
                            <FormattedMessage id="landing.h1" />
                        </h1>
                        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
                            <FormattedMessage id="landing.lede" />
                        </p>
                        <div className="mt-7 flex flex-wrap items-center gap-3">
                            <Button asChild size="lg">
                                <Link to="/register">
                                    <FormattedMessage id="landing.cta.register" />
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="lg">
                                <Link to="/login">
                                    <FormattedMessage id="landing.cta.login" />
                                </Link>
                            </Button>
                        </div>
                        <p className="mt-4 text-sm text-muted-foreground">
                            <FormattedMessage id="landing.note" />
                        </p>
                    </div>
                    <ExampleCard />
                </section>

                <section className="border-t border-border py-12" aria-labelledby="how">
                    <h2
                        id="how"
                        className="font-display text-2xl font-semibold tracking-tight text-foreground"
                    >
                        <FormattedMessage id="landing.steps.heading" />
                    </h2>
                    <ol className="mt-6 grid gap-5 md:grid-cols-3">
                        {STEPS.map(({ icon: Icon, id }, i) => (
                            <li key={id} className="rounded-lg border border-border bg-card p-5">
                                <div className="flex items-center gap-3">
                                    <span className="font-display text-sm font-semibold text-muted-foreground tabular-nums">
                                        {String(i + 1).padStart(2, '0')}
                                    </span>
                                    <Icon size={20} strokeWidth={2} className="text-accent" />
                                </div>
                                <h3 className="mt-3 font-display text-lg font-semibold tracking-tight text-foreground">
                                    <FormattedMessage id={`landing.step.${id}.title`} />
                                </h3>
                                <p className="mt-1.5 text-base leading-relaxed text-muted-foreground">
                                    <FormattedMessage id={`landing.step.${id}.body`} />
                                </p>
                            </li>
                        ))}
                    </ol>
                </section>

                <section className="border-t border-border py-12" aria-labelledby="why">
                    <h2
                        id="why"
                        className="font-display text-2xl font-semibold tracking-tight text-foreground"
                    >
                        <FormattedMessage id="landing.why.heading" />
                    </h2>
                    <div className="mt-6 grid gap-5 md:grid-cols-[3fr_2fr]">
                        <div className="rounded-lg border border-border bg-card p-5">
                            <Sparkles size={20} strokeWidth={2} className="text-accent" />
                            <h3 className="mt-3 font-display text-lg font-semibold tracking-tight text-foreground">
                                <FormattedMessage id="about.database.title" />
                            </h3>
                            <p className="mt-1.5 max-w-xl text-base leading-relaxed text-muted-foreground">
                                <FormattedMessage id="about.database.body" />
                            </p>
                        </div>
                        <div className="rounded-lg border border-border bg-card p-5">
                            <ShieldCheck size={20} strokeWidth={2} className="text-accent" />
                            <h3 className="mt-3 font-display text-lg font-semibold tracking-tight text-foreground">
                                <FormattedMessage id="about.privacy.title" />
                            </h3>
                            <p className="mt-1.5 text-base leading-relaxed text-muted-foreground">
                                <FormattedMessage id="about.privacy.body" />
                            </p>
                        </div>
                    </div>
                    <p className="mt-6 text-sm text-muted-foreground">
                        <FormattedMessage id="landing.limits.body" />{' '}
                        <Link to="/about" className={LINK_CLASS}>
                            <FormattedMessage id="landing.limits.link" />
                        </Link>
                    </p>
                </section>
            </main>

            <Footer />
        </div>
    );
}
