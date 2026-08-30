import { useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useNavigate } from 'react-router';
import { Activity, Beef, CalendarDays, Check, Droplet, Flame, Monitor, Moon, Sun, UtensilsCrossed, Wheat } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FormattedDate, FormattedMessage, FormattedNumber, useIntl } from 'react-intl';
import type { IntlShape } from 'react-intl';
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
import {
    useDeleteAccount,
    useExportData,
    useRemoveAvatar,
    useUpdateProfile,
    useUploadAvatar,
} from '@/hooks/use-profile';
import { ApiError } from '@/lib/api-client';
import { computeStreak, localDateKey } from '@/lib/date-utils';
import { useTheme, type Theme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import type { PublicUser } from '@/types/api';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

// `intl.formatDate`, not `toLocaleDateString(undefined, …)`: the app's language
// is a stored choice that need not match the browser's, and `undefined` follows
// the browser.
function formatDate(iso: string, intl: IntlShape): string {
    return intl.formatDate(iso, { year: 'numeric', month: 'long', day: 'numeric' });
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
function avatarSourceCaptionId(user: PublicUser): string | null {
    if (!user.avatarUrl) return null;
    if (user.avatarUploaded) return 'profile.avatar.uploaded';
    if (isFromHost(user.avatarUrl, 'githubusercontent.com')) return 'profile.avatar.fromGitHub';
    if (
        isFromHost(user.avatarUrl, 'googleusercontent.com') ||
        isFromHost(user.avatarUrl, 'google.com')
    ) {
        return 'profile.avatar.fromGoogle';
    }
    return 'profile.avatar.fromMicrosoft';
}

// text-primary-strong, not text-primary: --primary composited over the
// bg-primary/10 tint measures under the 4.5:1 AA floor for text this size (the
// same finding recorded on the Beta badge in app-layout.tsx).
const STATUS_BADGE_STYLES: Record<PublicUser['status'], string> = {
    active: 'bg-primary/10 text-primary-strong',
    suspended: 'bg-destructive/10 text-destructive-strong',
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
                    <FormattedMessage id="profile.title" />
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    <FormattedMessage id="profile.subtitle" />
                </p>
            </div>

            <AvatarCard user={user} onUpdate={setUser} />
            <ProfileInfoCard user={user} onUpdate={setUser} />
            <PlanTargetsCard />
            <PreferencesCard onReplayGuide={() => setGuideOpen(true)} />
            <ConnectedAccountsCard />
            <DataPrivacyCard />
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

    const themes: { value: Theme; labelId: string; icon: LucideIcon }[] = [
        { value: 'light', labelId: 'profile.theme.light', icon: Sun },
        { value: 'dark', labelId: 'profile.theme.dark', icon: Moon },
        { value: 'system', labelId: 'profile.theme.system', icon: Monitor },
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <FormattedMessage id="profile.preferences" />
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
                <div>
                    <Label className="text-muted-foreground">
                        <FormattedMessage id="profile.appearance" />
                    </Label>
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
                                <FormattedMessage id={option.labelId} />
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-4">
                    <div>
                        <p className="text-sm font-medium text-foreground">
                            <FormattedMessage id="profile.replayGuideTitle" />
                        </p>
                        <p className="text-xs text-muted-foreground">
                            <FormattedMessage id="profile.replayGuideBody" />
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onReplayGuide}
                    >
                        <FormattedMessage id="profile.replayGuide" />
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
    const intl = useIntl();
    const uploadAvatar = useUploadAvatar();
    const removeAvatar = useRemoveAvatar();
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const captionId = avatarSourceCaptionId(user);
    const pending = uploadAvatar.isPending || removeAvatar.isPending;

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // reset so picking the same file twice still fires onChange
        if (!file) return;

        setError(null);
        if (file.size > MAX_AVATAR_BYTES) {
            setError(intl.formatMessage({ id: 'profile.avatar.tooLarge' }));
            return;
        }

        uploadAvatar.mutate(file, {
            onSuccess: onUpdate,
            onError: (err) => {
                setError(
                    err instanceof ApiError
                        ? err.message
                        : intl.formatMessage({ id: 'profile.avatar.uploadFailed' }),
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
                        {captionId && (
                            <p className="mt-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                <FormattedMessage id={captionId} />
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
                            <FormattedMessage
                                id={
                                    uploadAvatar.isPending
                                        ? 'profile.avatar.uploading'
                                        : 'profile.avatar.change'
                                }
                            />
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
                                                    : intl.formatMessage({
                                                          id: 'common.genericError',
                                                      }),
                                            );
                                        },
                                    });
                                }}
                            >
                                <FormattedMessage
                                    id={
                                        removeAvatar.isPending
                                            ? 'profile.avatar.removing'
                                            : 'profile.avatar.remove'
                                    }
                                />
                            </Button>
                        )}
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={onFileChange}
                        className="hidden"
                        aria-label={intl.formatMessage({ id: 'profile.avatar.uploadLabel' })}
                    />
                    {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
            </CardContent>
        </Card>
    );
}

// Rebuilt per render from the active locale — zod bakes messages in at schema
// construction time. Same reasoning as login.tsx.
function buildProfileSchema(intl: IntlShape) {
    return z.object({
        displayName: z.string().min(1, intl.formatMessage({ id: 'profile.displayNameRequired' })),
    });
}
type ProfileForm = z.infer<ReturnType<typeof buildProfileSchema>>;

function ProfileInfoCard({
    user,
    onUpdate,
}: {
    user: PublicUser;
    onUpdate: (u: PublicUser) => void;
}) {
    const intl = useIntl();
    const updateProfile = useUpdateProfile();
    const [formError, setFormError] = useState<string | null>(null);
    // Tracks whether the *last* submit succeeded, separate from isDirty —
    // isDirty alone can't tell "never touched" from "just saved", and the
    // save/dirty state has to say which of those it is.
    const [justSaved, setJustSaved] = useState(false);

    const {
        register,
        handleSubmit,
        reset,
        trigger,
        formState: { errors, isSubmitting, isDirty },
    } = useForm<ProfileForm>({
        resolver: zodResolver(buildProfileSchema(intl)),
        defaultValues: { displayName: user.displayName },
        // react-hook-form's actual default is onSubmit-only — a blurred
        // empty field showed no error until the button was pressed.
        // `reValidateMode` (checked directly against the installed RHF
        // build, its own docs undersell this) only takes effect for a field
        // that has already been submitted once; before a first submit,
        // mode:'onBlur' alone governs, and it fires on blur only, not on
        // every keystroke — measured live: typing a fix after a blur error
        // left the stale error on screen until the field blurred again. The
        // manual trigger() below on the fixed value's onChange is what
        // actually clears it live.
        mode: 'onBlur',
    });

    const onSubmit = async (values: ProfileForm) => {
        setFormError(null);
        try {
            const updated = await updateProfile.mutateAsync(values.displayName);
            onUpdate(updated);
            // react-hook-form's `defaultValues` are captured at mount, so
            // isDirty would stay true forever after a successful save
            // without re-baselining it here.
            reset({ displayName: updated.displayName });
            setJustSaved(true);
        } catch (error) {
            setFormError(
                error instanceof ApiError
                    ? error.message
                    : intl.formatMessage({ id: 'common.genericError' }),
            );
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <FormattedMessage id="profile.info" />
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
                <form
                    onSubmit={(e) => void handleSubmit(onSubmit)(e)}
                    className="flex flex-col gap-4"
                    noValidate
                >
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="displayName">
                            <FormattedMessage id="profile.displayName" />
                        </Label>
                        <Input
                            id="displayName"
                            aria-invalid={!!errors.displayName}
                            aria-describedby={errors.displayName ? 'displayName-error' : undefined}
                            {...register('displayName', {
                                onChange: () => {
                                    setJustSaved(false);
                                    // Once the field is already showing an
                                    // error, re-check on every keystroke so
                                    // a fix clears it immediately instead of
                                    // waiting for the next blur.
                                    if (errors.displayName) void trigger('displayName');
                                },
                            })}
                        />
                        {errors.displayName && (
                            <p id="displayName-error" className="text-sm text-destructive">
                                {errors.displayName.message}
                            </p>
                        )}
                    </div>

                    {formError && (
                        <p
                            role="alert"
                            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive-strong"
                        >
                            {formError}
                        </p>
                    )}

                    <div className="flex items-center gap-3">
                        <Button type="submit" disabled={isSubmitting || !isDirty} className="w-fit">
                            <FormattedMessage
                                id={isSubmitting ? 'common.saving' : 'common.saveChanges'}
                            />
                        </Button>
                        {/* Dirty/saved state must be visible without relying on the
                            button's disabled colour alone. */}
                        {isDirty ? (
                            <span className="text-xs font-medium text-muted-foreground">
                                <FormattedMessage id="profile.unsavedChanges" />
                            </span>
                        ) : (
                            justSaved && (
                                <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                    <Check size={14} strokeWidth={2.5} className="text-accent" />
                                    <FormattedMessage id="profile.saved" />
                                </span>
                            )
                        )}
                    </div>
                </form>

                {/*
                    No password-change UI here — for anyone, not just OAuth-only
                    accounts. apps/api has no change-password endpoint at all yet
                    (only email/password + displayName at registration), so there's
                    nothing this form could call; adding one is backend scope.
                */}
                <dl className="grid grid-cols-1 gap-4 border-t border-border pt-5 sm:grid-cols-2">
                    <div>
                        <dt className="text-xs font-medium text-muted-foreground">
                            <FormattedMessage id="profile.email" />
                        </dt>
                        <dd className="mt-1 text-sm text-foreground">{user.email}</dd>
                    </div>
                    <div>
                        <dt className="text-xs font-medium text-muted-foreground">
                            <FormattedMessage id="profile.role" />
                        </dt>
                        <dd className="mt-1">
                            <Badge className="bg-secondary text-secondary-foreground">
                                <FormattedMessage id={`role.${user.role}`} />
                            </Badge>
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs font-medium text-muted-foreground">
                            <FormattedMessage id="profile.status" />
                        </dt>
                        <dd className="mt-1">
                            <Badge className={STATUS_BADGE_STYLES[user.status]}>
                                <FormattedMessage id={`status.${user.status}`} />
                            </Badge>
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs font-medium text-muted-foreground">
                            <FormattedMessage id="profile.memberSince" />
                        </dt>
                        <dd className="mt-1 text-sm text-foreground">
                            <FormattedDate
                                value={user.createdAt}
                                year="numeric"
                                month="long"
                                day="numeric"
                            />
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
                <CardTitle>
                    <FormattedMessage id="profile.dailyTargets" />
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="mb-3 text-sm text-muted-foreground">
                    <FormattedMessage
                        id="profile.dailyTargetsValue"
                        values={{ calories: dietPlan.data.dailyCalorieTarget }}
                    />
                </p>
                <div className="space-y-3">
                    <MacroBar
                        labelId="macro.protein"
                        icon={Beef}
                        consumed={0}
                        target={dietPlan.data.proteinTargetGrams}
                        barClassName="bg-chart-protein"
                        iconClassName="bg-chart-protein/15 text-chart-protein"
                    />
                    <MacroBar
                        labelId="macro.carbs"
                        icon={Wheat}
                        consumed={0}
                        target={dietPlan.data.carbTargetGrams}
                        barClassName="bg-chart-carb"
                        iconClassName="bg-chart-carb/15 text-chart-carb"
                    />
                    <MacroBar
                        labelId="macro.fat"
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
                <CardTitle>
                    <FormattedMessage id="profile.connectedAccounts" />
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">
                    <FormattedMessage id="profile.connectedAccountsBody" />
                </p>
            </CardContent>
        </Card>
    );
}

// GDPR Art. 17 (erasure) and Art. 20 (portability) self-service — see
// useExportData/useDeleteAccount in hooks/use-profile.ts. No dialog
// primitive exists in this codebase (components/ui has no Dialog), so the
// delete confirmation expands inline in the card rather than pulling in a
// new dependency for one destructive action. A typed "DELETE" confirmation
// plus an optional password field (required server-side only for
// password-based accounts — see deleteAccountHandler in apps/api) guards
// against a misclick on an irreversible action.
function DataPrivacyCard() {
    const intl = useIntl();
    const exportData = useExportData();
    const deleteAccount = useDeleteAccount();
    const { logout } = useAuth();
    const navigate = useNavigate();

    const [confirming, setConfirming] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmText, setConfirmText] = useState('');
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [exportError, setExportError] = useState<string | null>(null);

    // The confirmation word is translated too: typing an English word to
    // confirm on an otherwise-German page is a needless barrier, and the guard
    // is against a misclick, not against someone who cannot read the label.
    const confirmWord = intl.formatMessage({ id: 'profile.deleteConfirmWord' });
    const canDelete = confirmText.trim().toLocaleUpperCase(intl.locale) === confirmWord;

    const resetConfirmState = () => {
        setConfirming(false);
        setPassword('');
        setConfirmText('');
        setDeleteError(null);
    };

    const onExport = () => {
        setExportError(null);
        exportData.mutate(undefined, {
            onError: (err) => {
                setExportError(
                    err instanceof ApiError
                        ? err.message
                        : intl.formatMessage({ id: 'profile.exportFailed' }),
                );
            },
        });
    };

    const onDelete = () => {
        setDeleteError(null);
        deleteAccount.mutate(password, {
            onSuccess: () => {
                logout();
                void navigate('/login', { replace: true });
            },
            onError: (err) => {
                setDeleteError(
                    err instanceof ApiError
                        ? err.message
                        : intl.formatMessage({ id: 'common.genericError' }),
                );
            },
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <FormattedMessage id="profile.yourData" />
                </CardTitle>
                <CardDescription>
                    <FormattedMessage id="profile.yourDataDescription" />
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
                <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                        <p className="text-sm font-medium text-foreground">
                            <FormattedMessage id="profile.download" />
                        </p>
                        <p className="text-xs text-muted-foreground">
                            <FormattedMessage id="profile.downloadBody" />
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={exportData.isPending}
                        onClick={onExport}
                    >
                        <FormattedMessage
                            id={exportData.isPending ? 'profile.preparing' : 'profile.downloadAction'}
                        />
                    </Button>
                </div>
                {exportError && (
                    <p role="alert" className="text-sm text-destructive">
                        {exportError}
                    </p>
                )}

                <div className="border-t border-border pt-5">
                    <p className="text-sm font-medium text-foreground">
                        <FormattedMessage id="profile.deleteAccount" />
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        <FormattedMessage id="profile.deleteAccountBody" />
                    </p>

                    {!confirming ? (
                        <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="mt-3"
                            onClick={() => setConfirming(true)}
                        >
                            <FormattedMessage id="profile.deleteMyAccount" />
                        </Button>
                    ) : (
                        <div className="mt-3 flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="delete-password">
                                    <FormattedMessage id="profile.deletePasswordLabel" />{' '}
                                    <span className="font-normal text-muted-foreground">
                                        <FormattedMessage id="profile.deletePasswordHint" />
                                    </span>
                                </Label>
                                <Input
                                    id="delete-password"
                                    type="password"
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="delete-confirm">
                                    <FormattedMessage id="profile.deleteConfirmLabel" />
                                </Label>
                                <Input
                                    id="delete-confirm"
                                    autoComplete="off"
                                    aria-describedby="delete-confirm-hint"
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                />
                                {/* Requirement stated up front, not only after a failed
                                    attempt — the button below is simply disabled until
                                    this is met, so there is no separate error state to
                                    show. */}
                                <p id="delete-confirm-hint" className="text-xs text-muted-foreground">
                                    <FormattedMessage id="profile.deleteConfirmHint" />
                                </p>
                            </div>
                            {deleteError && (
                                <p role="alert" className="text-sm text-destructive">
                                    {deleteError}
                                </p>
                            )}
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    disabled={!canDelete || deleteAccount.isPending}
                                    onClick={onDelete}
                                >
                                    <FormattedMessage
                                        id={
                                            deleteAccount.isPending
                                                ? 'profile.deleting'
                                                : 'profile.deleteSubmit'
                                        }
                                    />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={resetConfirmState}
                                >
                                    <FormattedMessage id="common.cancel" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
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
    items: { icon: LucideIcon; key: string; label: string; value: React.ReactNode; detail?: string }[];
}) {
    return (
        <Card>
            <div className="flex flex-col divide-y divide-border sm:flex-row sm:divide-x sm:divide-y-0">
                {items.map((item) => (
                    <div key={item.key} className="flex-1 px-5 py-5">
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
    const intl = useIntl();
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
                    <p className="text-sm text-muted-foreground">
                        <FormattedMessage id="profile.statsError" />
                    </p>
                    <Button variant="outline" size="sm" onClick={() => void mealLogs.refetch()}>
                        <FormattedMessage id="common.retry" />
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
                        key: 'memberSince',
                        label: intl.formatMessage({ id: 'profile.memberSince' }),
                        value: formatDate(user.createdAt, intl),
                    },
                    {
                        icon: UtensilsCrossed,
                        key: 'mealsLogged',
                        label: intl.formatMessage({ id: 'profile.mealsLogged' }),
                        value: <FormattedNumber value={mealLogs.data?.length ?? 0} />,
                    },
                    {
                        icon: Flame,
                        key: 'streak',
                        label: intl.formatMessage({ id: 'profile.currentStreak' }),
                        value: intl.formatMessage({ id: 'profile.streakValue' }, { count: streak }),
                    },
                    {
                        icon: Activity,
                        key: 'avgCalories',
                        label: intl.formatMessage(
                            { id: 'profile.avgCalories' },
                            { days: windowDays },
                        ),
                        value:
                            avgCalories > 0
                                ? intl.formatMessage({ id: 'unit.kcal' }, { value: avgCalories })
                                : intl.formatMessage({ id: 'profile.noValue' }),
                    },
                ]}
            />

            <Card>
                <CardHeader>
                    <CardTitle>
                        <FormattedMessage id="profile.avgMacroSplit" />
                    </CardTitle>
                    <CardDescription>
                        <FormattedMessage id="profile.lastNDays" values={{ count: windowDays }} />
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {totalMacroGrams === 0 ? (
                        <p className="py-2 text-center text-sm text-muted-foreground">
                            <FormattedMessage id="profile.noMacroSplitYet" />
                        </p>
                    ) : (
                        <div className="space-y-3">
                            <MacroBar
                                labelId="macro.protein"
                                icon={Beef}
                                consumed={avgProtein}
                                target={totalMacroGrams}
                                barClassName="bg-chart-protein"
                                iconClassName="bg-chart-protein/15 text-chart-protein"
                            />
                            <MacroBar
                                labelId="macro.carbs"
                                icon={Wheat}
                                consumed={avgCarb}
                                target={totalMacroGrams}
                                barClassName="bg-chart-carb"
                                iconClassName="bg-chart-carb/15 text-chart-carb"
                            />
                            <MacroBar
                                labelId="macro.fat"
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
