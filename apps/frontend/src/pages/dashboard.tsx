import { useMemo } from 'react';
import { Beef, Droplet, Flame, Wheat } from 'lucide-react';
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
                    <h1 className="font-display text-2xl font-semibold text-foreground">
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

            {isLoading && (
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
                    <div className="flex flex-col gap-2">
                        <Skeleton className="mb-1 h-5 w-32" />
                        <Skeleton className="h-14 w-full rounded-xl" />
                        <Skeleton className="h-14 w-full rounded-xl" />
                    </div>
                </>
            )}

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
                <div>
                    <h2 className="mb-3 font-display text-lg font-semibold text-foreground">
                        Today's meals
                    </h2>
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
                        <ul className="flex flex-col gap-2">
                            {todaysMeals.map((meal) => (
                                <li
                                    key={meal.id}
                                    className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
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
                    )}
                </div>
            )}
        </div>
    );
}
