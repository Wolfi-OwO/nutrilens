import { useMemo, useState } from 'react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import {
    AlertCircle,
    Minus,
    Scale,
    TrendingDown,
    TrendingUp,
    UtensilsCrossed,
} from 'lucide-react';
import { FormattedMessage, FormattedNumber, useIntl } from 'react-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EdgeTick } from '@/components/ui/chart-ticks';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useActiveDietPlan } from '@/hooks/use-active-diet-plan';
import { useMealLogs } from '@/hooks/use-meal-logs';
import { useCreateWeightEntry, useWeightEntries } from '@/hooks/use-weight-entries';
import { ApiError } from '@/lib/api-client';
import { formatShortDate, lastNDays, localDateKey } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

type RangeValue = 'week' | 'month' | 'all';

const RANGE_OPTIONS: RangeValue[] = ['week', 'month', 'all'];

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

const RANGE_WINDOW_MESSAGE: Record<Exclude<RangeValue, 'all'>, string> = {
    week: 'progress.window.week',
    month: 'progress.window.month',
};

export default function ProgressPage() {
    const intl = useIntl();
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
            label: formatShortDate(day, intl.locale),
            calories: totals.get(day) ?? 0,
        }));
    }, [mealLogs.data, rangeDays, intl.locale]);

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
        return days.map((day) => ({
            day,
            label: formatShortDate(day, intl.locale),
            ...totals.get(day)!,
        }));
    }, [mealLogs.data, rangeDays, intl.locale]);

    const weightTrendAll = useMemo(() => {
        return [...(weightEntries.data ?? [])]
            .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
            .map((entry) => ({
                date: entry.recordedAt,
                label: formatShortDate(localDateKey(new Date(entry.recordedAt)), intl.locale),
                kg: entry.weightKg,
            }));
    }, [weightEntries.data, intl.locale]);

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
                    <h1 className="font-display text-2xl font-bold text-foreground">
                        <FormattedMessage id="progress.title" />
                    </h1>
                    <p className="mt-1 text-base text-muted-foreground">
                        <FormattedMessage id="progress.subtitle" />
                    </p>
                </div>
                <RangeToggle value={range} onChange={setRange} />
            </div>

            {isLoading && (
                <div className="flex flex-col gap-5">
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                        <ChartCardSkeleton className="lg:col-span-8" hasForm />
                        <ChartCardSkeleton className="lg:col-span-4" />
                    </div>
                    <ChartCardSkeleton className="h-64" />
                </div>
            )}

            {!isLoading && isError && (
                <Card>
                    <CardContent className="pt-6">
                        <EmptyState
                            icon={AlertCircle}
                            title={intl.formatMessage({ id: 'progress.loadErrorTitle' })}
                            description={intl.formatMessage({ id: 'progress.loadErrorBody' })}
                            action={{
                                label: intl.formatMessage({ id: 'common.retry' }),
                                onClick: retry,
                            }}
                            headingLevel={2}
                        />
                    </CardContent>
                </Card>
            )}

            {!isLoading && !isError && (
                <>
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                        <WeightCard weightTrend={weightTrend} weightTrendAll={weightTrendAll} range={range} />
                        <CaloriesCard
                            calorieTrend={calorieTrend}
                            calorieAxisMax={calorieAxisMax}
                            avgCalories={avgCalories}
                            target={dietPlan.data?.dailyCalorieTarget ?? null}
                            hasAnyLogs={(mealLogs.data?.length ?? 0) > 0}
                        />
                    </div>
                    {(mealLogs.data?.length ?? 0) > 0 && (
                        <MacroTable macroTrend={macroTrend} dietPlan={dietPlan.data ?? null} />
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
    const intl = useIntl();
    return (
        <div
            role="group"
            aria-label={intl.formatMessage({ id: 'progress.range' })}
            className="inline-flex w-fit gap-1 rounded-full border border-border bg-card p-1"
        >
            {RANGE_OPTIONS.map((option) => (
                <button
                    key={option}
                    type="button"
                    aria-pressed={value === option}
                    onClick={() => {
                        onChange(option);
                    }}
                    className={cn(
                        'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                        value === option
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                >
                    <FormattedMessage id={`progress.range.${option}`} />
                </button>
            ))}
        </div>
    );
}

function ChartCardSkeleton({ className, hasForm = false }: { className?: string; hasForm?: boolean }) {
    return (
        <Card className={className}>
            <CardHeader>
                <Skeleton className="h-5 w-20" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-40 w-full rounded-lg" />
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

// Secondary tile (span-4): average calories against target. The weight
// card carries the page's primary treatment, so this stays a smaller chart
// with a smaller numeral — deliberately not the same weight as before.
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
    const intl = useIntl();
    return (
        <Card className="lg:col-span-4">
            <CardHeader>
                <CardTitle>
                    <FormattedMessage id="progress.calories" />
                </CardTitle>
            </CardHeader>
            <CardContent>
                {!hasAnyLogs ? (
                    <EmptyState
                        icon={UtensilsCrossed}
                        title={intl.formatMessage({ id: 'progress.noMealsTitle' })}
                        description={intl.formatMessage({ id: 'progress.noMealsBody' })}
                        action={{
                            label: intl.formatMessage({ id: 'progress.logAMeal' }),
                            href: '/log-meal',
                        }}
                        headingLevel={4}
                        testId="progress-meals-empty"
                    />
                ) : (
                    <div className="flex flex-col gap-4">
                        <div>
                            <div className="flex items-baseline gap-2">
                                <span className="font-display text-3xl font-semibold tabular-nums text-foreground">
                                    <FormattedNumber value={avgCalories} />
                                </span>
                                <span className="text-sm text-muted-foreground">
                                    <FormattedMessage id="progress.avgPerDay" />
                                </span>
                            </div>
                            {target !== null && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                    <FormattedMessage
                                        id="progress.targetPerDay"
                                        values={{ target }}
                                    />
                                </p>
                            )}
                        </div>
                        <div className="h-40 w-full">
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
                                            fontSize: 11,
                                            fill: 'var(--muted-foreground)',
                                            fontFamily: 'var(--font-sans)',
                                        }}
                                        tickLine={false}
                                        axisLine={{ stroke: 'var(--border)' }}
                                        interval="preserveStartEnd"
                                    />
                                    {/* The tick used to append "kcal" to every
                                        value, and that one decision caused two
                                        defects that only showed up in a browser.
                                        Measured, both:

                                        1. recharts renders a default tick through
                                           its own <Text>, which re-measures the
                                           string in a hidden span. That span does
                                           not inherit the SVG's DM Sans, so its
                                           widths disagree with the rendered glyphs
                                           — at width={44} and width={64} it wrapped
                                           "2.200 kcal", "1.100 kcal" and "550 kcal"
                                           onto two lines but left "1.650 kcal"
                                           alone. Rendered widths are 53/50/47/45/31
                                           px, so that order is not monotonic in the
                                           real font and no axis width fixes it.
                                        2. Replacing the tick with a plain <text>
                                           (chart-ticks.tsx) stopped the wrapping but
                                           made recharts emit a NON-UNIFORM axis:
                                           0 / 550 / 1.100 / 2.200, with the 1.650
                                           tick dropped. Unequal gridline spacing on
                                           a bar chart misstates the data, which is
                                           worse than the wrap it cured.

                                        Bare numerals are the actual fix: ~35px at
                                        the widest, so nothing wraps, the tick set
                                        stays uniform, and the gutter shrinks from
                                        61px to 44px. The unit is not lost — the two
                                        lines directly above this chart already read
                                        "… kcal/Tag im Schnitt" and "Ziel 2.000
                                        kcal/Tag", so repeating it on five ticks was
                                        five repetitions, not a clarification. */}
                                    <YAxis
                                        domain={[0, calorieAxisMax]}
                                        tick={{
                                            fontSize: 11,
                                            fill: 'var(--muted-foreground)',
                                            fontFamily: 'var(--font-sans)',
                                        }}
                                        tickLine={false}
                                        axisLine={false}
                                        width={44}
                                        tickFormatter={(value: number) =>
                                            intl.formatNumber(value)
                                        }
                                    />
                                    {target !== null && (
                                        <ReferenceLine
                                            y={target}
                                            stroke="var(--muted-foreground)"
                                            strokeDasharray="4 4"
                                            // No text label: the card already
                                            // states "Ziel 2.000 kcal/Tag"
                                            // immediately above this chart, and
                                            // at insideTopRight the duplicate
                                            // landed on top of the tallest bar
                                            // whenever a day approached target.
                                        />
                                    )}
                                    {/* contentStyle alone leaves recharts' default
                                        near-black label/item text, which reads as
                                        black-on-near-black against --card in dark
                                        mode — labelStyle/itemStyle fix that. */}
                                    <Tooltip
                                        // The cursor is NOT covered by
                                        // contentStyle. Recharts defaults it to a
                                        // hardcoded #ccc, which is a near-white
                                        // slab on the dark card — seen on a real
                                        // hover, not inferred.
                                        cursor={{ fill: 'var(--muted)', stroke: 'var(--border)' }}
                                        separator=": "
                                        contentStyle={{
                                            background: 'var(--card)',
                                            border: '1px solid var(--border)',
                                            borderRadius: 'var(--radius)',
                                            fontSize: 12,
                                        }}
                                        labelStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
                                        itemStyle={{ color: 'var(--chart-calorie)' }}
                                        formatter={(value) => [
                                            intl.formatMessage(
                                                { id: 'unit.kcal' },
                                                { value: Number(value) },
                                            ),
                                            intl.formatMessage({ id: 'progress.calories' }),
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
                <FormattedMessage id="progress.noChange" />
            </span>
        );
    }
    const Icon = delta > 0 ? TrendingUp : TrendingDown;
    // Two messages rather than one with a conditional '+': the sign is a
    // literal that belongs in the catalogue, and ICU's own number formatting
    // already handles the minus sign and the decimal comma for German.
    return (
        <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground">
            <Icon size={14} strokeWidth={2.5} className="text-accent" aria-hidden="true" />
            <FormattedMessage
                id={delta > 0 ? 'progress.deltaUp' : 'progress.deltaDown'}
                values={{ value: Number(delta.toFixed(1)) }}
            />
        </span>
    );
}

// Primary tile (span-8): the page's one giant numeral (current weight,
// 56px/text-4xl — already the right size under Werkbank's grown display
// scale, see the type-scale note in index.css) plus a full-bleed area
// chart running to the tile's own edges.
function WeightCard({
    weightTrend,
    weightTrendAll,
    range,
}: {
    weightTrend: { date: string; label: string; kg: number }[];
    weightTrendAll: { date: string; label: string; kg: number }[];
    range: RangeValue;
}) {
    const intl = useIntl();
    const hasAnyWeight = weightTrendAll.length > 0;
    const delta =
        weightTrend.length >= 2 ? weightTrend[weightTrend.length - 1].kg - weightTrend[0].kg : null;
    const latest = weightTrendAll[weightTrendAll.length - 1];

    return (
        <Card className="flex flex-col lg:col-span-8">
            <CardHeader>
                <CardTitle>
                    <FormattedMessage id="progress.weight" />
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
                {!hasAnyWeight ? (
                    <EmptyState
                        icon={Scale}
                        title={intl.formatMessage({ id: 'progress.noWeighInsTitle' })}
                        description={intl.formatMessage({ id: 'progress.noWeighInsBody' })}
                        headingLevel={4}
                        testId="progress-weight-empty"
                    />
                ) : weightTrend.length === 0 ? (
                    // Real data exists, just not inside the selected window — this
                    // must never read as "you have no data" (see the empty-states
                    // rule against implying that on a filtered view).
                    <p className="py-2 text-sm text-muted-foreground">
                        <FormattedMessage
                            id="progress.noWeighInsInWindow"
                            values={{
                                window: intl.formatMessage({
                                    id: RANGE_WINDOW_MESSAGE[range as Exclude<RangeValue, 'all'>],
                                }),
                                weight: intl.formatMessage(
                                    { id: 'unit.kg' },
                                    { value: latest.kg },
                                ),
                                date: latest.label,
                                value: (chunks) => (
                                    <span className="font-medium text-foreground">{chunks}</span>
                                ),
                            }}
                        />
                    </p>
                ) : weightTrend.length === 1 ? (
                    <p className="py-2 text-sm text-muted-foreground">
                        <FormattedMessage
                            id="progress.singleWeighIn"
                            values={{
                                weight: intl.formatMessage(
                                    { id: 'unit.kg' },
                                    { value: weightTrend[0].kg },
                                ),
                                date: weightTrend[0].label,
                                value: (chunks) => (
                                    <span className="font-display text-2xl font-semibold tabular-nums text-foreground">
                                        {chunks}
                                    </span>
                                ),
                            }}
                        />
                    </p>
                ) : (
                    <>
                        <div>
                            <div className="flex items-baseline gap-3">
                                <span className="font-display text-4xl font-semibold tabular-nums text-foreground">
                                    <FormattedMessage
                                        id="unit.kg"
                                        values={{
                                            value: Number(
                                                weightTrend[weightTrend.length - 1].kg.toFixed(1),
                                            ),
                                        }}
                                    />
                                </span>
                                {delta !== null && <WeightDelta delta={delta} />}
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                                <FormattedMessage
                                    id="progress.since"
                                    values={{ date: weightTrend[0].label }}
                                />
                            </p>
                        </div>
                        {/* Full-bleed to the tile edge: the -mx-6 wrapper cancels
                            CardContent's own px-6, and the chart's own margin is
                            near-zero — Werkbank's full-bleed treatment, the
                            fiddliest of the five recharts fixes to get right.
                            Two things were measured wrong here and both were
                            visible on a 14-day series:
                            - `flex-1` is `flex: 1 1 0%`, and in this column flex
                              container a 0% basis OVERRIDES h-48. The plot
                              rendered ~55px tall, which flattened a 2.6 kg drop
                              into a dead-straight line with a single y tick.
                            - `-mx-6 w-full` does not widen the box, it SHIFTS it:
                              w-full is 100% of the padded content width, so the
                              chart bled 24px off the left and stopped 24px short
                              on the right. calc(100%+3rem) is the actual bleed. */}
                        <div className="-mx-6 h-48 w-[calc(100%+3rem)]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart
                                    data={weightTrend}
                                    margin={{ top: 8, right: 4, left: 4, bottom: 0 }}
                                >
                                    <defs>
                                        <linearGradient id="progressWeightArea" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.25} />
                                            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis
                                        dataKey="label"
                                        tick={<EdgeTick />}
                                        tickLine={false}
                                        axisLine={{ stroke: 'var(--border)' }}
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis
                                        domain={['dataMin - 1', 'dataMax + 1']}
                                        tickFormatter={(value: number) =>
                                            intl.formatNumber(value, {
                                                minimumFractionDigits: 1,
                                                maximumFractionDigits: 1,
                                            })
                                        }
                                        tick={{
                                            fontSize: 11,
                                            fill: 'var(--muted-foreground)',
                                            fontFamily: 'var(--font-sans)',
                                        }}
                                        tickLine={false}
                                        axisLine={false}
                                        width={40}
                                    />
                                    {/* contentStyle alone leaves recharts' default
                                        near-black label/item text unreadable
                                        against --card in dark mode. */}
                                    <Tooltip
                                        // The cursor is NOT covered by
                                        // contentStyle. Recharts defaults it to a
                                        // hardcoded #ccc, which is a near-white
                                        // slab on the dark card — seen on a real
                                        // hover, not inferred.
                                        cursor={{ fill: 'var(--muted)', stroke: 'var(--border)' }}
                                        separator=": "
                                        contentStyle={{
                                            background: 'var(--card)',
                                            border: '1px solid var(--border)',
                                            borderRadius: 'var(--radius)',
                                            fontSize: 12,
                                        }}
                                        labelStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
                                        itemStyle={{ color: 'var(--accent)' }}
                                        formatter={(value) => [
                                            intl.formatMessage(
                                                { id: 'unit.kg' },
                                                { value: Number(value) },
                                            ),
                                            intl.formatMessage({ id: 'progress.weight' }),
                                        ]}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="kg"
                                        stroke="var(--accent)"
                                        strokeWidth={2}
                                        fill="url(#progressWeightArea)"
                                        dot={{ r: 3, fill: 'var(--accent)' }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </>
                )}

                <LogWeightForm />
            </CardContent>
        </Card>
    );
}

// Legend dot for the per-day distribution bars below — a colour-only key
// would be a WCAG 1.4.1 miss on its own, but here it's paired with the
// macro name text right next to it, same pattern as CapacityBar's legend
// on the dashboard.
function DistributionLegend() {
    return (
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-chart-protein" aria-hidden="true" />
                <FormattedMessage id="macro.protein" />
            </span>
            <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-chart-carb" aria-hidden="true" />
                <FormattedMessage id="macro.carbs" />
            </span>
            <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-chart-fat" aria-hidden="true" />
                <FormattedMessage id="macro.fat" />
            </span>
        </div>
    );
}

// Non-recharts stacked bar (index.css's .over-target/.seg-seam were built
// for exactly this case): each day's protein/carb/fat *proportion*, not a
// vs-target comparison, so the seam is what separates the three hues —
// measured as low as 1.11:1 against each other without it.
function DistributionBar({ protein, carb, fat }: { protein: number; carb: number; fat: number }) {
    const total = protein + carb + fat;
    if (total <= 0) {
        return <div className="h-2 w-24 rounded-full bg-muted" aria-hidden="true" />;
    }
    const segments = [
        { key: 'protein', pct: (protein / total) * 100, className: 'bg-chart-protein' },
        { key: 'carb', pct: (carb / total) * 100, className: 'bg-chart-carb' },
        { key: 'fat', pct: (fat / total) * 100, className: 'bg-chart-fat' },
    ].filter((s) => s.pct > 0);
    return (
        <div className="seg-seam flex h-2 w-24 overflow-hidden rounded-full" aria-hidden="true">
            {segments.map((s) => (
                <div key={s.key} className={cn('h-full', s.className)} style={{ width: `${String(s.pct)}%` }} />
            ))}
        </div>
    );
}

// A macro value that exceeds the active plan's target is never coloured
// alone (WCAG 1.4.1) — bold carries the second channel, matching the
// dashboard's hatch-fill treatment for the same "über Ziel" concept.
function macroCellClassName(value: number, target: number | null): string {
    return cn(
        'text-right font-mono text-sm tabular-nums text-foreground',
        target !== null && value > target && 'font-bold text-destructive-strong',
    );
}

// Full-width per-day macro table (span-12): the plan's stacked recharts bar
// chart is replaced entirely by this table — dense, sortable-by-nothing-
// but-inherently-ordered-by-day, with the distribution bar carrying the
// same visual read a stacked bar chart would, without needing the recharts
// stacked-bar seam fix (that fix lands in .seg-seam here instead, per
// index.css's own "non-recharts case" note).
function MacroTable({
    macroTrend,
    dietPlan,
}: {
    macroTrend: { day: string; label: string; protein: number; carb: number; fat: number }[];
    dietPlan: { proteinTargetGrams: number; carbTargetGrams: number; fatTargetGrams: number } | null;
}) {
    const hasData = macroTrend.some((d) => d.protein + d.carb + d.fat > 0);
    const proteinTarget = dietPlan?.proteinTargetGrams ?? null;
    const carbTarget = dietPlan?.carbTargetGrams ?? null;
    const fatTarget = dietPlan?.fatTargetGrams ?? null;

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between gap-4">
                <CardTitle>
                    <FormattedMessage id="progress.macros" />
                </CardTitle>
                {hasData && <DistributionLegend />}
            </CardHeader>
            <CardContent>
                {!hasData ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                        <FormattedMessage id="progress.macroTableEmpty" />
                    </p>
                ) : (
                    <div className="max-h-[26rem] overflow-y-auto rounded-lg border border-border">
                        <Table>
                            <TableHeader className="sticky top-0 bg-card">
                                <TableRow>
                                    <TableHead>
                                        <FormattedMessage id="progress.colDate" />
                                    </TableHead>
                                    <TableHead className="text-right">
                                        <FormattedMessage id="macro.protein" />
                                    </TableHead>
                                    <TableHead className="text-right">
                                        <FormattedMessage id="macro.carbs" />
                                    </TableHead>
                                    <TableHead className="text-right">
                                        <FormattedMessage id="macro.fat" />
                                    </TableHead>
                                    <TableHead>
                                        <FormattedMessage id="progress.colDistribution" />
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {macroTrend.map((day) => (
                                    <TableRow key={day.day}>
                                        <TableCell className="whitespace-nowrap text-sm text-foreground">
                                            {day.label}
                                        </TableCell>
                                        <TableCell className={macroCellClassName(day.protein, proteinTarget)}>
                                            {day.protein > (proteinTarget ?? Infinity) && (
                                                <span className="sr-only">
                                                    <FormattedMessage id="progress.overTarget" />{' '}
                                                </span>
                                            )}
                                            <FormattedMessage
                                                id="unit.grams"
                                                values={{ value: Math.round(day.protein) }}
                                            />
                                        </TableCell>
                                        <TableCell className={macroCellClassName(day.carb, carbTarget)}>
                                            {day.carb > (carbTarget ?? Infinity) && (
                                                <span className="sr-only">
                                                    <FormattedMessage id="progress.overTarget" />{' '}
                                                </span>
                                            )}
                                            <FormattedMessage
                                                id="unit.grams"
                                                values={{ value: Math.round(day.carb) }}
                                            />
                                        </TableCell>
                                        <TableCell className={macroCellClassName(day.fat, fatTarget)}>
                                            {day.fat > (fatTarget ?? Infinity) && (
                                                <span className="sr-only">
                                                    <FormattedMessage id="progress.overTarget" />{' '}
                                                </span>
                                            )}
                                            <FormattedMessage
                                                id="unit.grams"
                                                values={{ value: Math.round(day.fat) }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <DistributionBar protein={day.protein} carb={day.carb} fat={day.fat} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function LogWeightForm() {
    const intl = useIntl();
    const createWeightEntry = useCreateWeightEntry();
    const [weight, setWeight] = useState('');
    const [error, setError] = useState<string | null>(null);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const weightKg = Number(weight);
        if (!Number.isFinite(weightKg) || weightKg <= 0) {
            setError(intl.formatMessage({ id: 'progress.weightInvalid' }));
            return;
        }
        try {
            await createWeightEntry.mutateAsync({ weightKg, overwrite: true });
            setWeight('');
        } catch (error) {
            const fallback = intl.formatMessage({ id: 'progress.weightError' });
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
                <FormattedMessage id="progress.logTodaysWeight" />
            </Label>
            <div className="flex gap-2">
                <Input
                    id="weightKg"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    placeholder={intl.formatMessage({ id: 'progress.weightPlaceholder' })}
                    aria-invalid={!!error}
                    aria-describedby={error ? 'weightKg-error' : undefined}
                    value={weight}
                    onChange={(e) => {
                        setWeight(e.target.value);
                    }}
                    className="max-w-32"
                />
                {/* data-testid: the button's only handle is its label, which #219
                    translates. The input above and its error line already carry
                    stable ids (weightKg / weightKg-error) the suite can use. */}
                <Button
                    type="submit"
                    variant="outline"
                    disabled={createWeightEntry.isPending || !weight}
                    data-testid="log-weight-submit"
                >
                    <FormattedMessage
                        id={createWeightEntry.isPending ? 'common.saving' : 'progress.logWeight'}
                    />
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
