import { useMemo, useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import {
    AlertCircle,
    Beef,
    Droplet,
    Minus,
    Scale,
    TrendingDown,
    TrendingUp,
    UtensilsCrossed,
    Wheat,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useActiveDietPlan } from '@/hooks/use-active-diet-plan';
import { useMealLogs } from '@/hooks/use-meal-logs';
import { useCreateWeightEntry, useWeightEntries } from '@/hooks/use-weight-entries';
import { ApiError } from '@/lib/api-client';
import { formatShortDate, lastNDays, localDateKey } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

type RangeValue = 'week' | 'month' | 'all';

const RANGE_OPTIONS: { value: RangeValue; label: string }[] = [
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'all', label: 'All time' },
];

// No server-side date-range query exists on either hook (both fetch full
// history in one shot — see use-meal-logs.ts / use-weight-entries.ts), so
// "all time" buckets calories/macros against a bounded window instead of an
// actually-unbounded one; a multi-year account would otherwise render
// thousands of empty day-buckets for no benefit.
// ponytail: fixed cap, revisit with server-side date-range querying if a
// real account's history ever meaningfully exceeds it.
const ALL_TIME_WINDOW_DAYS = 90;

const RANGE_DAYS: Record<RangeValue, number> = {
    week: 7,
    month: 30,
    all: ALL_TIME_WINDOW_DAYS,
};

const RANGE_WINDOW_LABEL: Record<Exclude<RangeValue, 'all'>, string> = {
    week: 'past 7 days',
    month: 'past 30 days',
};

export default function ProgressPage() {
    const dietPlan = useActiveDietPlan();
    const mealLogs = useMealLogs();
    const weightEntries = useWeightEntries();
    const [range, setRange] = useState<RangeValue>('week');
    const rangeDays = RANGE_DAYS[range];

    const calorieTrend = useMemo(() => {
        const days = lastNDays(rangeDays);
        const totals = new Map(days.map((day) => [day, 0]));
        for (const log of mealLogs.data ?? []) {
            const key = localDateKey(new Date(log.loggedAt));
            if (totals.has(key)) totals.set(key, (totals.get(key) ?? 0) + log.totalCalories);
        }
        return days.map((day) => ({
            day,
            label: formatShortDate(day),
            calories: totals.get(day) ?? 0,
        }));
    }, [mealLogs.data, rangeDays]);

    // Keeps the target reference line on-screen even on a day far under it —
    // otherwise the axis auto-scales to the data alone and renders off-range.
    const calorieAxisMax = useMemo(() => {
        const dataMax = Math.max(0, ...calorieTrend.map((d) => d.calories));
        const target = dietPlan.data?.dailyCalorieTarget ?? 0;
        return Math.ceil((Math.max(dataMax, target) * 1.1) / 100) * 100;
    }, [calorieTrend, dietPlan.data]);

    const avgCalories = useMemo(() => {
        if (calorieTrend.length === 0) return 0;
        return Math.round(
            calorieTrend.reduce((sum, d) => sum + d.calories, 0) / calorieTrend.length,
        );
    }, [calorieTrend]);

    const macroTrend = useMemo(() => {
        const days = lastNDays(rangeDays);
        const totals = new Map(days.map((day) => [day, { protein: 0, carb: 0, fat: 0 }]));
        for (const log of mealLogs.data ?? []) {
            const key = localDateKey(new Date(log.loggedAt));
            const bucket = totals.get(key);
            if (!bucket) continue;
            bucket.protein += log.proteinGrams;
            bucket.carb += log.carbGrams;
            bucket.fat += log.fatGrams;
        }
        return days.map((day) => ({ day, label: formatShortDate(day), ...totals.get(day)! }));
    }, [mealLogs.data, rangeDays]);

    const avgMacros = useMemo(() => {
        const n = macroTrend.length || 1;
        return {
            protein: macroTrend.reduce((sum, d) => sum + d.protein, 0) / n,
            carb: macroTrend.reduce((sum, d) => sum + d.carb, 0) / n,
            fat: macroTrend.reduce((sum, d) => sum + d.fat, 0) / n,
        };
    }, [macroTrend]);

    const weightTrendAll = useMemo(() => {
        return [...(weightEntries.data ?? [])]
            .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
            .map((entry) => ({
                date: entry.recordedAt,
                label: formatShortDate(localDateKey(new Date(entry.recordedAt))),
                kg: entry.weightKg,
            }));
    }, [weightEntries.data]);

    // "all" already covers the full history, so filtering it again would be
    // a no-op that only costs a second array pass.
    const weightTrend = useMemo(() => {
        if (range === 'all') return weightTrendAll;
        const cutoff = Date.now() - rangeDays * 86_400_000;
        return weightTrendAll.filter((entry) => new Date(entry.date).getTime() >= cutoff);
    }, [weightTrendAll, range, rangeDays]);

    const isLoading = dietPlan.isLoading || mealLogs.isLoading || weightEntries.isLoading;
    const isError = mealLogs.isError || weightEntries.isError;

    const retry = () => {
        void mealLogs.refetch();
        void weightEntries.refetch();
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="font-display text-2xl font-bold text-foreground">Progress</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Weight and calorie trend history.
                    </p>
                </div>
                <RangeToggle value={range} onChange={setRange} />
            </div>

            {isLoading && (
                <>
                    <ChartCardSkeleton titleWidth="w-20" />
                    <ChartCardSkeleton titleWidth="w-16" hasForm />
                    <ChartCardSkeleton titleWidth="w-16" />
                </>
            )}

            {!isLoading && isError && (
                <Card>
                    <CardContent className="pt-6">
                        <EmptyState
                            icon={AlertCircle}
                            title="Couldn't load your progress"
                            description="Something went wrong loading your data. Check your connection and try again."
                            action={{ label: 'Retry', onClick: retry }}
                            headingLevel={2}
                        />
                    </CardContent>
                </Card>
            )}

            {!isLoading && !isError && (
                <>
                    <CaloriesCard
                        calorieTrend={calorieTrend}
                        calorieAxisMax={calorieAxisMax}
                        avgCalories={avgCalories}
                        target={dietPlan.data?.dailyCalorieTarget ?? null}
                        hasAnyLogs={(mealLogs.data?.length ?? 0) > 0}
                    />
                    <WeightCard weightTrend={weightTrend} weightTrendAll={weightTrendAll} range={range} />
                    {(mealLogs.data?.length ?? 0) > 0 && (
                        <MacrosCard macroTrend={macroTrend} avgMacros={avgMacros} />
                    )}
                </>
            )}
        </div>
    );
}

function RangeToggle({
    value,
    onChange,
}: {
    value: RangeValue;
    onChange: (value: RangeValue) => void;
}) {
    return (
        <div
            role="group"
            aria-label="Time range"
            className="inline-flex w-fit gap-1 rounded-full border border-border bg-card p-1"
        >
            {RANGE_OPTIONS.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    aria-pressed={value === option.value}
                    onClick={() => {
                        onChange(option.value);
                    }}
                    className={cn(
                        'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                        value === option.value
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

function ChartCardSkeleton({ titleWidth, hasForm = false }: { titleWidth: string; hasForm?: boolean }) {
    return (
        <Card>
            <CardHeader>
                <Skeleton className={cn('h-5', titleWidth)} />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-56 w-full rounded-lg" />
                {hasForm && (
                    <div className="flex flex-col gap-2 border-t border-border pt-4">
                        <Skeleton className="h-3 w-32" />
                        <div className="flex gap-2">
                            <Skeleton className="h-11 w-32 rounded-md" />
                            <Skeleton className="h-11 w-24 rounded-md" />
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function CaloriesCard({
    calorieTrend,
    calorieAxisMax,
    avgCalories,
    target,
    hasAnyLogs,
}: {
    calorieTrend: { day: string; label: string; calories: number }[];
    calorieAxisMax: number;
    avgCalories: number;
    target: number | null;
    hasAnyLogs: boolean;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Calories</CardTitle>
            </CardHeader>
            <CardContent>
                {!hasAnyLogs ? (
                    <EmptyState
                        icon={UtensilsCrossed}
                        title="No meals logged yet"
                        description="Log a meal and your calorie trend will show up here."
                        action={{ label: 'Log a meal', href: '/log-meal' }}
                        headingLevel={4}
                    />
                ) : (
                    <div className="flex flex-col gap-4">
                        <div>
                            <div className="flex items-baseline gap-2">
                                <span className="font-display text-4xl font-semibold tabular-nums text-foreground">
                                    {avgCalories.toLocaleString()}
                                </span>
                                <span className="text-sm text-muted-foreground">kcal/day avg</span>
                            </div>
                            {target !== null && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Target {target.toLocaleString()} kcal/day
                                </p>
                            )}
                        </div>
                        <div className="h-56 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={calorieTrend}
                                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                                >
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="var(--border)"
                                        vertical={false}
                                    />
                                    <XAxis
                                        dataKey="label"
                                        tick={{
                                            fontSize: 12,
                                            fill: 'var(--muted-foreground)',
                                        }}
                                        tickLine={false}
                                        axisLine={{ stroke: 'var(--border)' }}
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis
                                        domain={[0, calorieAxisMax]}
                                        tick={{
                                            fontSize: 12,
                                            fill: 'var(--muted-foreground)',
                                        }}
                                        tickLine={false}
                                        axisLine={false}
                                        width={56}
                                    />
                                    {target !== null && (
                                        <ReferenceLine
                                            y={target}
                                            stroke="var(--muted-foreground)"
                                            strokeDasharray="4 4"
                                            label={{
                                                value: 'Target',
                                                position: 'insideTopRight',
                                                fontSize: 11,
                                                fill: 'var(--muted-foreground)',
                                            }}
                                        />
                                    )}
                                    <Tooltip
                                        contentStyle={{
                                            background: 'var(--card)',
                                            border: '1px solid var(--border)',
                                            borderRadius: 'var(--radius)',
                                            fontSize: 12,
                                        }}
                                        formatter={(value) => [
                                            `${String(value)} kcal`,
                                            'Calories',
                                        ]}
                                    />
                                    <Bar
                                        dataKey="calories"
                                        fill="var(--chart-calorie)"
                                        radius={[4, 4, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function WeightDelta({ delta }: { delta: number }) {
    // A flat colour would fail for colour-blind users on its own — the
    // arrow direction and the +/- sign are the real signal, colour is only
    // an accent on top of them.
    if (Math.abs(delta) < 0.05) {
        return (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
                <Minus size={14} strokeWidth={2.5} aria-hidden="true" />
                No change
            </span>
        );
    }
    const Icon = delta > 0 ? TrendingUp : TrendingDown;
    return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground">
            <Icon size={14} strokeWidth={2.5} className="text-accent" aria-hidden="true" />
            {delta > 0 ? '+' : ''}
            {delta.toFixed(1)} kg
        </span>
    );
}

function WeightCard({
    weightTrend,
    weightTrendAll,
    range,
}: {
    weightTrend: { date: string; label: string; kg: number }[];
    weightTrendAll: { date: string; label: string; kg: number }[];
    range: RangeValue;
}) {
    const hasAnyWeight = weightTrendAll.length > 0;
    const delta =
        weightTrend.length >= 2 ? weightTrend[weightTrend.length - 1].kg - weightTrend[0].kg : null;
    const latest = weightTrendAll[weightTrendAll.length - 1];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Weight</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {!hasAnyWeight ? (
                    <EmptyState
                        icon={Scale}
                        title="No weigh-ins yet"
                        description="Log your first weigh-in below to start a trend."
                        headingLevel={4}
                    />
                ) : weightTrend.length === 0 ? (
                    // Real data exists, just not inside the selected window — this
                    // must never read as "you have no data" (see the empty-states
                    // rule against implying that on a filtered view).
                    <p className="py-2 text-sm text-muted-foreground">
                        No weigh-ins in the {RANGE_WINDOW_LABEL[range as Exclude<RangeValue, 'all'>]}.
                        Your last one was{' '}
                        <span className="font-medium text-foreground">{latest.kg} kg</span> on{' '}
                        {latest.label}.
                    </p>
                ) : weightTrend.length === 1 ? (
                    <p className="py-2 text-sm text-muted-foreground">
                        <span className="font-display text-2xl font-semibold tabular-nums text-foreground">
                            {weightTrend[0].kg} kg
                        </span>{' '}
                        logged on {weightTrend[0].label} — one more weigh-in will start a trend
                        line.
                    </p>
                ) : (
                    <>
                        <div>
                            <div className="flex items-baseline gap-3">
                                <span className="font-display text-4xl font-semibold tabular-nums text-foreground">
                                    {weightTrend[weightTrend.length - 1].kg.toFixed(1)} kg
                                </span>
                                {delta !== null && <WeightDelta delta={delta} />}
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Since {weightTrend[0].label}
                            </p>
                        </div>
                        <div className="h-56 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={weightTrend}
                                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                                >
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="var(--border)"
                                        vertical={false}
                                    />
                                    <XAxis
                                        dataKey="label"
                                        tick={{
                                            fontSize: 12,
                                            fill: 'var(--muted-foreground)',
                                        }}
                                        tickLine={false}
                                        axisLine={{ stroke: 'var(--border)' }}
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis
                                        domain={['dataMin - 1', 'dataMax + 1']}
                                        tickFormatter={(value: number) => value.toFixed(1)}
                                        tick={{
                                            fontSize: 12,
                                            fill: 'var(--muted-foreground)',
                                        }}
                                        tickLine={false}
                                        axisLine={false}
                                        width={56}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            background: 'var(--card)',
                                            border: '1px solid var(--border)',
                                            borderRadius: 'var(--radius)',
                                            fontSize: 12,
                                        }}
                                        formatter={(value) => [
                                            `${String(value)} kg`,
                                            'Weight',
                                        ]}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="kg"
                                        stroke="var(--accent)"
                                        strokeWidth={2}
                                        dot={{ r: 3, fill: 'var(--accent)' }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </>
                )}

                <LogWeightForm />
            </CardContent>
        </Card>
    );
}

function MacroStat({
    icon: Icon,
    label,
    grams,
    wrapClassName,
}: {
    icon: LucideIcon;
    label: string;
    grams: number;
    wrapClassName: string;
}) {
    return (
        <div className="flex items-center gap-2">
            <span
                className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                    wrapClassName,
                )}
            >
                <Icon size={16} strokeWidth={2} />
            </span>
            <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {label}
                </p>
                <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                    {Math.round(grams)}
                    <span className="font-normal text-muted-foreground">g/day</span>
                </p>
            </div>
        </div>
    );
}

function MacrosCard({
    macroTrend,
    avgMacros,
}: {
    macroTrend: { day: string; label: string; protein: number; carb: number; fat: number }[];
    avgMacros: { protein: number; carb: number; fat: number };
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Macros</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-4">
                    <MacroStat
                        icon={Beef}
                        label="Protein"
                        grams={avgMacros.protein}
                        wrapClassName="bg-chart-protein/15 text-chart-protein"
                    />
                    <MacroStat
                        icon={Wheat}
                        label="Carbs"
                        grams={avgMacros.carb}
                        wrapClassName="bg-chart-carb/15 text-chart-carb"
                    />
                    <MacroStat
                        icon={Droplet}
                        label="Fat"
                        grams={avgMacros.fat}
                        wrapClassName="bg-chart-fat/15 text-chart-fat"
                    />
                </div>
                <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={macroTrend}
                            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                        >
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="var(--border)"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="label"
                                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                                tickLine={false}
                                axisLine={{ stroke: 'var(--border)' }}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                                tickLine={false}
                                axisLine={false}
                                width={40}
                                tickFormatter={(value: number) => `${String(value)}g`}
                            />
                            <Tooltip
                                contentStyle={{
                                    background: 'var(--card)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius)',
                                    fontSize: 12,
                                }}
                                formatter={(value, name) => [`${String(value)}g`, name]}
                            />
                            {/* Legend text is the colour-blind-safe second channel —
                                three stacked hues alone would be ambiguous. */}
                            <Legend
                                wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }}
                                iconType="circle"
                            />
                            <Bar
                                dataKey="protein"
                                name="Protein"
                                stackId="macros"
                                fill="var(--chart-protein)"
                            />
                            <Bar
                                dataKey="carb"
                                name="Carbs"
                                stackId="macros"
                                fill="var(--chart-carb)"
                            />
                            <Bar
                                dataKey="fat"
                                name="Fat"
                                stackId="macros"
                                fill="var(--chart-fat)"
                                radius={[4, 4, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}

function LogWeightForm() {
    const createWeightEntry = useCreateWeightEntry();
    const [weight, setWeight] = useState('');
    const [error, setError] = useState<string | null>(null);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const weightKg = Number(weight);
        if (!Number.isFinite(weightKg) || weightKg <= 0) {
            setError('Enter a weight greater than 0.');
            return;
        }
        try {
            await createWeightEntry.mutateAsync({ weightKg, overwrite: true });
            setWeight('');
        } catch (error) {
            const fallback = 'Something went wrong logging your weight. Please try again.';
            if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
                setError(error.body?.message || fallback);
            } else {
                setError(fallback);
            }
        }
    };

    return (
        <form
            onSubmit={(e) => void onSubmit(e)}
            className="flex flex-col gap-2 border-t border-border pt-4"
        >
            <Label htmlFor="weightKg" className="flex items-center gap-1.5">
                <Scale size={14} strokeWidth={2} className="text-muted-foreground" />
                Log today's weight
            </Label>
            <div className="flex gap-2">
                <Input
                    id="weightKg"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    placeholder="kg"
                    aria-invalid={!!error}
                    aria-describedby={error ? 'weightKg-error' : undefined}
                    value={weight}
                    onChange={(e) => {
                        setWeight(e.target.value);
                    }}
                    className="max-w-32"
                />
                <Button
                    type="submit"
                    variant="outline"
                    disabled={createWeightEntry.isPending || !weight}
                >
                    {createWeightEntry.isPending ? 'Saving…' : 'Log weight'}
                </Button>
            </div>
            {error && (
                <p id="weightKg-error" role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}
        </form>
    );
}
