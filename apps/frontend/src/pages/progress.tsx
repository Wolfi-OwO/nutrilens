import { useMemo, useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useActiveDietPlan } from '@/hooks/use-active-diet-plan';
import { useMealLogs } from '@/hooks/use-meal-logs';
import { useCreateWeightEntry, useWeightEntries } from '@/hooks/use-weight-entries';
import { localDateKey } from '@/lib/date-utils';

const TREND_DAYS = 7;

function lastNDays(n: number): string[] {
    const days: string[] = [];
    const cursor = new Date();
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(cursor);
        d.setDate(cursor.getDate() - i);
        days.push(localDateKey(d));
    }
    return days;
}

function formatShortDate(dateKey: string): string {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
    });
}

export default function ProgressPage() {
    const dietPlan = useActiveDietPlan();
    const mealLogs = useMealLogs();
    const weightEntries = useWeightEntries();

    const calorieTrend = useMemo(() => {
        const days = lastNDays(TREND_DAYS);
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
    }, [mealLogs.data]);

    // Keeps the target reference line on-screen even on a day far under it —
    // otherwise the axis auto-scales to the data alone and the line renders
    // off the visible range.
    const calorieAxisMax = useMemo(() => {
        const dataMax = Math.max(0, ...calorieTrend.map((d) => d.calories));
        const target = dietPlan.data?.dailyCalorieTarget ?? 0;
        return Math.ceil((Math.max(dataMax, target) * 1.1) / 100) * 100;
    }, [calorieTrend, dietPlan.data]);

    const weightTrend = useMemo(() => {
        return [...(weightEntries.data ?? [])]
            .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
            .map((entry) => ({
                date: entry.recordedAt,
                label: formatShortDate(localDateKey(new Date(entry.recordedAt))),
                kg: entry.weightKg,
            }));
    }, [weightEntries.data]);

    const isLoading = dietPlan.isLoading || mealLogs.isLoading || weightEntries.isLoading;
    const isError = mealLogs.isError || weightEntries.isError;

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="font-display text-2xl font-semibold text-foreground">Progress</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Weight and calorie trend history.
                </p>
            </div>

            {isLoading && (
                <>
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-5 w-36" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-56 w-full rounded-lg" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-5 w-28" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-56 w-full rounded-lg" />
                        </CardContent>
                    </Card>
                </>
            )}

            {!isLoading && isError && (
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                        <p className="text-sm text-muted-foreground">
                            Couldn't load your progress.
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                void mealLogs.refetch();
                                void weightEntries.refetch();
                            }}
                        >
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            )}

            {!isLoading && !isError && (
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle>Calories this week</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {mealLogs.data && mealLogs.data.length === 0 ? (
                                <p className="py-6 text-center text-sm text-muted-foreground">
                                    No meals logged yet — your calorie trend will show up here once
                                    you do.
                                </p>
                            ) : (
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
                                            {dietPlan.data && (
                                                <ReferenceLine
                                                    y={dietPlan.data.dailyCalorieTarget}
                                                    stroke="var(--muted-foreground)"
                                                    strokeDasharray="4 4"
                                                />
                                            )}
                                            <Tooltip
                                                contentStyle={{
                                                    background: 'var(--card)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: 8,
                                                    fontSize: 12,
                                                }}
                                                formatter={(value) => [
                                                    `${String(value)} kcal`,
                                                    'Calories',
                                                ]}
                                            />
                                            <Bar
                                                dataKey="calories"
                                                fill="var(--primary)"
                                                radius={[4, 4, 0, 0]}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Weight trend</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            {weightTrend.length === 0 ? (
                                <p className="py-2 text-center text-sm text-muted-foreground">
                                    No weigh-ins yet — log your first one below to start a trend.
                                </p>
                            ) : weightTrend.length === 1 ? (
                                <p className="py-2 text-center text-sm text-muted-foreground">
                                    <span className="font-mono font-semibold tabular-nums text-foreground">
                                        {weightTrend[0].kg} kg
                                    </span>{' '}
                                    logged on {weightTrend[0].label} — one more weigh-in will start
                                    a trend line.
                                </p>
                            ) : (
                                <>
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
                                                />
                                                <YAxis
                                                    domain={['dataMin - 1', 'dataMax + 1']}
                                                    tickFormatter={(value: number) =>
                                                        value.toFixed(1)
                                                    }
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
                                                        borderRadius: 8,
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
                                    <p className="border-t border-border pt-3 text-sm text-muted-foreground">
                                        <span className="font-mono font-semibold tabular-nums text-foreground">
                                            {(
                                                weightTrend[weightTrend.length - 1].kg -
                                                weightTrend[0].kg
                                            ).toFixed(1)}{' '}
                                            kg
                                        </span>{' '}
                                        since {weightTrend[0].label}
                                    </p>
                                </>
                            )}

                            <LogWeightForm />
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
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
            await createWeightEntry.mutateAsync({ weightKg });
            setWeight('');
        } catch {
            setError('Something went wrong logging your weight. Please try again.');
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
            {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
    );
}
