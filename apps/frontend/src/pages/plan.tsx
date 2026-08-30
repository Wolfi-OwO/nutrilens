import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AlertTriangle, Beef, Droplet, Flame, Target, Wheat } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FormattedDate, FormattedMessage, useIntl } from 'react-intl';
import type { IntlShape } from 'react-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import EmptyState from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useActiveDietPlan } from '@/hooks/use-active-diet-plan';
import { useCreateDietPlan, useUpdateDietPlan } from '@/hooks/use-diet-plan';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import type { DietPlanGoal } from '@/types/api';

// Mirrors DietPlanService's MIN/MAX_CALORIE_TARGET and MIN/MAX_MACRO_GRAMS —
// the API is the last line of defense (UC-10 4a: warn, don't block, in the UI).
const CALORIE_BOUNDS = { min: 800, max: 6000 };
const MACRO_BOUNDS = { min: 0, max: 600 };

// The raw enum, in display order. Labels come from `plan.goal.<value>` so the
// value that reaches the API and the value the e2e suite reads off
// data-goal stay the enum, never a translated string.
const GOALS: DietPlanGoal[] = ['lose_weight', 'maintain', 'gain_weight'];

// Rebuilt per render from the active locale — zod bakes messages in at schema
// construction, so a module-level schema keeps whichever language was active
// when this module was first evaluated. Same reasoning as login.tsx.
function buildTargetsSchema(intl: IntlShape) {
    return z.object({
        dailyCalorieTarget: z.coerce
            .number<number>()
            .positive(intl.formatMessage({ id: 'plan.validation.required' })),
        proteinTargetGrams: z.coerce.number<number>().min(0),
        carbTargetGrams: z.coerce.number<number>().min(0),
        fatTargetGrams: z.coerce.number<number>().min(0),
    });
}
type TargetsForm = z.infer<ReturnType<typeof buildTargetsSchema>>;

function buildCreateSchema(intl: IntlShape) {
    return buildTargetsSchema(intl).extend({
        goal: z.enum(['lose_weight', 'maintain', 'gain_weight']),
    });
}
type CreateForm = z.infer<ReturnType<typeof buildCreateSchema>>;

function outOfBounds(values: TargetsForm, intl: IntlShape): string | null {
    if (
        values.dailyCalorieTarget < CALORIE_BOUNDS.min ||
        values.dailyCalorieTarget > CALORIE_BOUNDS.max
    ) {
        return intl.formatMessage(
            { id: 'plan.warning.calories' },
            { min: CALORIE_BOUNDS.min, max: CALORIE_BOUNDS.max },
        );
    }
    for (const [messageId, grams] of [
        ['macro.protein', values.proteinTargetGrams],
        ['macro.carbs', values.carbTargetGrams],
        ['macro.fat', values.fatTargetGrams],
    ] as const) {
        if (grams > MACRO_BOUNDS.max) {
            return intl.formatMessage(
                { id: 'plan.warning.macro' },
                { macro: intl.formatMessage({ id: messageId }) },
            );
        }
    }
    return null;
}

const STATS: { key: keyof TargetsForm; labelId: string; icon: LucideIcon; className: string }[] = [
    {
        key: 'dailyCalorieTarget',
        labelId: 'plan.dailyCalories',
        icon: Flame,
        className: 'bg-primary/15 text-primary',
    },
    {
        key: 'proteinTargetGrams',
        labelId: 'macro.proteinGrams',
        icon: Beef,
        className: 'bg-chart-protein/15 text-chart-protein',
    },
    {
        key: 'carbTargetGrams',
        labelId: 'macro.carbGrams',
        icon: Wheat,
        className: 'bg-chart-carb/15 text-chart-carb',
    },
    {
        key: 'fatTargetGrams',
        labelId: 'macro.fatGrams',
        icon: Droplet,
        className: 'bg-chart-fat/15 text-chart-fat',
    },
];

// The calorie target renders alone, larger, ahead of a hairline rule —
// deliberately not a 4th identical box next to the macros. It's the one
// dominant number on this form, the macros are a secondary supporting trio.
const CALORIE_STAT = STATS[0];
const MACRO_STATS = STATS.slice(1);

// Same 4/4/9 kcal-per-gram convention nutrition labels use, so "60% of
// calories from carbs" reads the same way here as it would on a food label —
// a plain gram total doesn't tell you that, since fat is more calorie-dense
// per gram than protein or carbs.
const MACRO_CHART: {
    key: 'proteinTargetGrams' | 'carbTargetGrams' | 'fatTargetGrams';
    labelId: string;
    kcalPerGram: number;
    barClassName: string;
    dotClassName: string;
}[] = [
    { key: 'proteinTargetGrams', labelId: 'macro.protein', kcalPerGram: 4, barClassName: 'bg-chart-protein', dotClassName: 'bg-chart-protein' },
    { key: 'carbTargetGrams', labelId: 'macro.carbs', kcalPerGram: 4, barClassName: 'bg-chart-carb', dotClassName: 'bg-chart-carb' },
    { key: 'fatTargetGrams', labelId: 'macro.fat', kcalPerGram: 9, barClassName: 'bg-chart-fat', dotClassName: 'bg-chart-fat' },
];

function macroSplit(values: TargetsForm): Record<(typeof MACRO_CHART)[number]['key'], number> | null {
    const kcal = MACRO_CHART.map((m) => (values[m.key] || 0) * m.kcalPerGram);
    const total = kcal.reduce((a, b) => a + b, 0);
    if (total <= 0) return null;
    return {
        proteinTargetGrams: (kcal[0] / total) * 100,
        carbTargetGrams: (kcal[1] / total) * 100,
        fatTargetGrams: (kcal[2] / total) * 100,
    };
}

// Live preview of where the daily calories go, driven by the same watched
// form values as the inputs above it — so it updates as the user types,
// same "the valid state gets feedback too" principle the rest of the form
// follows.
function MacroSplitBar({ values }: { values: TargetsForm }) {
    const split = macroSplit(values);
    if (!split) return null;

    return (
        <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">
                <FormattedMessage id="plan.caloriesFromMacros" />
            </p>
            {/* chart-carb and chart-fat measure under 3:1 against white/near-white
                surfaces in light mode (1.92:1 and 2.05:1 — measured), so segment
                boundaries use a visible gap rather than relying on hue contrast
                alone, and the legend below repeats every value as text. */}
            <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
                {MACRO_CHART.map((m) => {
                    const pct = split[m.key];
                    if (pct <= 0) return null;
                    return (
                        <div
                            key={m.key}
                            className={cn('h-full rounded-full', m.barClassName)}
                            style={{ width: `${String(pct)}%` }}
                        />
                    );
                })}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
                {MACRO_CHART.map((m) => (
                    <span key={m.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className={cn('h-2 w-2 shrink-0 rounded-full', m.dotClassName)} aria-hidden="true" />
                        <FormattedMessage id={m.labelId} />{' '}
                        <span className="font-medium text-foreground">
                            {/* ICU's percent skeleton takes a fraction, so the
                                0-100 split is divided back down here. */}
                            <FormattedMessage
                                id="plan.macroShare"
                                values={{ percent: Math.round(split[m.key]) / 100 }}
                            />
                        </span>
                    </span>
                ))}
            </div>
        </div>
    );
}

export default function PlanPage() {
    const intl = useIntl();
    const dietPlan = useActiveDietPlan();

    return (
        <div className="page-enter flex flex-col gap-6">
            <div>
                <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
                    <FormattedMessage id="plan.title" />
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    <FormattedMessage id="plan.subtitle" />
                </p>
            </div>

            {dietPlan.isLoading && (
                <Card>
                    <CardContent className="flex flex-col gap-6 pt-6">
                        <div className="flex items-baseline justify-between">
                            <Skeleton className="h-4 w-56" />
                            <Skeleton className="h-4 w-20" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-11 w-full rounded-lg sm:max-w-56" />
                        </div>
                        <div className="grid grid-cols-3 gap-3 border-t border-border pt-5">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex flex-col gap-1.5">
                                    <Skeleton className="h-4 w-16" />
                                    <Skeleton className="h-11 w-full rounded-lg" />
                                </div>
                            ))}
                        </div>
                        <Skeleton className="h-11 w-32 rounded-lg" />
                    </CardContent>
                </Card>
            )}

            {dietPlan.isError && (
                <Card>
                    <CardContent className="pt-10 pb-10">
                        <EmptyState
                            icon={AlertTriangle}
                            title={intl.formatMessage({ id: 'plan.loadErrorTitle' })}
                            description={intl.formatMessage({ id: 'plan.loadErrorBody' })}
                            action={{
                                label: intl.formatMessage({ id: 'common.retry' }),
                                onClick: () => void dietPlan.refetch(),
                            }}
                            headingLevel={2}
                        />
                    </CardContent>
                </Card>
            )}

            {!dietPlan.isLoading && !dietPlan.isError && !dietPlan.data && (
                <div className="flex flex-col gap-6">
                    <EmptyState
                        icon={Target}
                        title={intl.formatMessage({ id: 'plan.emptyTitle' })}
                        description={intl.formatMessage({ id: 'plan.emptyBody' })}
                        headingLevel={2}
                    />
                    <CreatePlanCard />
                </div>
            )}

            {!dietPlan.isLoading && !dietPlan.isError && dietPlan.data && (
                <ExistingPlanCard plan={dietPlan.data} />
            )}
        </div>
    );
}

function ExistingPlanCard({
    plan,
}: {
    plan: NonNullable<ReturnType<typeof useActiveDietPlan>['data']>;
}) {
    const intl = useIntl();
    const [startingNewPlan, setStartingNewPlan] = useState(false);
    const updatePlan = useUpdateDietPlan(plan.id);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    const {
        register,
        handleSubmit,
        watch,
        reset,
        formState: { isDirty, isSubmitting },
    } = useForm<TargetsForm>({
        resolver: zodResolver(buildTargetsSchema(intl)),
        defaultValues: {
            dailyCalorieTarget: plan.dailyCalorieTarget,
            proteinTargetGrams: plan.proteinTargetGrams,
            carbTargetGrams: plan.carbTargetGrams,
            fatTargetGrams: plan.fatTargetGrams,
        },
    });

    useEffect(() => {
        reset({
            dailyCalorieTarget: plan.dailyCalorieTarget,
            proteinTargetGrams: plan.proteinTargetGrams,
            carbTargetGrams: plan.carbTargetGrams,
            fatTargetGrams: plan.fatTargetGrams,
        });
    }, [plan, reset]);

    const values = watch();
    const warning = outOfBounds(values, intl);

    const onSubmit = async (values: TargetsForm) => {
        setSaveError(null);
        setSaved(false);
        try {
            await updatePlan.mutateAsync(values);
            setSaved(true);
        } catch (error) {
            setSaveError(
                error instanceof ApiError && error.body?.message
                    ? error.body.message
                    : intl.formatMessage({ id: 'plan.saveError' }),
            );
        }
    };

    if (startingNewPlan) {
        return <CreatePlanCard onCancel={() => setStartingNewPlan(false)} />;
    }

    return (
        <Card>
            <CardContent className="flex flex-col gap-6 pt-6">
                <div className="flex items-baseline justify-between">
                    {/* data-testid plus data-goal: the e2e suite proves a created
                        plan is reflected here, and both facts it checked were
                        display copy — the summary wording and the goal's label.
                        data-goal is the raw enum ('lose_weight'), so the
                        assertion survives #219 and gets stricter, not looser. */}
                    <p
                        className="text-sm text-muted-foreground"
                        data-testid="plan-summary"
                        data-goal={plan.goal}
                    >
                        <FormattedMessage
                            id="plan.summary"
                            values={{
                                goal: intl.formatMessage({ id: `plan.goal.${plan.goal}` }),
                                date: (
                                    <FormattedDate
                                        value={plan.startsAt}
                                        year="numeric"
                                        month="long"
                                        day="numeric"
                                    />
                                ),
                                name: (chunks) => (
                                    <span className="font-medium text-foreground">{chunks}</span>
                                ),
                            }}
                        />
                    </p>
                    {/* text-primary-strong, not text-primary: --primary on the
                        card surface measures 4.36:1, under the 4.5:1 AA floor
                        for text this size; --primary-strong is 6.30:1. */}
                    <button
                        type="button"
                        onClick={() => setStartingNewPlan(true)}
                        className="-my-2.5 -mr-2.5 flex h-11 items-center px-2.5 text-sm font-medium text-primary-strong underline-offset-2 hover:underline"
                    >
                        <FormattedMessage id="plan.changeGoal" />
                    </button>
                </div>

                <form
                    onSubmit={(e) => void handleSubmit(onSubmit)(e)}
                    className="flex flex-col gap-5"
                    noValidate
                >
                    <div className="flex flex-col gap-1.5">
                        <Label
                            htmlFor={CALORIE_STAT.key}
                            className="flex items-center gap-1.5 text-muted-foreground"
                        >
                            <span
                                className={cn(
                                    'flex h-6 w-6 items-center justify-center rounded-md',
                                    CALORIE_STAT.className,
                                )}
                            >
                                <CALORIE_STAT.icon size={13} strokeWidth={2.25} />
                            </span>
                            <FormattedMessage id={CALORIE_STAT.labelId} />
                        </Label>
                        <Input
                            id={CALORIE_STAT.key}
                            type="number"
                            inputMode="decimal"
                            className="font-display text-lg tabular-nums sm:max-w-56"
                            {...register(CALORIE_STAT.key)}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-3 border-t border-border pt-5">
                        {MACRO_STATS.map((stat) => (
                            <div key={stat.key} className="flex flex-col gap-1.5">
                                <Label
                                    htmlFor={stat.key}
                                    className="flex items-center gap-1.5 text-muted-foreground"
                                >
                                    <span
                                        className={cn(
                                            'flex h-6 w-6 items-center justify-center rounded-md',
                                            stat.className,
                                        )}
                                    >
                                        <stat.icon size={13} strokeWidth={2.25} />
                                    </span>
                                    <FormattedMessage id={stat.labelId} />
                                </Label>
                                <Input
                                    id={stat.key}
                                    type="number"
                                    inputMode="decimal"
                                    {...register(stat.key)}
                                />
                            </div>
                        ))}
                    </div>

                    <MacroSplitBar values={values} />

                    {/* data-testid on the out-of-bounds warning, the saved
                        confirmation and the submit button: each was reachable
                        only by its own wording, all of which #219 translates.
                        plan-warning appears in both cards on purpose — they are
                        two renders of the same warning and never coexist. */}
                    {warning && (
                        <p className="text-sm text-muted-foreground" data-testid="plan-warning">
                            {warning}
                        </p>
                    )}
                    {saveError && (
                        <p role="alert" className="text-sm text-destructive">
                            {saveError}
                        </p>
                    )}
                    {saved && !isDirty && (
                        <p className="text-sm text-primary-strong" data-testid="plan-saved">
                            <FormattedMessage id="plan.saved" />
                        </p>
                    )}

                    <Button
                        type="submit"
                        disabled={!isDirty || isSubmitting}
                        className="w-fit"
                        data-testid="plan-save"
                    >
                        <FormattedMessage id={isSubmitting ? 'common.saving' : 'common.saveChanges'} />
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

function CreatePlanCard({ onCancel }: { onCancel?: () => void }) {
    const intl = useIntl();
    const createPlan = useCreateDietPlan();
    const [submitError, setSubmitError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<CreateForm>({
        resolver: zodResolver(buildCreateSchema(intl)),
        defaultValues: {
            dailyCalorieTarget: 2000,
            proteinTargetGrams: 120,
            carbTargetGrams: 200,
            fatTargetGrams: 65,
            goal: 'maintain',
        },
    });

    const values = watch();
    const warning = outOfBounds(values, intl);
    const goal = watch('goal');

    const onSubmit = async (values: CreateForm) => {
        setSubmitError(null);
        try {
            await createPlan.mutateAsync(values);
            onCancel?.();
        } catch (error) {
            setSubmitError(
                error instanceof ApiError && error.body?.message
                    ? error.body.message
                    : intl.formatMessage({ id: 'plan.createError' }),
            );
        }
    };

    return (
        <Card>
            <CardContent className="flex flex-col gap-3 pt-6">
                <div>
                    <h2
                        className="font-display text-base font-bold text-foreground"
                        data-testid="plan-create-heading"
                    >
                        <FormattedMessage id={onCancel ? 'plan.startNewPlan' : 'plan.setUpTitle'} />
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        <FormattedMessage id="plan.setUpBody" />
                    </p>
                </div>

                <form
                    onSubmit={(e) => void handleSubmit(onSubmit)(e)}
                    className="flex flex-col gap-5"
                    noValidate
                >
                    <fieldset className="flex flex-wrap gap-2">
                        <legend className="mb-2 text-sm font-medium text-foreground">
                            <FormattedMessage id="plan.goal" />
                        </legend>
                        {GOALS.map((option) => (
                            <label key={option}>
                                <input
                                    type="radio"
                                    value={option}
                                    className="peer sr-only"
                                    checked={goal === option}
                                    onChange={() => {
                                        setValue('goal', option, { shouldDirty: true });
                                    }}
                                />
                                <span
                                    className={cn(
                                        'inline-flex cursor-pointer items-center rounded-full border border-input px-4 py-2 text-sm font-medium transition-colors hover:bg-muted',
                                        goal === option &&
                                            'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
                                    )}
                                >
                                    <FormattedMessage id={`plan.goal.${option}`} />
                                </span>
                            </label>
                        ))}
                    </fieldset>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="dailyCalorieTarget">
                            <FormattedMessage id="plan.dailyCalories" />
                        </Label>
                        <Input
                            id="dailyCalorieTarget"
                            type="number"
                            inputMode="decimal"
                            className="font-display text-lg tabular-nums sm:max-w-56"
                            aria-invalid={!!errors.dailyCalorieTarget}
                            {...register('dailyCalorieTarget')}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-3 border-t border-border pt-5">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="proteinTargetGrams">
                                <FormattedMessage id="macro.proteinGrams" />
                            </Label>
                            <Input
                                id="proteinTargetGrams"
                                type="number"
                                inputMode="decimal"
                                {...register('proteinTargetGrams')}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="carbTargetGrams">
                                <FormattedMessage id="macro.carbGrams" />
                            </Label>
                            <Input
                                id="carbTargetGrams"
                                type="number"
                                inputMode="decimal"
                                {...register('carbTargetGrams')}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="fatTargetGrams">
                                <FormattedMessage id="macro.fatGrams" />
                            </Label>
                            <Input
                                id="fatTargetGrams"
                                type="number"
                                inputMode="decimal"
                                {...register('fatTargetGrams')}
                            />
                        </div>
                    </div>

                    <MacroSplitBar values={values} />

                    {warning && (
                        <p className="text-sm text-muted-foreground" data-testid="plan-warning">
                            {warning}
                        </p>
                    )}
                    {submitError && (
                        <p role="alert" className="text-sm text-destructive">
                            {submitError}
                        </p>
                    )}

                    <div className="flex gap-3">
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-fit"
                            data-testid="plan-create"
                        >
                            <FormattedMessage
                                id={
                                    isSubmitting
                                        ? 'common.saving'
                                        : onCancel
                                          ? 'plan.startNew'
                                          : 'plan.create'
                                }
                            />
                        </Button>
                        {onCancel && (
                            <Button
                                type="button"
                                variant="outline"
                                className="w-fit"
                                onClick={onCancel}
                            >
                                <FormattedMessage id="common.cancel" />
                            </Button>
                        )}
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
