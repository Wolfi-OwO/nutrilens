import { useMemo, useState, useEffect } from 'react';
import {
    ArrowDown,
    ArrowUp,
    Beef,
    Droplet,
    Flame,
    Plus,
    Salad,
    Scale,
    Trash2,
    UtensilsCrossed,
    Wheat,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
    FormattedDate,
    FormattedMessage,
    FormattedNumber,
    FormattedTime,
    useIntl,
} from 'react-intl';
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
import { MacroBar } from '@/components/dashboard/macro-bar';
import { SourceBadge } from '@/components/dashboard/source-badge';
import { WaterCard } from '@/components/dashboard/water-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EdgeTick } from '@/components/ui/chart-ticks';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useActiveDietPlan } from '@/hooks/use-active-diet-plan';
import { useDeleteMealLog, useMealLogs } from '@/hooks/use-meal-logs';
import { useWeightEntries } from '@/hooks/use-weight-entries';
import { computeStreak, formatShortDate, isToday, lastNDays, localDateKey } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
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
//
// The values are stable keys, not display strings: they index MEAL_ORDER and
// build a message id, so translating "Breakfast" never touches the grouping.
type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

function mealTypeOf(loggedAt: string): MealType {
    const hour = new Date(loggedAt).getHours();
    if (hour < 11) return 'breakfast';
    if (hour < 15) return 'lunch';
    if (hour < 21) return 'dinner';
    return 'snacks';
}

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

function greetingId(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'dashboard.greeting.morning';
    if (hour < 18) return 'dashboard.greeting.afternoon';
    return 'dashboard.greeting.evening';
}

type SortKey = 'time' | 'calories';
type SortDir = 'asc' | 'desc';

export default function DashboardPage() {
    const { user } = useAuth();
    const intl = useIntl();
    const dietPlan = useActiveDietPlan();
    const mealLogs = useMealLogs();
    const weightEntries = useWeightEntries();
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

    // Per-meal-type kcal split, feeding the capacity bar's segments — reuses
    // mealTypeOf/MEAL_ORDER exactly as the per-type sections below do, so the
    // bar and the list can never disagree about which meal a log belongs to.
    const kcalByType = useMemo(() => {
        const byType = new Map<MealType, number>(MEAL_ORDER.map((t) => [t, 0]));
        for (const meal of todaysMeals) {
            const type = mealTypeOf(meal.loggedAt);
            byType.set(type, (byType.get(type) ?? 0) + meal.totalCalories);
        }
        return byType;
    }, [todaysMeals]);

    const streak = useMemo(
        () =>
            computeStreak((mealLogs.data ?? []).map((log) => localDateKey(new Date(log.loggedAt)))),
        [mealLogs.data],
    );

    const latestWeightKg = useMemo(() => {
        const entries = weightEntries.data ?? [];
        if (entries.length === 0) return null;
        return [...entries].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)).at(-1)!
            .weightKg;
    }, [weightEntries.data]);

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
            label: formatShortDate(day, intl.locale),
            calories: totalsByDay.get(day) ?? 0,
        }));
    }, [mealLogs.data, intl.locale]);

    const isLoading = dietPlan.isLoading || mealLogs.isLoading;
    const isError = dietPlan.isError || mealLogs.isError;

    const [waterGlasses, setWaterGlasses] = useState(() => initialWaterGlasses);

    const addGlass = () => setWaterGlasses(prev => Math.min(prev + 1, 8));
    const removeGlass = () => setWaterGlasses(prev => Math.max(prev - 1, 0));

    // Persist to localStorage on every change
    useEffect(() => {
        localStorage.setItem(WATER_KEY, JSON.stringify({ day: localDateKey(new Date()), glasses: waterGlasses }));
    }, [waterGlasses, WATER_KEY]);

    const [sortKey, setSortKey] = useState<SortKey>('time');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="font-display text-2xl font-bold text-foreground">
                    <FormattedMessage
                        id={greetingId()}
                        values={{ name: user?.displayName.split(' ')[0] ?? '' }}
                    />
                </h1>
                <p className="mt-1 text-base text-muted-foreground">
                    <FormattedMessage id="dashboard.subtitle" />
                </p>
            </div>

            {/* Skeletons mirroring the bento below: key tile + macro tile,
                then the four dense stat tiles — the real grid renders only
                once both queries have data, so no skeleton ever shares the
                page with content. */}
            {isLoading && !isError && (
                <div className="flex flex-col gap-5">
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                        <Card className="lg:col-span-7">
                            <CardContent className="flex flex-col gap-5 pt-6">
                                <Skeleton className="h-16 w-40" />
                                <Skeleton className="h-3 w-full rounded-full" />
                                <Skeleton className="h-28 w-full rounded-lg" />
                            </CardContent>
                        </Card>
                        <Card className="lg:col-span-5">
                            <CardContent className="flex flex-col gap-4 pt-6">
                                <Skeleton className="h-8 w-full rounded-full" />
                                <Skeleton className="h-8 w-full rounded-full" />
                                <Skeleton className="h-8 w-full rounded-full" />
                            </CardContent>
                        </Card>
                    </div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        {[0, 1, 2, 3].map((i) => (
                            <Card key={i}>
                                <CardContent className="flex flex-col gap-2 p-4">
                                    <Skeleton className="h-4 w-16" />
                                    <Skeleton className="h-7 w-20" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {isError && !isLoading && (
                <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                        <p className="text-base text-muted-foreground">
                            <FormattedMessage id="dashboard.loadError" />
                        </p>
                        <Button
                            variant="outline"
                            onClick={() => {
                                void dietPlan.refetch();
                                void mealLogs.refetch();
                            }}
                        >
                            <FormattedMessage id="common.retry" />
                        </Button>
                    </CardContent>
                </Card>
            )}

            {!isLoading && !isError && !dietPlan.data && (
                <Card>
                    <CardHeader>
                        <CardTitle>
                            <FormattedMessage id="dashboard.setUpPlanTitle" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        <p className="text-base text-muted-foreground">
                            <FormattedMessage id="dashboard.setUpPlanBody" />
                        </p>
                        <Button asChild className="w-fit">
                            <Link to="/plan">
                                <FormattedMessage id="dashboard.createPlan" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            )}

            {!isLoading && !isError && dietPlan.data && (
                <div className="flex flex-col gap-5">
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                        <KeyTile
                            consumed={totals.calories}
                            target={dietPlan.data.dailyCalorieTarget}
                            mealCount={todaysMeals.length}
                            kcalByType={kcalByType}
                            trend={weekTrend}
                            hasAnyLogsEver={(mealLogs.data?.length ?? 0) > 0}
                        />
                        <MacroTile
                            protein={totals.protein}
                            proteinTarget={dietPlan.data.proteinTargetGrams}
                            carb={totals.carb}
                            carbTarget={dietPlan.data.carbTargetGrams}
                            fat={totals.fat}
                            fatTarget={dietPlan.data.fatTargetGrams}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <WaterCard
                            glasses={waterGlasses}
                            onAdd={addGlass}
                            onRemove={removeGlass}
                            target={8}
                        />
                        <StatTile
                            titleId="dashboard.streakTile"
                            icon={Flame}
                            iconClassName="bg-chart-fat/15 text-chart-fat"
                        >
                            <span className="font-display text-2xl font-semibold tabular-nums text-foreground">
                                {streak > 0 ? (
                                    <FormattedMessage id="dashboard.streakTileValue" values={{ count: streak }} />
                                ) : (
                                    <FormattedMessage id="dashboard.streakTileEmpty" />
                                )}
                            </span>
                        </StatTile>
                        <StatTile
                            titleId="dashboard.weightTile"
                            icon={Scale}
                            iconClassName="bg-primary/10 text-primary-strong"
                        >
                            {latestWeightKg === null ? (
                                <span className="text-sm text-muted-foreground">
                                    <FormattedMessage id="dashboard.weightTileEmpty" />
                                </span>
                            ) : (
                                <span className="font-display text-2xl font-semibold tabular-nums text-foreground">
                                    <FormattedMessage
                                        id="unit.kg"
                                        values={{ value: Number(latestWeightKg.toFixed(1)) }}
                                    />
                                </span>
                            )}
                        </StatTile>
                        <StatTile
                            titleId="dashboard.mealsTile"
                            icon={UtensilsCrossed}
                            iconClassName="bg-accent/10 text-accent"
                        >
                            {/* Bare count. The tile title already reads
                                "MAHLZEITEN HEUTE", so "4 Mahlzeiten" repeated the
                                noun -- and at 320px the two-column grid gives this
                                tile ~148px, where the phrase wrapped and ran into
                                the tile's right edge. The sibling tiles state a
                                value plus a unit the title does not already carry
                                ("7 Tage" under SERIE, "76,8 kg" under GEWICHT). */}
                            <span className="font-display text-2xl font-semibold tabular-nums text-foreground">
                                <FormattedNumber value={todaysMeals.length} />
                            </span>
                        </StatTile>
                    </div>
                </div>
            )}

            {!isLoading && !isError && (
                <section aria-labelledby="today-meals-heading">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2
                                id="today-meals-heading"
                                className="font-display text-lg font-bold text-foreground"
                            >
                                <FormattedMessage id="dashboard.todaysMeals" />
                            </h2>
                            <p className="mt-0.5 text-base text-muted-foreground">
                                {todaysMeals.length === 0 ? (
                                    <FormattedMessage id="dashboard.nothingLoggedYet" />
                                ) : (
                                    <FormattedMessage
                                        id="dashboard.todaySummary"
                                        values={{
                                            count: todaysMeals.length,
                                            calories: totals.calories,
                                        }}
                                    />
                                )}
                            </p>
                        </div>
                        {/* flex-wrap: the sort group plus "Mahlzeit hinzufügen"
                            measured 340px wide against a 320px viewport in
                            German, and this row is the only thing on the
                            dashboard that pushed the page into horizontal
                            scroll besides the header. */}
                        <div className="flex flex-wrap items-center gap-2">
                            {todaysMeals.length > 1 && (
                                <div
                                    role="group"
                                    aria-label={intl.formatMessage({ id: 'dashboard.sortTimeLabel' })}
                                    className="inline-flex gap-1 rounded-full border border-border bg-card p-1"
                                >
                                    <SortToggle
                                        active={sortKey === 'time'}
                                        dir={sortDir}
                                        onClick={() => toggleSort('time')}
                                        labelId="dashboard.sortTimeLabel"
                                        ascId="dashboard.sortTimeAsc"
                                        descId="dashboard.sortTimeDesc"
                                    />
                                    <SortToggle
                                        active={sortKey === 'calories'}
                                        dir={sortDir}
                                        onClick={() => toggleSort('calories')}
                                        labelId="macro.calories"
                                        ascId="dashboard.sortCaloriesAsc"
                                        descId="dashboard.sortCaloriesDesc"
                                    />
                                </div>
                            )}
                            <Button asChild variant="outline" size="sm" className="gap-1.5">
                                <Link to="/log-meal">
                                    <Plus size={16} strokeWidth={2} />
                                    <FormattedMessage id="dashboard.addMeal" />
                                </Link>
                            </Button>
                        </div>
                    </div>

                    {todaysMeals.length === 0 && (
                        <EmptyState
                            icon={Salad}
                            title={intl.formatMessage({ id: 'dashboard.emptyTitle' })}
                            description={intl.formatMessage({ id: 'dashboard.emptyBody' })}
                            action={{
                                label: intl.formatMessage({ id: 'dashboard.emptyAction' }),
                                href: '/log-meal',
                            }}
                            variant="illustrated"
                        />
                    )}

                    {todaysMeals.length > 0 && (
                        <div className="flex flex-col gap-4">
                            {MEAL_ORDER.map((type) => {
                                const meals = sortMeals(
                                    todaysMeals.filter((meal) => mealTypeOf(meal.loggedAt) === type),
                                    sortKey,
                                    sortDir,
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

function sortMeals(meals: MealLog[], sortKey: SortKey, sortDir: SortDir): MealLog[] {
    const sorted = [...meals].sort((a, b) => {
        const av = sortKey === 'time' ? new Date(a.loggedAt).getTime() : a.totalCalories;
        const bv = sortKey === 'time' ? new Date(b.loggedAt).getTime() : b.totalCalories;
        return av - bv;
    });
    return sortDir === 'desc' ? sorted.reverse() : sorted;
}

// Column sort control for the meal list below: a plain toggle button
// (aria-pressed + a fully-worded aria-label carrying both the field and the
// resulting direction), not `aria-sort` — that attribute is only valid on a
// columnheader/rowheader cell, and this list is a styled <ul>, not a
// <table>, precisely so each row keeps its native `listitem` role (see
// MealSection below). Misusing aria-sort here would risk an
// aria-allowed-attr violation for a cosmetic win.
function SortToggle({
    active,
    dir,
    onClick,
    labelId,
    ascId,
    descId,
}: {
    active: boolean;
    dir: SortDir;
    onClick: () => void;
    labelId: string;
    ascId: string;
    descId: string;
}) {
    const intl = useIntl();
    const Icon = dir === 'asc' ? ArrowUp : ArrowDown;
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            aria-label={intl.formatMessage({ id: active && dir === 'desc' ? descId : ascId })}
            className={cn(
                'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase transition-colors',
                active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
        >
            <FormattedMessage id={labelId} />
            {active && <Icon size={12} strokeWidth={2.5} aria-hidden="true" />}
        </button>
    );
}

// Werkbank's key tile: cobalt-blocked header, the day's kcal at 92px
// (text-6xl), the segmented capacity bar, and the full-bleed 7-day
// sparkline — the primary metric on the page, everything else on this
// screen is subordinate to it.
function KeyTile({
    consumed,
    target,
    mealCount,
    kcalByType,
    trend,
    hasAnyLogsEver,
}: {
    consumed: number;
    target: number;
    mealCount: number;
    kcalByType: Map<MealType, number>;
    trend: { label: string; calories: number }[];
    hasAnyLogsEver: boolean;
}) {
    const isOver = consumed > target;
    const remaining = Math.max(target - consumed, 0);

    return (
        <Card className="flex flex-col overflow-hidden border-border-key lg:col-span-7">
            <div className="flex items-baseline justify-between gap-4 bg-primary px-5 py-4 text-primary-foreground">
                <div>
                    <p className="text-2xs font-semibold tracking-wide uppercase opacity-80">
                        <FormattedMessage id="dashboard.todaysIntake" />
                    </p>
                    <p className="mt-0.5 text-sm opacity-90">
                        <FormattedDate value={new Date()} weekday="long" month="long" day="numeric" />
                        {' · '}
                        <FormattedMessage id="dashboard.mealCount" values={{ count: mealCount }} />
                    </p>
                </div>
                <p className="font-mono text-sm tabular-nums opacity-90">
                    <FormattedMessage id="dashboard.consumedOfTarget" values={{ consumed, target }} />
                </p>
            </div>

            <div className="flex flex-1 flex-col gap-5 p-5">
                <div className="flex items-end gap-3">
                    <span
                        className="font-display text-6xl font-bold tabular-nums text-foreground"
                        aria-live="polite"
                        aria-atomic="true"
                    >
                        <FormattedNumber value={Math.round(isOver ? consumed - target : remaining)} />
                    </span>
                    <span className="pb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                        <FormattedMessage id={isOver ? 'calorieRing.over' : 'calorieRing.left'} />
                    </span>
                </div>

                <CapacityBar kcalByType={kcalByType} consumed={consumed} target={target} />

                <WeekSparkline trend={trend} target={target} hasAnyLogsEver={hasAnyLogsEver} />
            </div>
        </Card>
    );
}

// The signature decision: a capacity bar instead of a ring, segmented by
// meal at decreasing opacity so the tile answers "what did I spend it on"
// and "what's left" in one glance — a ring can only show the total. Widths
// are proportional to whichever of consumed/target is larger, so an
// over-budget day still shows real proportions instead of clipping at 100%;
// the dashed marker then shows exactly where the target sat.
function CapacityBar({
    kcalByType,
    consumed,
    target,
}: {
    kcalByType: Map<MealType, number>;
    consumed: number;
    target: number;
}) {
    const intl = useIntl();
    const denom = Math.max(consumed, target, 1);
    const remaining = Math.max(target - consumed, 0);
    const targetMarkerPct = target > 0 && target < denom ? (target / denom) * 100 : null;

    const OPACITY: Record<MealType, string> = {
        breakfast: 'bg-primary',
        lunch: 'bg-primary/80',
        dinner: 'bg-primary/60',
        snacks: 'bg-primary/40',
    };

    const segments = MEAL_ORDER.map((type) => ({
        type,
        kcal: kcalByType.get(type) ?? 0,
        pct: ((kcalByType.get(type) ?? 0) / denom) * 100,
    })).filter((s) => s.kcal > 0);

    const ariaLabel = [
        intl.formatMessage({ id: 'dashboard.capacityBarLabel' }),
        ...segments.map(
            (s) =>
                `${intl.formatMessage({ id: `dashboard.meal.${s.type}` })}: ${intl.formatMessage(
                    { id: 'unit.kcal' },
                    { value: Math.round(s.kcal) },
                )}`,
        ),
        remaining > 0
            ? `${intl.formatMessage({ id: 'dashboard.remaining' })}: ${intl.formatMessage(
                  { id: 'unit.kcal' },
                  { value: Math.round(remaining) },
              )}`
            : '',
    ]
        .filter(Boolean)
        .join(', ');

    return (
        <div className="flex flex-col gap-2">
            <div
                role="img"
                aria-label={ariaLabel}
                className="seg-seam relative flex h-3 w-full overflow-hidden rounded-full bg-muted"
            >
                {segments.map((s) => (
                    <div
                        key={s.type}
                        className={cn('h-full', OPACITY[s.type])}
                        style={{ width: `${String(s.pct)}%` }}
                    />
                ))}
                {targetMarkerPct !== null && (
                    <div
                        aria-hidden="true"
                        className="absolute inset-y-0 border-l-2 border-dashed border-foreground/50"
                        style={{ left: `${String(targetMarkerPct)}%` }}
                    />
                )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-2xs text-muted-foreground">
                {segments.map((s) => (
                    <span key={s.type} className="inline-flex items-center gap-1.5">
                        <span className={cn('h-2 w-2 rounded-full', OPACITY[s.type])} aria-hidden="true" />
                        <FormattedMessage id={`dashboard.meal.${s.type}`} />
                        <span className="font-mono tabular-nums">
                            <FormattedMessage id="unit.kcal" values={{ value: Math.round(s.kcal) }} />
                        </span>
                    </span>
                ))}
                {remaining > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/30" aria-hidden="true" />
                        <FormattedMessage id="dashboard.remaining" />
                        <span className="font-mono tabular-nums">
                            <FormattedMessage id="unit.kcal" values={{ value: Math.round(remaining) }} />
                        </span>
                    </span>
                )}
            </div>
        </div>
    );
}

// Full-bleed 7-day sparkline, running to the key tile's own edges (the
// `-mx-5` wrapper cancels the tile's own p-5) — Werkbank's full-bleed treat­
// ment, margin={0} on the chart plus the negative-margin wrapper from the
// direction's own notes. Chart text stays on foreground/muted tokens; only
// the mark carries the accent colour.
function WeekSparkline({
    trend,
    target,
    hasAnyLogsEver,
}: {
    trend: { label: string; calories: number }[];
    target: number;
    // Whether the account has ANY meal log at all, not just one inside this
    // 7-day window — a week with zero logged days still renders the (flat,
    // truthful) chart as long as the account isn't a genuine first-run. A
    // window-scoped check here would tell a returning user with an older
    // history "you haven't logged anything yet", which is the exact
    // "empty state must not imply no data on a filtered view" mistake.
    hasAnyLogsEver: boolean;
}) {
    const intl = useIntl();
    const total = trend.reduce((sum, day) => sum + day.calories, 0);
    const loggedDays = trend.filter((day) => day.calories > 0).length;

    // Keeps the target reference line on-screen even on a day far under it —
    // otherwise the axis auto-scales to the data alone and renders off-range.
    const axisMax = useMemo(() => {
        const dataMax = Math.max(0, ...trend.map((d) => d.calories));
        return Math.ceil((Math.max(dataMax, target) * 1.1) / 100) * 100;
    }, [trend, target]);

    return (
        <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <FormattedMessage id="dashboard.thisWeek" />
            </p>
            {!hasAnyLogsEver ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                    <FormattedMessage id="dashboard.noTrendYet" />
                </p>
            ) : (
                // -mx-5 does not widen a w-full box, it SHIFTS it: w-full is
                // 100% of the tile's PADDED width, so this bled 20px off the
                // left and stopped 20px short of the right edge. Measured off a
                // 1440px capture (area ended at 1065px inside a tile whose
                // content box ends at 1100px), not derived. calc(100%+2.5rem)
                // is the width that actually reaches both edges.
                <div className="-mx-5 h-28 w-[calc(100%+2.5rem)]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trend} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
                            <defs>
                                <linearGradient id="dashWeekArea" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
                                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <YAxis hide domain={[0, axisMax]} />
                            {/* EdgeTick clamps the first/last label's anchor —
                                on a full-bleed chart recharts centres them on the
                                tile edge and the SVG clips them ("Aug." for "28.
                                Aug.", "3. Se" for "3. Sept." on a real capture).
                                interval is no longer 0 either: seven labels do
                                not fit 320px and they overprinted each other
                                there; preserveStartEnd keeps the two that carry
                                the range and drops whatever will not fit. */}
                            <XAxis
                                dataKey="label"
                                tick={<EdgeTick />}
                                tickLine={false}
                                axisLine={{ stroke: 'var(--border)' }}
                                interval="preserveStartEnd"
                            />
                            <ReferenceLine
                                y={target}
                                stroke="var(--muted-foreground)"
                                strokeDasharray="4 4"
                                strokeOpacity={0.6}
                                label={{
                                    value: intl.formatMessage({ id: 'progress.chartTarget' }),
                                    // insideTopLeft, not ...Right: on a
                                    // full-bleed chart the right-anchored label
                                    // rendered half outside the SVG ("Zie|"), and
                                    // the right edge is also where the current
                                    // day's value sits, so the label collided
                                    // with the mark it annotates.
                                    position: 'insideTopLeft',
                                    fontSize: 10,
                                    fill: 'var(--muted-foreground)',
                                }}
                            />
                            {/* contentStyle alone is not enough: recharts'
                                default label/item text is near-black and
                                reads as black-on-near-black against --card
                                in dark mode unless explicitly overridden. */}
                            <Tooltip
                                // Recharts themes neither the cursor nor the
                                // label/value separator. The default cursor is a
                                // hardcoded #ccc, which is a near-white slab on
                                // --card in dark mode; the default separator
                                // renders "Kalorien : 1.100 kcal", with a space
                                // before the colon.
                                cursor={{ stroke: 'var(--border)' }}
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
                                    intl.formatMessage({ id: 'unit.kcal' }, { value: Number(value) }),
                                    intl.formatMessage({ id: 'macro.calories' }),
                                ]}
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
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <p className="text-2xs font-medium text-muted-foreground">
                        <FormattedMessage id="dashboard.weekTotal" values={{ days: WEEK_DAYS }} />
                    </p>
                    <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">
                        <FormattedNumber value={total} />
                    </p>
                </div>
                <div>
                    <p className="text-2xs font-medium text-muted-foreground">
                        <FormattedMessage id="dashboard.daysLogged" />
                    </p>
                    <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">
                        <FormattedMessage
                            id="dashboard.daysLoggedValue"
                            values={{ logged: loggedDays, total: WEEK_DAYS }}
                        />
                    </p>
                </div>
            </div>
        </div>
    );
}

// Secondary to the key tile: three macro bars, no ring, no chart of its
// own — subordinate on purpose (see the calorie-ring decision).
//
// flex flex-col is still load-bearing here: Card renders a plain <div>, so
// CardContent's own `flex-1` below has nothing to resolve against without it.
// The tile stretches to the span-7 key tile's height at 1440px, so the three
// rows have to fill that height on their own rather than be centred into it
// — centring (the previous approach) left ~140px of dead space above the
// first row and ~130px below the last, which read as unfinished on the
// flagship screen. Rows are now top-aligned and separated by a full-width
// divider (echoing the key tile's own hairline dividers) with generous
// padding, and each MacroBar (see its own file) is sized up a step. That
// closed most of the gap but not all of it at 1440px (measured: three rows
// still left ~150px of empty space below the last one, because the tile
// keeps stretching to match whatever the key tile's own chart needs). A
// "Gesamt" footer — the sum of the three already-fetched consumed/target
// values, pinned to the bottom with mt-auto the same way the key tile pins
// its own weekTotal/daysLogged footer — uses no new data and closes the
// rest: it reads as an intentional instrument summary line, not a patch.
function MacroTile({
    protein,
    proteinTarget,
    carb,
    carbTarget,
    fat,
    fatTarget,
}: {
    protein: number;
    proteinTarget: number;
    carb: number;
    carbTarget: number;
    fat: number;
    fatTarget: number;
}) {
    const totalConsumed = protein + carb + fat;
    const totalTarget = proteinTarget + carbTarget + fatTarget;

    return (
        <Card className="flex flex-col lg:col-span-5">
            <CardHeader>
                <CardTitle>
                    <FormattedMessage id="progress.macros" />
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
            <div className="divide-y divide-border">
                <MacroBar
                    labelId="macro.protein"
                    icon={Beef}
                    consumed={protein}
                    target={proteinTarget}
                    showRemaining
                    barClassName="bg-chart-protein"
                    iconClassName="bg-chart-protein/15 text-chart-protein"
                    className="py-4 first:pt-0 last:pb-0"
                />
                <MacroBar
                    labelId="macro.carbs"
                    icon={Wheat}
                    consumed={carb}
                    target={carbTarget}
                    showRemaining
                    barClassName="bg-chart-carb"
                    iconClassName="bg-chart-carb/15 text-chart-carb"
                    className="py-4 first:pt-0 last:pb-0"
                />
                <MacroBar
                    labelId="macro.fat"
                    icon={Droplet}
                    consumed={fat}
                    target={fatTarget}
                    showRemaining
                    barClassName="bg-chart-fat"
                    iconClassName="bg-chart-fat/15 text-chart-fat"
                    className="py-4 first:pt-0 last:pb-0"
                />
            </div>
            <div className="mt-auto flex items-baseline justify-between border-t border-border pt-4">
                <p className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
                    <FormattedMessage id="macro.totalLabel" />
                </p>
                <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                    <FormattedMessage
                        id="macro.barValue"
                        values={{ consumed: Math.round(totalConsumed), target: Math.round(totalTarget), unit: 'g' }}
                    />
                </p>
            </div>
            </CardContent>
        </Card>
    );
}

// Shared shell for the four dense span-3 tiles (Wasser, Serie, Gewicht,
// Mahlzeiten) — see the "Salz" note in the task report for why the fourth
// tile isn't sodium.
function StatTile({
    titleId,
    icon: Icon,
    iconClassName,
    children,
}: {
    titleId: string;
    icon: LucideIcon;
    iconClassName: string;
    children: React.ReactNode;
}) {
    return (
        <Card className="flex h-full flex-col p-4">
            <div className="flex items-center gap-2">
                <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', iconClassName)}>
                    <Icon size={14} strokeWidth={2} />
                </span>
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    <FormattedMessage id={titleId} />
                </span>
            </div>
            <div className="mt-2 flex-1">{children}</div>
        </Card>
    );
}

function MealSection({
    type,
    meals,
    kcal,
    onDelete,
    deletePending,
}: {
    type: MealType;
    meals: MealLog[];
    kcal: number;
    onDelete: (id: string) => void;
    deletePending: boolean;
}) {
    const intl = useIntl();
    const mealName = intl.formatMessage({ id: `dashboard.meal.${type}` });

    return (
        <section aria-label={intl.formatMessage({ id: 'dashboard.mealSection' }, { meal: mealName })}>
            <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-foreground">{mealName}</h3>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    <FormattedMessage id="unit.kcal" values={{ value: kcal }} />
                </span>
            </div>
            {/* A styled <ul>/<li> list, not a literal <table>: each row keeps
                its native `listitem` role, which is what the meal-logging
                e2e spec scopes its "450 kcal" assertion to
                (getByRole('listitem').filter({ hasText })). A real <table>
                row can't carry that role without an aria-required-parent
                violation, so the dense, sortable "table" look here is CSS —
                the sort controls above this list, not aria-sort. */}
            <ul className="flex flex-col gap-1.5">
                {meals.map((meal) => {
                    const names = meal.items.map((item) => item.foodName).join(', ');
                    return (
                        <li
                            key={meal.id}
                            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5"
                        >
                            <div className="min-w-0 flex-1">
                                {/* Wraps to two lines on a phone, one dense line
                                    from `sm` up. Measured at 320px: the row is
                                    288px and its right-hand cluster is already at
                                    its floor (27px icon badge + 58px kcal + a 44px
                                    delete target), so the name gets 101px -- about
                                    twelve characters, and "Vollkornbrot mit
                                    Avocado" needs 192px. One line therefore cannot
                                    identify the row at this width, and the name is
                                    the only thing that does. Two lines cost row
                                    height, which a phone list can afford; the
                                    desktop table rhythm keeps its single line.

                                    break-words is the other half of it, and it is
                                    not decoration: line-clamp only breaks at word
                                    boundaries, so a single long German compound
                                    with no space in it cannot wrap at all and gets
                                    sliced mid-word with NO ellipsis --
                                    "Studentenfutter" rendered as "Studentenfutt"
                                    on a 320px capture. overflow-wrap lets the word
                                    itself break. `title` carries the untruncated
                                    name at every width, for the desktop
                                    single-line clamp as much as for this one. */}
                                <p
                                    title={names}
                                    className="line-clamp-2 font-medium break-words text-foreground sm:line-clamp-1"
                                >
                                    {names}
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    <span>
                                        {/* 2-digit, not numeric: `numeric` renders
                                            "8:00" where every German clock reads
                                            "08:00", and the column of times in this
                                            list then does not align either. */}
                                        <FormattedTime
                                            value={meal.loggedAt}
                                            hour="2-digit"
                                            minute="2-digit"
                                        />
                                    </span>
                                    <span className="hidden sm:inline">
                                        {' · '}
                                        <FormattedMessage
                                            id="dashboard.mealMacros"
                                            values={{
                                                protein: Math.round(meal.proteinGrams),
                                                carbs: Math.round(meal.carbGrams),
                                                fat: Math.round(meal.fatGrams),
                                            }}
                                        />
                                    </span>
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                                <SourceBadge source={meal.source} />
                                <span className="whitespace-nowrap text-right font-mono text-sm font-semibold tabular-nums text-foreground">
                                    <FormattedMessage
                                        id="unit.kcal"
                                        values={{ value: meal.totalCalories }}
                                    />
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
    const intl = useIntl();

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
                    <FormattedMessage id="dashboard.deleteMealConfirm" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="px-2 text-xs"
                    onClick={() => setConfirming(false)}
                >
                    <FormattedMessage id="common.cancel" />
                </Button>
            </div>
        );
    }

    return (
        <Button
            variant="ghost"
            size="icon"
            aria-label={intl.formatMessage({ id: 'dashboard.deleteMeal' })}
            title={intl.formatMessage({ id: 'dashboard.deleteMeal' })}
            className="text-muted-foreground hover:text-destructive"
            onClick={() => setConfirming(true)}
        >
            <Trash2 size={16} strokeWidth={2} />
        </Button>
    );
}

// Per-day hydration kept in localStorage: a single integer of glasses. No
// backend field exists for it and the dashboard is the only consumer, so a
// tiny client-side tile beats introducing an API schema for it.
// ponytail: single global key, per-day reset handled by stamping the day
// string alongside — split keys per day if multi-day history is ever wanted.
