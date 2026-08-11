import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Beef, Droplet, Flame, Wheat } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

const GOALS: { value: DietPlanGoal; label: string }[] = [
    { value: 'lose_weight', label: 'Lose weight' },
    { value: 'maintain', label: 'Maintain' },
    { value: 'gain_weight', label: 'Gain weight' },
];

const targetsSchema = z.object({
    dailyCalorieTarget: z.coerce.number<number>().positive('Required'),
    proteinTargetGrams: z.coerce.number<number>().min(0),
    carbTargetGrams: z.coerce.number<number>().min(0),
    fatTargetGrams: z.coerce.number<number>().min(0),
});
type TargetsForm = z.infer<typeof targetsSchema>;

const createSchema = targetsSchema.extend({
    goal: z.enum(['lose_weight', 'maintain', 'gain_weight']),
});
type CreateForm = z.infer<typeof createSchema>;

function outOfBounds(values: TargetsForm): string | null {
    if (
        values.dailyCalorieTarget < CALORIE_BOUNDS.min ||
        values.dailyCalorieTarget > CALORIE_BOUNDS.max
    ) {
        return `Daily calories are usually between ${String(CALORIE_BOUNDS.min)} and ${String(CALORIE_BOUNDS.max)} kcal — double check this.`;
    }
    for (const [label, grams] of [
        ['Protein', values.proteinTargetGrams],
        ['Carbs', values.carbTargetGrams],
        ['Fat', values.fatTargetGrams],
    ] as const) {
        if (grams > MACRO_BOUNDS.max) {
            return `${label} target looks unusually high — double check this.`;
        }
    }
    return null;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

const STATS: { key: keyof TargetsForm; label: string; icon: LucideIcon; className: string }[] = [
    {
        key: 'dailyCalorieTarget',
        label: 'Daily calories',
        icon: Flame,
        className: 'bg-primary/15 text-primary',
    },
    {
        key: 'proteinTargetGrams',
        label: 'Protein',
        icon: Beef,
        className: 'bg-chart-protein/15 text-chart-protein',
    },
    {
        key: 'carbTargetGrams',
        label: 'Carbs',
        icon: Wheat,
        className: 'bg-chart-carb/15 text-chart-carb',
    },
    {
        key: 'fatTargetGrams',
        label: 'Fat',
        icon: Droplet,
        className: 'bg-chart-fat/15 text-chart-fat',
    },
];

export default function PlanPage() {
    const dietPlan = useActiveDietPlan();

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="font-display text-2xl font-bold text-foreground">Your plan</h1>
                <p className="mt-1 text-sm text-muted-foreground">Calorie and macro targets.</p>
            </div>

            {dietPlan.isLoading && (
                <Card>
                    <CardContent className="flex flex-col gap-6 pt-6">
                        <div className="flex items-baseline justify-between">
                            <Skeleton className="h-4 w-56" />
                            <Skeleton className="h-4 w-20" />
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {Array.from({ length: 4 }).map((_, i) => (
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
                    <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                        <p className="text-sm text-muted-foreground">Couldn't load your plan.</p>
                        <Button variant="outline" size="sm" onClick={() => void dietPlan.refetch()}>
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            )}

            {!dietPlan.isLoading && !dietPlan.isError && !dietPlan.data && <CreatePlanCard />}

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
        resolver: zodResolver(targetsSchema),
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
    const warning = outOfBounds(values);

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
                    : 'Something went wrong saving your plan. Please try again.',
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
                    <p className="text-sm text-muted-foreground">
                        Goal:{' '}
                        <span className="font-medium text-foreground">{formatGoal(plan.goal)}</span>{' '}
                        · active since {formatDate(plan.startsAt)}
                    </p>
                    <button
                        type="button"
                        onClick={() => setStartingNewPlan(true)}
                        className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                    >
                        Change goal
                    </button>
                </div>

                <form
                    onSubmit={(e) => void handleSubmit(onSubmit)(e)}
                    className="flex flex-col gap-5"
                    noValidate
                >
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {STATS.map((stat) => (
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
                                    {stat.label}
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

                    {warning && (
                        <p className="text-sm text-amber-600 dark:text-amber-500">{warning}</p>
                    )}
                    {saveError && (
                        <p role="alert" className="text-sm text-destructive">
                            {saveError}
                        </p>
                    )}
                    {saved && !isDirty && <p className="text-sm text-primary">Saved.</p>}

                    <Button type="submit" disabled={!isDirty || isSubmitting} className="w-fit">
                        {isSubmitting ? 'Saving…' : 'Save changes'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

function CreatePlanCard({ onCancel }: { onCancel?: () => void }) {
    const createPlan = useCreateDietPlan();
    const [submitError, setSubmitError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<CreateForm>({
        resolver: zodResolver(createSchema),
        defaultValues: {
            dailyCalorieTarget: 2000,
            proteinTargetGrams: 120,
            carbTargetGrams: 200,
            fatTargetGrams: 65,
            goal: 'maintain',
        },
    });

    const values = watch();
    const warning = outOfBounds(values);
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
                    : 'Something went wrong creating your plan. Please try again.',
            );
        }
    };

    return (
        <Card>
            <CardContent className="flex flex-col gap-3 pt-6">
                <div>
                    <h2 className="font-display text-base font-bold text-foreground">
                        {onCancel ? 'Start a new plan' : 'Set up your diet plan'}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Set a daily calorie and macro target to start tracking progress against it.
                    </p>
                </div>

                <form
                    onSubmit={(e) => void handleSubmit(onSubmit)(e)}
                    className="flex flex-col gap-5"
                    noValidate
                >
                    <fieldset className="flex flex-wrap gap-2">
                        <legend className="mb-2 text-sm font-medium text-foreground">Goal</legend>
                        {GOALS.map((option) => (
                            <label key={option.value}>
                                <input
                                    type="radio"
                                    value={option.value}
                                    className="peer sr-only"
                                    checked={goal === option.value}
                                    onChange={() => {
                                        setValue('goal', option.value, { shouldDirty: true });
                                    }}
                                />
                                <span
                                    className={cn(
                                        'inline-flex cursor-pointer items-center rounded-full border border-input px-4 py-2 text-sm font-medium transition-colors hover:bg-muted',
                                        goal === option.value &&
                                            'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
                                    )}
                                >
                                    {option.label}
                                </span>
                            </label>
                        ))}
                    </fieldset>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="dailyCalorieTarget">Daily calories</Label>
                            <Input
                                id="dailyCalorieTarget"
                                type="number"
                                inputMode="decimal"
                                aria-invalid={!!errors.dailyCalorieTarget}
                                {...register('dailyCalorieTarget')}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="proteinTargetGrams">Protein (g)</Label>
                            <Input
                                id="proteinTargetGrams"
                                type="number"
                                inputMode="decimal"
                                {...register('proteinTargetGrams')}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="carbTargetGrams">Carbs (g)</Label>
                            <Input
                                id="carbTargetGrams"
                                type="number"
                                inputMode="decimal"
                                {...register('carbTargetGrams')}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="fatTargetGrams">Fat (g)</Label>
                            <Input
                                id="fatTargetGrams"
                                type="number"
                                inputMode="decimal"
                                {...register('fatTargetGrams')}
                            />
                        </div>
                    </div>

                    {warning && (
                        <p className="text-sm text-amber-600 dark:text-amber-500">{warning}</p>
                    )}
                    {submitError && (
                        <p role="alert" className="text-sm text-destructive">
                            {submitError}
                        </p>
                    )}

                    <div className="flex gap-3">
                        <Button type="submit" disabled={isSubmitting} className="w-fit">
                            {isSubmitting ? 'Saving…' : onCancel ? 'Start new plan' : 'Create plan'}
                        </Button>
                        {onCancel && (
                            <Button
                                type="button"
                                variant="outline"
                                className="w-fit"
                                onClick={onCancel}
                            >
                                Cancel
                            </Button>
                        )}
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

function formatGoal(goal: DietPlanGoal): string {
    return GOALS.find((option) => option.value === goal)?.label ?? goal;
}
