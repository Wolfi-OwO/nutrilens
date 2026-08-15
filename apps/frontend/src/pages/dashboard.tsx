import { useMemo, useState } from 'react';
import { Beef, Droplet, Flame, GlassWater, Plus, Wheat } from 'lucide-react';
import { Link } from 'react-router';
import { CalorieRing } from '@/components/dashboard/calorie-ring';
import { MacroBar } from '@/components/dashboard/macro-bar';
import { SourceBadge } from '@/components/dashboard/source-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useActiveDietPlan } from '@/hooks/use-active-diet-plan';
import { useMealLogs } from '@/hooks/use-meal-logs';
import { computeStreak, isToday, localDateKey } from '@/lib/date-utils';
import type { MealLog } from '@/types/api';

const WATER_KEY = 'nutrilens.water';

// The API's MealLog has no meal-type field, so "meals" is derived from the
// logged hour like a nutrition app would do it — a loose partition, not a
// strict breakfast/lunch boundary.
function mealTypeOf(loggedAt: string): 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks' {
    const hour = new Date(loggedAt).getHours();
    if (hour < 11) return 'Breakfast';
    if (hour < 15) return 'Lunch';
    if (hour < 21) return 'Dinner';
    return 'Snacks';
}

const MEAL_ORDER: ['Breakfast', 'Lunch', 'Dinner', 'Snacks'] = [
    'Breakfast',
    'Lunch',
    'Dinner',
    'Snacks',
];

function greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
}

export default function DashboardPage() {
    const { user } = useAuth();
    const dietPlan = useActiveDietPlan();
    const mealLogs = useMealLogs();
    const isDietPlanLoading = dietPlan.isLoading;
    const isMealLogsLoading = mealLogs.isLoading;

    const todaysMeals = useMemo(
        () => (mealLogs.data ?? []).filter((log) => isToday(log.loggedAt)),
        [mealLogs.data],
    );

    const totals = useMemo(
        () =>
            todaysMeals.reduce(
                (acc, meal) => ({
                    calories: acc.calories + meal.totalCalories,
                    protein: acc.protein + meal.proteinGrams,
                    carb: acc.carb + meal.carbGrams,
                    fat: acc.fat + meal.fatGrams,
                }),
                { calories: 0, protein: 0, carb: 0, fat: 0 },
            ),
        [todaysMeals],
    );

    const streak = useMemo(
        () =>
            computeStreak((mealLogs.data ?? []).map((log) => localDateKey(new Date(log.loggedAt)))),
        [mealLogs.data],
    );

    const isLoading = dietPlan.isLoading || mealLogs.isLoading;
    const isError = dietPlan.isError || mealLogs.isError;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-baseline justify-between">
                <div>
                    <h1 className="font-display text-2xl font-bold text-foreground">
                        {greeting()}, {user?.displayName.split(' ')[0]}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">Here's where today stands.</p>
                </div>
                {streak > 1 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground">
                        <Flame size={16} strokeWidth={2.25} />
                        {streak}-day streak
                    </span>
                )}
            </div>
            <>
                { (isDietPlanLoading || !dietPlan.data) && !isError && (
                    <Card>
                        <CardContent>
                            <Skeleton className="h-4 w-24 mb-2" />
                            <Skeleton className="h-4 w-full mb-2" />
                            <Skeleton className="h-4 w-60 mb-4" />
                            <Skeleton className="h-8 w-24" />
                        </CardContent>
                    </Card>
                )}
                { dietPlan.data && !isError && (
                    <>
                        <Card>
                            <CardContent className="flex flex-col items-center gap-6 pt-6 sm:flex-row sm:items-stretch">
                                <div className="flex items-center justify-center sm:border-r sm:border-border sm:pr-6">
                                    <Skeleton className="h-32 w-32 rounded-full" />
                                </div>
                                <div className="flex-1 space-y-4">
                                    <div className="flex items-baseline justify-between">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-4 w-20" />
                                    </div>
                                    <div className="space-y-3">
                                        <Skeleton className="h-8 w-full rounded-full" />
                                        <Skeleton className="h-8 w-full rounded-full" />
                                        <Skeleton className="h-8 w-full rounded-full" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        { isMealLogsLoading && (
                            <div className="flex flex-col gap-2">
                                <Skeleton className="h-4 w-24 mb-2" />
                                <Skeleton className="h-4 w-full mb-2" />
                                <Skeleton className="h-4 w-full mb-2" />
                                <Skeleton className="h-4 w-full" />
                            </div>
                        )}
                    </>
                )}
            </>

            {isError && !isLoading && (
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                        <p className="text-sm text-muted-foreground">
                            Couldn't load today's progress. Check your connection and try again.
                        </p>
                        <Button
                            variant="outline"
                            onClick={() => {
                                void dietPlan.refetch();
                                void mealLogs.refetch();
                            }}
                        >
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            )}

            {!isLoading && !isError && !dietPlan.data && (
                <Card>
                    <CardHeader>
                        <CardTitle>Set up your diet plan</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        <p className="text-sm text-muted-foreground">
                            Set a daily calorie and macro target to start tracking progress against
                            it.
                        </p>
                        <Button asChild className="w-fit">
                            <Link to="/plan">Create a plan</Link>
                        </Button>
                    </CardContent>
                </Card>
            )}

            {!isLoading && !isError && dietPlan.data && (
                <Card>
                    <CardContent className="flex flex-col items-center gap-6 pt-6 sm:flex-row sm:items-stretch">
                        <div className="flex items-center justify-center sm:border-r sm:border-border sm:pr-6">
                            <CalorieRing
                                consumed={totals.calories}
                                target={dietPlan.data.dailyCalorieTarget}
                            />
                        </div>
                        <div className="flex-1 space-y-4">
                            <div className="flex items-baseline justify-between">
                                <p className="text-sm font-medium text-muted-foreground">
                                    Today's intake
                                </p>
                                <p className="font-mono text-sm tabular-nums text-muted-foreground">
                                    <span className="font-semibold text-foreground">
                                        {totals.calories.toLocaleString()}
                                    </span>{' '}
                                    / {dietPlan.data.dailyCalorieTarget.toLocaleString()} kcal
                                </p>
                            </div>
                            <div className="space-y-3">
                                <MacroBar
                                    label="Protein"
                                    icon={Beef}
                                    consumed={totals.protein}
                                    target={dietPlan.data.proteinTargetGrams}
                                    barClassName="bg-chart-protein"
                                    iconClassName="bg-chart-protein/15 text-chart-protein"
                                />
                                <MacroBar
                                    label="Carbs"
                                    icon={Wheat}
                                    consumed={totals.carb}
                                    target={dietPlan.data.carbTargetGrams}
                                    barClassName="bg-chart-carb"
                                    iconClassName="bg-chart-carb/15 text-chart-carb"
                                />
                                <MacroBar
                                    label="Fat"
                                    icon={Droplet}
                                    consumed={totals.fat}
                                    target={dietPlan.data.fatTargetGrams}
                                    barClassName="bg-chart-fat"
                                    iconClassName="bg-chart-fat/15 text-chart-fat"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {!isLoading && !isError && (
                <>
                    <WaterCard />

                    <div>
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="font-display text-lg font-bold text-foreground">
                                Today's meals
                            </h2>
                            <Button asChild variant="outline" size="sm" className="gap-1.5">
                                <Link to="/log-meal">
                                    <Plus size={16} strokeWidth={2} />
                                    Log meal
                                </Link>
                            </Button>
                        </div>

                        {todaysMeals.length === 0 ? (
                            <Card>
                                <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                                    <p className="text-sm text-muted-foreground">
                                        Nothing logged yet today.
                                    </p>
                                    <Button asChild variant="outline" className="w-fit">
                                        <Link to="/log-meal">Log a meal</Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {MEAL_ORDER.map((type) => {
                                    const meals = todaysMeals.filter(
                                        (meal) => mealTypeOf(meal.loggedAt) === type,
                                    );
                                    if (meals.length === 0) return null;
                                    const kcal = meals.reduce(
                                        (sum, meal) => sum + meal.totalCalories,
                                        0,
                                    );
                                    return (
                                        <MealSection key={type} type={type} meals={meals} kcal={kcal} />
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function MealSection({
    type,
    meals,
    kcal,
}: {
    type: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks';
    meals: MealLog[];
    kcal: number;
}) {
    return (
        <section>
            <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-foreground">{type}</h3>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {kcal} kcal
                </span>
            </div>
            <ul className="flex flex-col gap-2">
                {meals.map((meal) => (
                    <li
                        key={meal.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                    >
                        <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                                {meal.items.map((item) => item.foodName).join(', ')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {new Date(meal.loggedAt).toLocaleTimeString(undefined, {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                })}
                            </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                            <SourceBadge source={meal.source} />
                            <span className="whitespace-nowrap text-right font-mono text-sm font-semibold tabular-nums text-foreground">
                                {meal.totalCalories} kcal
                            </span>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}

// Per-day hydration kept in localStorage: a single integer of half-glasses.
// No backend field exists for it and the dashboard is the only consumer, so a
// tiny client-side tile beats introducing an API schema for it.
// ponytail: single global key, per-day reset handled by stamping the day
// string alongside — split keys per day if multi-day history is ever wanted.
function WaterCard() {
    const dayKey = localDateKey(new Date());
    const read = (): { day: string; glasses: number } => {
        try {
            const raw = localStorage.getItem(WATER_KEY);
            return raw ? (JSON.parse(raw) as { day: string; glasses: number }) : { day: dayKey, glasses: 0 };
        } catch {
            return { day: dayKey, glasses: 0 };
        }
    };
    const [state, setState] = useState(read);

    const setGlasses = (glasses: number) => {
        const next = { day: dayKey, glasses: Math.max(0, Math.min(16, glasses)) };
        localStorage.setItem(WATER_KEY, JSON.stringify(next));
        setState(next);
    };

    // A new day resets the count without any user action.
    const glasses = state.day === dayKey ? state.glasses : 0;

    return (
        <Card>
            <CardContent className="flex items-center justify-between gap-4 pt-6">
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-fat/15 text-chart-fat">
                        <GlassWater size={20} strokeWidth={2} />
                    </span>
                    <div>
                        <p className="text-sm font-medium text-foreground">Water</p>
                        <p className="font-mono text-sm tabular-nums text-muted-foreground">
                            {glasses} / 8 glasses
                        </p>
                    </div>
                </div>
                <div className="flex gap-1">
                    <Button variant="outline" size="sm" aria-label="Remove glass"
                        onClick={() => setGlasses(glasses - 1)}>
                        −
                    </Button>
                    <Button variant="outline" size="sm" aria-label="Add glass"
                        onClick={() => setGlasses(glasses + 1)}>
                        +
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
