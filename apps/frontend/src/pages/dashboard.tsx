import { useMemo, useState, useEffect } from 'react';
import { Beef, Droplet, Flame, Plus, Salad, Trash2, Wheat } from 'lucide-react';
import { Link } from 'react-router';
import EmptyState from '@/components/ui/empty-state';
import {
    Area,
    AreaChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { CalorieRing } from '@/components/dashboard/calorie-ring';
import { MacroBar } from '@/components/dashboard/macro-bar';
import { SourceBadge } from '@/components/dashboard/source-badge';
import { WaterCard } from '@/components/dashboard/water-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useActiveDietPlan } from '@/hooks/use-active-diet-plan';
import { useDeleteMealLog, useMealLogs } from '@/hooks/use-meal-logs';
import { computeStreak, formatShortDate, isToday, lastNDays, localDateKey } from '@/lib/date-utils';
import type { MealLog } from '@/types/api';

const WATER_KEY = 'nutrilens.water';

// Guarded because this runs at MODULE scope: a corrupt or hand-edited
// nutrilens.water value (another tab, an extension, a half-written write) threw
// out of JSON.parse before the component ever mounted, which white-screens the
// whole dashboard with no error boundary above it. localStorage is
// user-writable, so a non-numeric `glasses` is a shape to handle, not an
// impossible state — same treatment as lib/shop-memory.ts.
function readStoredWaterGlasses(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(WATER_KEY);
    if (!raw) return 0;
    const parsed: unknown = JSON.parse(raw);
    const glasses = (parsed as { glasses?: unknown } | null)?.glasses;
    if (typeof glasses !== 'number' || !Number.isFinite(glasses)) return 0;
    return Math.max(0, Math.min(8, glasses));
  } catch {
    return 0;
  }
}

const initialWaterGlasses = readStoredWaterGlasses();

// Same 7-day rolling window the progress page uses, so the dashboard's "This
// week" sparkline and the progress trends tell exactly the same story.
const WEEK_DAYS = 7;

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
    const deleteMeal = useDeleteMealLog();

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

    // Zero-filled window over the last seven days, oldest first — gap days
    // count as 0 so the sparkline stays anchored to the full week.
    const weekTrend = useMemo(() => {
        const days = lastNDays(WEEK_DAYS);
        const totalsByDay = new Map(days.map((day) => [day, 0]));
        for (const log of mealLogs.data ?? []) {
            const key = localDateKey(new Date(log.loggedAt));
            if (totalsByDay.has(key)) {
                totalsByDay.set(key, (totalsByDay.get(key) ?? 0) + log.totalCalories);
            }
        }
        return days.map((day) => ({
            day,
            label: formatShortDate(day),
            calories: totalsByDay.get(day) ?? 0,
        }));
    }, [mealLogs.data]);

    const isLoading = dietPlan.isLoading || mealLogs.isLoading;
    const isError = dietPlan.isError || mealLogs.isError;

    const [waterGlasses, setWaterGlasses] = useState(() => initialWaterGlasses);

    const addGlass = () => setWaterGlasses(prev => Math.min(prev + 1, 8));
    const removeGlass = () => setWaterGlasses(prev => Math.max(prev - 1, 0));

    // Persist to localStorage on every change
    useEffect(() => {
        localStorage.setItem(WATER_KEY, JSON.stringify({ day: localDateKey(new Date()), glasses: waterGlasses }));
    }, [waterGlasses, WATER_KEY]);

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

            {/* One skeleton mirroring the headline ring card while either
                query is in flight; the real cards below render only once
                both have data, so no skeleton ever shares the page with
                content. */}
            {isLoading && !isError && (
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
                <div className="grid gap-6 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader className="flex-row items-start justify-between gap-4">
                            <div>
                                <CardTitle>Today's intake</CardTitle>
                                <CardDescription>
                                    {new Date().toLocaleDateString(undefined, {
                                        weekday: 'long',
                                        month: 'long',
                                        day: 'numeric',
                                    })}
                                    {' · '}
                                    {todaysMeals.length}{' '}
                                    {todaysMeals.length === 1 ? 'meal' : 'meals'}
                                </CardDescription>
                            </div>
                            <p className="font-mono text-sm tabular-nums text-muted-foreground">
                                <span className="font-semibold text-foreground">
                                    {totals.calories.toLocaleString()}
                                </span>{' '}
                                / {dietPlan.data.dailyCalorieTarget.toLocaleString()} kcal
                            </p>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center gap-6 sm:flex-row sm:items-stretch">
                            <div className="flex shrink-0 items-center justify-center sm:border-r sm:border-border sm:pr-6">
                                <CalorieRing
                                    consumed={totals.calories}
                                    target={dietPlan.data.dailyCalorieTarget}
                                />
                            </div>
                            <div className="flex-1 space-y-4">
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
                        </CardContent>
                    </Card>

                    <div className="flex flex-col gap-6">
                        <WeekSummary
                            trend={weekTrend}
                            target={dietPlan.data.dailyCalorieTarget}
                            hasAnyLogs={(mealLogs.data?.length ?? 0) > 0}
                        />
                        <WaterCard
                            glasses={waterGlasses}
                            onAdd={addGlass}
                            onRemove={removeGlass}
                            target={8}
                        />
                    </div>
                </div>
            )}

            {!isLoading && !isError && (
                <section aria-labelledby="today-meals-heading">
                    <div className="mb-3 flex items-center justify-between">
                        <div>
                            <h2
                                id="today-meals-heading"
                                className="font-display text-lg font-bold text-foreground"
                            >
                                Today's meals
                            </h2>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                                {todaysMeals.length === 0
                                    ? 'Nothing logged yet today.'
                                    : `${todaysMeals.length} ${
                                          todaysMeals.length === 1 ? 'meal' : 'meals'
                                      }, ${totals.calories.toLocaleString()} kcal total`}
                            </p>
                        </div>
                        <Button asChild variant="outline" size="sm" className="gap-1.5">
                            <Link to="/log-meal">
                                <Plus size={16} strokeWidth={2} />
                                Add meal
                            </Link>
                        </Button>
                    </div>

                    {todaysMeals.length === 0 && (
                        <EmptyState
                            icon={Salad}
                            title="Nothing logged yet today."
                            description="Log your first meal — a photo, a barcode scan or a quick manual entry — and your calories and macros start filling in."
                            action={{ label: "Log your first meal", href: "/log-meal" }}
                            variant="illustrated"
                        />
                    )}

                    {todaysMeals.length > 0 && (
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
                                    <MealSection
                                        key={type}
                                        type={type}
                                        meals={meals}
                                        kcal={kcal}
                                        onDelete={(id) => deleteMeal.mutate(id)}
                                        deletePending={deleteMeal.isPending}
                                    />
                                );
                            })}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}

function MealSection({
    type,
    meals,
    kcal,
    onDelete,
    deletePending,
}: {
    type: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks';
    meals: MealLog[];
    kcal: number;
    onDelete: (id: string) => void;
    deletePending: boolean;
}) {
    return (
        <section aria-label={`${type} meals`}>
            <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-foreground">{type}</h3>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {kcal} kcal
                </span>
            </div>
            <ul className="flex flex-col gap-2">
                {meals.map((meal) => {
                    const names = meal.items.map((item) => item.foodName).join(', ');
                    return (
                        <li
                            key={meal.id}
                            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-foreground">{names}</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    <span>
                                        {new Date(meal.loggedAt).toLocaleTimeString(undefined, {
                                            hour: 'numeric',
                                            minute: '2-digit',
                                        })}
                                    </span>
                                    <span className="hidden sm:inline">
                                        {' · '}P {Math.round(meal.proteinGrams)}g · C{' '}
                                        {Math.round(meal.carbGrams)}g · F{' '}
                                        {Math.round(meal.fatGrams)}g
                                    </span>
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                                <SourceBadge source={meal.source} />
                                <span className="whitespace-nowrap text-right font-mono text-sm font-semibold tabular-nums text-foreground">
                                    {meal.totalCalories} kcal
                                </span>
                                <DeleteMealButton
                                    mealId={meal.id}
                                    onDelete={onDelete}
                                    disabled={deletePending}
                                />
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

// Deletion is two clicks on purpose: the only page that lists a meal is the
// dashboard, and there is no undo on the API, so a single stray tap on the
// trash would be permanent. "Delete?" + "Cancel" keeps that from happening
// without adding a modal.
function DeleteMealButton({
    mealId,
    onDelete,
    disabled,
}: {
    mealId: string;
    onDelete: (id: string) => void;
    disabled: boolean;
}) {
    const [confirming, setConfirming] = useState(false);

    if (confirming) {
        return (
            <div className="flex items-center gap-1">
                <Button
                    variant="destructive"
                    size="sm"
                    className="px-2 text-xs"
                    disabled={disabled}
                    onClick={() => {
                        onDelete(mealId);
                        setConfirming(false);
                    }}
                >
                    Delete?
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="px-2 text-xs"
                    onClick={() => setConfirming(false)}
                >
                    Cancel
                </Button>
            </div>
        );
    }

    return (
        <Button
            variant="ghost"
            size="icon"
            aria-label="Delete meal"
            title="Delete meal"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setConfirming(true)}
        >
            <Trash2 size={16} strokeWidth={2} />
        </Button>
    );
}

// Compact "This week" sparkline: shared window helpers from date-utils so the
// numbers line up with the progress page, an accent area line with a dashed
// target reference, and two plain-stat readouts below. Chart text and ink
// stay on foreground/muted tokens; only the mark carries the accent color.
function WeekSummary({
    trend,
    target,
    hasAnyLogs,
}: {
    trend: { label: string; calories: number }[];
    target: number;
    hasAnyLogs: boolean;
}) {
    const total = trend.reduce((sum, day) => sum + day.calories, 0);
    const loggedDays = trend.filter((day) => day.calories > 0).length;

    // Keeps the target reference line on-screen even on a day far under it —
    // otherwise the axis auto-scales to the data alone and renders off-range.
    const axisMax = useMemo(() => {
        const dataMax = Math.max(0, ...trend.map((d) => d.calories));
        return Math.ceil((Math.max(dataMax, target) * 1.1) / 100) * 100;
    }, [trend, target]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>This week</CardTitle>
                <CardDescription>Daily calories against your target</CardDescription>
            </CardHeader>
            <CardContent>
                {!hasAnyLogs ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                        No meals logged yet — your trend will show up here once you log some.
                    </p>
                ) : (
                    <div className="h-32 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={trend}
                                margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
                            >
                                <defs>
                                    <linearGradient id="dashWeekArea" x1="0" y1="0" x2="0" y2="1">
                                        <stop
                                            offset="0%"
                                            stopColor="var(--accent)"
                                            stopOpacity={0.3}
                                        />
                                        <stop
                                            offset="100%"
                                            stopColor="var(--accent)"
                                            stopOpacity={0}
                                        />
                                    </linearGradient>
                                </defs>
                                <YAxis hide domain={[0, axisMax]} />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                                    tickLine={false}
                                    axisLine={{ stroke: 'var(--border)' }}
                                    interval={0}
                                />
                                <ReferenceLine
                                    y={target}
                                    stroke="var(--muted-foreground)"
                                    strokeDasharray="4 4"
                                    strokeOpacity={0.6}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: 'var(--card)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius)',
                                        fontSize: 12,
                                    }}
                                    formatter={(value) => [`${String(value)} kcal`, 'Calories']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="calories"
                                    stroke="var(--accent)"
                                    strokeWidth={2}
                                    fill="url(#dashWeekArea)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
                <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground">
                            {WEEK_DAYS}-day total
                        </p>
                        <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-foreground">
                            {total.toLocaleString()}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-medium text-muted-foreground">Days logged</p>
                        <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-foreground">
                            {loggedDays} / {WEEK_DAYS}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// Per-day hydration kept in localStorage: a single integer of glasses. No
// backend field exists for it and the dashboard is the only consumer, so a
// tiny client-side tile beats introducing an API schema for it.
// ponytail: single global key, per-day reset handled by stamping the day
// string alongside — split keys per day if multi-day history is ever wanted.
