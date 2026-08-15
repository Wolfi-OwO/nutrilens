import { useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Activity, Beef, CalendarDays, Droplet, Flame, Monitor, Moon, Sun, UtensilsCrossed, Wheat } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MacroBar } from '@/components/dashboard/macro-bar';
import { OnboardingTutorial } from '@/components/onboarding-tutorial';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useActiveDietPlan } from '@/hooks/use-active-diet-plan';
import { useAuth } from '@/hooks/use-auth';
import { useMealLogs } from '@/hooks/use-meal-logs';
import { useRemoveAvatar, useUpdateProfile, useUploadAvatar } from '@/hooks/use-profile';
import { ApiError } from '@/lib/api-client';
import { computeStreak, localDateKey } from '@/lib/date-utils';
import { useTheme, type Theme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import type { PublicUser } from '@/types/api';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

/**
 * Substring matching on a whole URL is not a host check —
 * `https://evil.example/?x=googleusercontent.com` passes it. CodeQL flagged
 * exactly that here (js/incomplete-url-substring-sanitization). Parse the URL
 * and match the hostname, anchoring the suffix on a dot so `notgoogle.com`
 * cannot pass as `google.com`. A relative `avatarUrl` (our own upload route)
 * resolves against the current origin and matches nothing here.
 */
function isFromHost(url: string, domain: string): boolean {
    let hostname: string;
    try {
        hostname = new URL(url, window.location.origin).hostname;
    } catch {
        return false;
    }
    return hostname === domain || hostname.endsWith(`.${domain}`);
}

/**
 * `avatarUrl`/`avatarUploaded` (see apps/api's `toAvatarUrl`) already fully
 * determine which of the four sources is live — never re-derive this from
 * anything else. An own upload always wins; between the two provider
 * sources, only GitHub/Google hot-link to their own domain, so a same-origin
 * `avatarUrl` that isn't an upload can only be Microsoft's Graph photo.
 */
function avatarSourceCaption(user: PublicUser): string | null {
    if (!user.avatarUrl) return null;
    if (user.avatarUploaded) return 'Uploaded';
    if (isFromHost(user.avatarUrl, 'githubusercontent.com')) return 'From GitHub';
    if (
        isFromHost(user.avatarUrl, 'googleusercontent.com') ||
        isFromHost(user.avatarUrl, 'google.com')
    ) {
        return 'From Google';
    }
    return 'From Microsoft';
}

const STATUS_BADGE_STYLES: Record<PublicUser['status'], string> = {
    active: 'bg-primary/10 text-primary',
    suspended: 'bg-destructive/10 text-destructive',
    deleted: 'bg-muted text-muted-foreground',
};

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize',
                className,
            )}
        >
            {children}
        </span>
    );
}

export default function ProfilePage() {
    const { user, setUser } = useAuth();
    const [guideOpen, setGuideOpen] = useState(false);

    // ProtectedRoute (see App.tsx) never renders this page without a user —
    // this guard is purely for TypeScript's benefit, not a real fallback UI.
    if (!user) return null;

    return (
        <div className="flex flex-col gap-6">
            <div className="border-b border-border pb-6">
                <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
                    Profile
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Manage your photo, details, and see your activity at a glance.
                </p>
            </div>

            <AvatarCard user={user} onUpdate={setUser} />
            <ProfileInfoCard user={user} onUpdate={setUser} />
            <PlanTargetsCard />
            <PreferencesCard onReplayGuide={() => setGuideOpen(true)} />
            <ConnectedAccountsCard />
            <StatsSection user={user} />

            <OnboardingTutorial
                open={guideOpen}
                onOpenChange={setGuideOpen}
                userId={user.id}
            />
        </div>
    );
}

// Appearance + profile-time settings. Theme lives in lib/theme; the guide
// replay just drops the per-user completion flag and lets OnboardingTutorial's
// own open prop take it from there.
function PreferencesCard({ onReplayGuide }: { onReplayGuide: () => void }) {
    const { theme, setTheme } = useTheme();

    const themes: { value: Theme; label: string; icon: LucideIcon }[] = [
        { value: 'light', label: 'Light', icon: Sun },
        { value: 'dark', label: 'Dark', icon: Moon },
        { value: 'system', label: 'System', icon: Monitor },
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Preferences</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
                <div>
                    <Label className="text-muted-foreground">Appearance</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {themes.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setTheme(option.value)}
                                className={cn(
                                    'inline-flex items-center gap-2 rounded-full border border-input px-4 py-2 text-sm font-medium transition-colors hover:bg-muted',
                                    theme === option.value &&
                                        'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
                                )}
                            >
                                <option.icon size={16} strokeWidth={2} />
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-4">
                    <div>
                        <p className="text-sm font-medium text-foreground">Replay quick guide</p>
                        <p className="text-xs text-muted-foreground">
                            Go through the welcome walkthrough again.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onReplayGuide}
                    >
                        Replay guide
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

// Hero section — the avatar and display name are the frozen, must-stay-
// visible identity of this page (see the task's hard constraints), so they
// render as large, unconditional heading content here rather than being
// buried in the edit form below.
function AvatarCard({ user, onUpdate }: { user: PublicUser; onUpdate: (u: PublicUser) => void }) {
    const uploadAvatar = useUploadAvatar();
    const removeAvatar = useRemoveAvatar();
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const caption = avatarSourceCaption(user);
    const pending = uploadAvatar.isPending || removeAvatar.isPending;

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // reset so picking the same file twice still fires onChange
        if (!file) return;

        setError(null);
        if (file.size > MAX_AVATAR_BYTES) {
            setError('Image must be 2MB or smaller.');
            return;
        }

        uploadAvatar.mutate(file, {
            onSuccess: onUpdate,
            onError: (err) => {
                setError(
                    err instanceof ApiError ? err.message : 'Upload failed. Please try again.',
                );
            },
        });
    };

    return (
        <Card>
            <CardContent className="flex flex-col items-center gap-6 pt-6 text-center sm:flex-row sm:items-center sm:text-left">
                <Avatar name={user.displayName} seed={user.id} src={user.avatarUrl} size="xl" />
                <div className="flex flex-1 flex-col items-center gap-3 sm:items-start">
                    <div>
                        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                            {user.displayName}
                        </h2>
                        <p className="mt-0.5 text-sm text-muted-foreground">{user.email}</p>
                        {caption && (
                            <p className="mt-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                {caption}
                            </p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={pending}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {uploadAvatar.isPending ? 'Uploading…' : 'Change photo'}
                        </Button>
                        {user.avatarUploaded && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={pending}
                                onClick={() => {
                                    setError(null);
                                    removeAvatar.mutate(undefined, {
                                        onSuccess: onUpdate,
                                        onError: (err) => {
                                            setError(
                                                err instanceof ApiError
                                                    ? err.message
                                                    : 'Something went wrong. Please try again.',
                                            );
                                        },
                                    });
                                }}
                            >
                                {removeAvatar.isPending ? 'Removing…' : 'Remove photo'}
                            </Button>
                        )}
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={onFileChange}
                        className="hidden"
                        aria-label="Upload photo"
                    />
                    {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
            </CardContent>
        </Card>
    );
}

const profileSchema = z.object({
    displayName: z.string().min(1, 'Display name is required.'),
});
type ProfileForm = z.infer<typeof profileSchema>;

function ProfileInfoCard({
    user,
    onUpdate,
}: {
    user: PublicUser;
    onUpdate: (u: PublicUser) => void;
}) {
    const updateProfile = useUpdateProfile();
    const [formError, setFormError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<ProfileForm>({
        resolver: zodResolver(profileSchema),
        defaultValues: { displayName: user.displayName },
    });

    const onSubmit = async (values: ProfileForm) => {
        setFormError(null);
        try {
            const updated = await updateProfile.mutateAsync(values.displayName);
            onUpdate(updated);
        } catch (error) {
            setFormError(
                error instanceof ApiError
                    ? error.message
                    : 'Something went wrong. Please try again.',
            );
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Profile info</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
                <form
                    onSubmit={(e) => void handleSubmit(onSubmit)(e)}
                    className="flex flex-col gap-4"
                    noValidate
                >
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="displayName">Display name</Label>
                        <Input
                            id="displayName"
                            aria-invalid={!!errors.displayName}
                            {...register('displayName')}
                        />
                        {errors.displayName && (
                            <p className="text-sm text-destructive">{errors.displayName.message}</p>
                        )}
                    </div>

                    {formError && (
                        <p
                            role="alert"
                            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
                        >
                            {formError}
                        </p>
                    )}

                    <Button type="submit" disabled={isSubmitting} className="w-fit">
                        {isSubmitting ? 'Saving…' : 'Save changes'}
                    </Button>
                </form>

                {/*
                    No password-change UI here — for anyone, not just OAuth-only
                    accounts. apps/api has no change-password endpoint at all yet
                    (only email/password + displayName at registration), so there's
                    nothing this form could call; adding one is backend scope.
                */}
                <dl className="grid grid-cols-1 gap-4 border-t border-border pt-5 sm:grid-cols-2">
                    <div>
                        <dt className="text-xs font-medium text-muted-foreground">Email</dt>
                        <dd className="mt-1 text-sm text-foreground">{user.email}</dd>
                    </div>
                    <div>
                        <dt className="text-xs font-medium text-muted-foreground">Role</dt>
                        <dd className="mt-1">
                            <Badge className="bg-secondary text-secondary-foreground">
                                {user.role}
                            </Badge>
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs font-medium text-muted-foreground">Status</dt>
                        <dd className="mt-1">
                            <Badge className={STATUS_BADGE_STYLES[user.status]}>
                                {user.status}
                            </Badge>
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs font-medium text-muted-foreground">Member since</dt>
                        <dd className="mt-1 text-sm text-foreground">
                            {formatDate(user.createdAt)}
                        </dd>
                    </div>
                </dl>
            </CardContent>
        </Card>
    );
}

// Show the active plan's daily targets at a glance; there's no edit form here
// because /plan is the single owner of plan changes (one owner per job).
function PlanTargetsCard() {
    const dietPlan = useActiveDietPlan();

    if (dietPlan.isLoading) {
        return (
            <Card>
                <CardContent className="space-y-3 pt-6">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-full" />
                </CardContent>
            </Card>
        );
    }

    if (!dietPlan.data) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Daily targets</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="mb-3 text-sm text-muted-foreground">
                    {dietPlan.data.dailyCalorieTarget.toLocaleString()} kcal daily
                </p>
                <div className="space-y-3">
                    <MacroBar
                        label="Protein"
                        icon={Beef}
                        consumed={0}
                        target={dietPlan.data.proteinTargetGrams}
                        barClassName="bg-chart-protein"
                        iconClassName="bg-chart-protein/15 text-chart-protein"
                    />
                    <MacroBar
                        label="Carbs"
                        icon={Wheat}
                        consumed={0}
                        target={dietPlan.data.carbTargetGrams}
                        barClassName="bg-chart-carb"
                        iconClassName="bg-chart-carb/15 text-chart-carb"
                    />
                    <MacroBar
                        label="Fat"
                        icon={Droplet}
                        consumed={0}
                        target={dietPlan.data.fatTargetGrams}
                        barClassName="bg-chart-fat"
                        iconClassName="bg-chart-fat/15 text-chart-fat"
                    />
                </div>
            </CardContent>
        </Card>
    );
}

// No endpoint exists yet to list a user's linked OAuth providers (only
// GET /auth/providers, which lists providers the *app* has configured, not
// which ones *this account* has linked — see repository/auth-provider.repository.ts,
// which has no listByUserId). Rather than fake a list from the avatar URL
// (a user who uploaded a photo after linking GitHub would then wrongly show
// as having no linked accounts), this section states that plainly instead
// of guessing.
function ConnectedAccountsCard() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Connected accounts</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">
                    Linked sign-in providers aren't listed here yet. You can still sign in with
                    GitHub, Google, or Microsoft if you've connected one of them.
                </p>
            </CardContent>
        </Card>
    );
}

// One hairline-divided strip instead of four separate stat cards — reads as
// a print nutrition-label block rather than a row of identical dashboard
// tiles, and gives each figure room to be a proper font-display number.
function StatStrip({
    items,
}: {
    items: { icon: LucideIcon; label: string; value: string; detail?: string }[];
}) {
    return (
        <Card>
            <div className="flex flex-col divide-y divide-border sm:flex-row sm:divide-x sm:divide-y-0">
                {items.map((item) => (
                    <div key={item.label} className="flex-1 px-5 py-5">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <item.icon size={14} strokeWidth={2} />
                            <p className="text-xs font-semibold tracking-wide uppercase">
                                {item.label}
                            </p>
                        </div>
                        <p className="mt-1.5 font-display text-2xl font-semibold tabular-nums text-foreground">
                            {item.value}
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

function StatsLoadingSkeleton() {
    return (
        <div className="flex flex-col gap-4">
            <Card>
                <div className="flex flex-col divide-y divide-border sm:flex-row sm:divide-x sm:divide-y-0">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex-1 space-y-2 px-5 py-5">
                            <Skeleton className="h-3.5 w-20" />
                            <Skeleton className="h-7 w-16" />
                        </div>
                    ))}
                </div>
            </Card>
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-40" />
                </CardHeader>
                <CardContent className="space-y-3">
                    <Skeleton className="h-8 w-full rounded-full" />
                    <Skeleton className="h-8 w-full rounded-full" />
                    <Skeleton className="h-8 w-full rounded-full" />
                </CardContent>
            </Card>
        </div>
    );
}

function StatsSection({ user }: { user: PublicUser }) {
    const mealLogs = useMealLogs();

    const streak = useMemo(
        () =>
            computeStreak((mealLogs.data ?? []).map((log) => localDateKey(new Date(log.loggedAt)))),
        [mealLogs.data],
    );

    // "Last 30 days" caps at how old the account actually is, so a
    // brand-new account doesn't get its daily average diluted by days
    // before it existed.
    const windowDays = useMemo(() => {
        const accountAgeDays =
            Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86_400_000) + 1;
        return Math.min(30, Math.max(1, accountAgeDays));
    }, [user.createdAt]);

    const recentTotals = useMemo(() => {
        const cutoff = Date.now() - windowDays * 86_400_000;
        return (mealLogs.data ?? [])
            .filter((log) => new Date(log.loggedAt).getTime() >= cutoff)
            .reduce(
                (acc, log) => ({
                    calories: acc.calories + log.totalCalories,
                    protein: acc.protein + log.proteinGrams,
                    carb: acc.carb + log.carbGrams,
                    fat: acc.fat + log.fatGrams,
                }),
                { calories: 0, protein: 0, carb: 0, fat: 0 },
            );
    }, [mealLogs.data, windowDays]);

    if (mealLogs.isLoading) return <StatsLoadingSkeleton />;

    if (mealLogs.isError) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                    <p className="text-sm text-muted-foreground">Couldn't load your stats.</p>
                    <Button variant="outline" size="sm" onClick={() => void mealLogs.refetch()}>
                        Retry
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const avgCalories = Math.round(recentTotals.calories / windowDays);
    const avgProtein = recentTotals.protein / windowDays;
    const avgCarb = recentTotals.carb / windowDays;
    const avgFat = recentTotals.fat / windowDays;
    // Share of intake by weight (grams), not calorie-weighted — reusing
    // MacroBar's consumed/target ratio for a proportion, not a real target,
    // is a deliberate stretch of an existing component rather than a new one.
    const totalMacroGrams = avgProtein + avgCarb + avgFat;

    return (
        <div className="flex flex-col gap-4">
            <StatStrip
                items={[
                    {
                        icon: CalendarDays,
                        label: 'Member since',
                        value: formatDate(user.createdAt),
                    },
                    {
                        icon: UtensilsCrossed,
                        label: 'Meals logged',
                        value: (mealLogs.data?.length ?? 0).toLocaleString(),
                    },
                    {
                        icon: Flame,
                        label: 'Current streak',
                        value: `${String(streak)} day${streak === 1 ? '' : 's'}`,
                    },
                    {
                        icon: Activity,
                        label: `Avg. calories (${String(windowDays)}d)`,
                        value: avgCalories > 0 ? `${avgCalories.toLocaleString()} kcal` : '—',
                    },
                ]}
            />

            <Card>
                <CardHeader>
                    <CardTitle>Average macro split</CardTitle>
                    <CardDescription>
                        Last {windowDays} day{windowDays === 1 ? '' : 's'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {totalMacroGrams === 0 ? (
                        <p className="py-2 text-center text-sm text-muted-foreground">
                            No meals logged yet — your macro split will show up here once you do.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            <MacroBar
                                label="Protein"
                                icon={Beef}
                                consumed={avgProtein}
                                target={totalMacroGrams}
                                barClassName="bg-chart-protein"
                                iconClassName="bg-chart-protein/15 text-chart-protein"
                            />
                            <MacroBar
                                label="Carbs"
                                icon={Wheat}
                                consumed={avgCarb}
                                target={totalMacroGrams}
                                barClassName="bg-chart-carb"
                                iconClassName="bg-chart-carb/15 text-chart-carb"
                            />
                            <MacroBar
                                label="Fat"
                                icon={Droplet}
                                consumed={avgFat}
                                target={totalMacroGrams}
                                barClassName="bg-chart-fat"
                                iconClassName="bg-chart-fat/15 text-chart-fat"
                            />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
