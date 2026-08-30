import { Activity, Salad, ShieldCheck, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminStats } from '@/hooks/use-admin-stats';

// One hairline-divided strip instead of four separate stat cards — a dense
// data surface reads as a ledger row, not a row of identical SaaS tiles.
// The lead item (Total users) gets a larger number, an accent-tinted icon
// mark and a wider column so it reads as the headline metric — the other
// three are supporting context, not four equally-weighted tiles. text-accent
// on --card measures 4.55:1 (AA passes for text this size; see contrast
// note below), the same pairing this app already uses elsewhere.
function StatStrip({
    items,
}: {
    items: {
        icon: LucideIcon;
        label: string;
        value: number;
        detail?: string;
        primary?: boolean;
        // A stat tile is identifiable only by its label, which #219 translates.
        // The items the e2e suite asserts on pass a stable handle instead.
        testId?: string;
    }[];
}) {
    return (
        <Card>
            <div className="flex flex-col divide-y divide-border sm:flex-row sm:divide-x sm:divide-y-0">
                {items.map((item) => (
                    <div
                        key={item.label}
                        data-testid={item.testId}
                        className={item.primary ? 'px-5 py-5 sm:flex-[1.6]' : 'flex-1 px-5 py-5'}
                    >
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            {item.primary ? (
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10">
                                    <item.icon size={13} strokeWidth={2.25} className="text-accent" />
                                </span>
                            ) : (
                                <item.icon size={14} strokeWidth={2} />
                            )}
                            <p className="text-xs font-semibold tracking-wide uppercase">
                                {item.label}
                            </p>
                        </div>
                        <p
                            className={
                                item.primary
                                    ? 'mt-2 font-display text-4xl font-semibold tabular-nums text-foreground'
                                    : 'mt-1.5 font-display text-2xl font-semibold tabular-nums text-foreground'
                            }
                        >
                            {item.value.toLocaleString()}
                        </p>
                        {item.detail && (
                            <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                        )}
                    </div>
                ))}
            </div>
        </Card>
    );
}

export default function AdminOverviewPage() {
    const stats = useAdminStats();

    return (
        <div className="flex flex-col gap-6">
            <div className="border-b border-border pb-6">
                <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
                    Overview
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Platform-wide activity at a glance.
                </p>
            </div>

            {stats.isLoading && (
                <>
                    <Card>
                        <div className="flex flex-col divide-y divide-border sm:flex-row sm:divide-x sm:divide-y-0">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div
                                    key={i}
                                    className={
                                        i === 0
                                            ? 'space-y-2 px-5 py-5 sm:flex-[1.6]'
                                            : 'flex-1 space-y-2 px-5 py-5'
                                    }
                                >
                                    <Skeleton className="h-3.5 w-20" />
                                    <Skeleton className={i === 0 ? 'h-9 w-20' : 'h-7 w-16'} />
                                </div>
                            ))}
                        </div>
                    </Card>
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-5 w-44" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-56 w-full rounded-lg" />
                        </CardContent>
                    </Card>
                </>
            )}

            {stats.isError && !stats.isLoading && (
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                        <p className="text-sm text-muted-foreground">
                            Couldn't load platform stats.
                        </p>
                        <Button variant="outline" size="sm" onClick={() => void stats.refetch()}>
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            )}

            {stats.data && (
                <>
                    <StatStrip
                        items={[
                            {
                                icon: Users,
                                label: 'Total users',
                                testId: 'admin-stat-total-users',
                                value: Object.values(stats.data.usersByRole).reduce(
                                    (a, b) => a + b,
                                    0,
                                ),
                                detail: `${String(stats.data.usersByStatus.suspended)} suspended`,
                                primary: true,
                            },
                            {
                                icon: ShieldCheck,
                                label: 'Admins',
                                testId: 'admin-stat-admins',
                                value: stats.data.usersByRole.admin,
                            },
                            {
                                icon: Salad,
                                label: 'Active diet plans',
                                value: stats.data.activeDietPlans,
                            },
                            {
                                icon: Activity,
                                label: 'Meal logs (7d)',
                                value: stats.data.mealLogsLast7Days,
                                detail: `${stats.data.mealLogsLast30Days.toLocaleString()} in the last 30d`,
                            },
                        ]}
                    />

                    <Card>
                        <CardHeader>
                            <CardTitle>Signups, last 30 days</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {stats.data.signupsLast30Days.length === 0 ? (
                                <p className="py-6 text-center text-sm text-muted-foreground">
                                    No signups in this window yet.
                                </p>
                            ) : (
                                <div className="h-56 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={stats.data.signupsLast30Days}
                                            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                                        >
                                            <CartesianGrid
                                                strokeDasharray="3 3"
                                                stroke="var(--border)"
                                                vertical={false}
                                            />
                                            <XAxis
                                                dataKey="date"
                                                tick={{
                                                    fontSize: 11,
                                                    fill: 'var(--muted-foreground)',
                                                }}
                                                tickLine={false}
                                                axisLine={{ stroke: 'var(--border)' }}
                                                interval="preserveStartEnd"
                                            />
                                            <YAxis
                                                allowDecimals={false}
                                                tick={{
                                                    fontSize: 12,
                                                    fill: 'var(--muted-foreground)',
                                                }}
                                                tickLine={false}
                                                axisLine={false}
                                                width={32}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    background: 'var(--card)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: 8,
                                                    fontSize: 12,
                                                }}
                                                formatter={(value) => [
                                                    `${String(value)}`,
                                                    'Signups',
                                                ]}
                                            />
                                            <Bar
                                                dataKey="count"
                                                fill="var(--primary)"
                                                radius={[4, 4, 0, 0]}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
