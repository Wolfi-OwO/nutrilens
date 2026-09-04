import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { FormattedMessage, useIntl } from 'react-intl';
import type { IntlShape } from 'react-intl';
import { z } from 'zod';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Footer } from '@/components/layout/footer';
import { AuthPanel } from '@/components/auth/auth-panel';
import { PasswordInput } from '@/components/auth/password-input';
import { LocaleToggle } from '@/components/locale-toggle';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { useAuth } from '@/hooks/use-auth';
import { ApiError } from '@/lib/api-client';

// Built per render from the active locale rather than declared once at module
// scope: a zod message is baked into the schema when the schema is constructed,
// so a module-level schema would keep serving whichever language happened to be
// active when this module was first evaluated, even after a locale switch.
function buildLoginSchema(intl: IntlShape) {
    return z.object({
        email: z
            .string()
            .min(1, intl.formatMessage({ id: 'auth.validation.emailRequired' }))
            .email(intl.formatMessage({ id: 'auth.validation.emailInvalid' })),
        password: z.string().min(1, intl.formatMessage({ id: 'auth.validation.passwordRequired' })),
    });
}

type LoginForm = z.infer<ReturnType<typeof buildLoginSchema>>;

export default function LoginPage() {
    const { user, login } = useAuth();
    const intl = useIntl();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [formError, setFormError] = useState<string | null>(searchParams.get('error'));

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginForm>({
        resolver: zodResolver(buildLoginSchema(intl)),
        // Validate on blur (a field is checked once the person is done with
        // it, not while they're still typing into it), then re-validate on
        // every keystroke once an error exists — the standard "don't
        // interrupt, but clear the error the moment it's fixed" pattern.
        mode: 'onBlur',
        reValidateMode: 'onChange',
    });

    if (user) return <Navigate to="/" replace />;

    const onSubmit = async (values: LoginForm) => {
        setFormError(null);
        try {
            await login(values.email, values.password);
            void navigate('/');
        } catch (error) {
            setFormError(
                error instanceof ApiError
                    ? error.message
                    : intl.formatMessage({ id: 'common.genericError' }),
            );
        }
    };

    return (
        // Re-decided against Werkbank, not preserved by inertia: the 2fr/3fr
        // split is kept — "unequal bento spans" is this direction's own
        // vocabulary for a layout, so a lopsided two-column grid is already
        // on-brief — but it is deliberately NOT a centred card on a gradient
        // (banned twice over: no purple gradient, no centered-everything
        // layout). AuthPanel's own content was re-skinned for the same
        // reason (see its file); the masthead panel only appears at lg: (a
        // fixed brand mark stands in for it below that), so the form itself
        // never depends on it. Wrapped in a flex column with the Footer as a
        // sibling (not a grid child) so the Impressum/Datenschutz/AGB links
        // stay reachable while logged out without disturbing the two-column
        // grid below.
        <div className="flex min-h-dvh flex-col bg-background">
            <div className="flex-1 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <AuthPanel
                    eyebrow={intl.formatMessage({ id: 'auth.panel.eyebrow' })}
                    headline={intl.formatMessage({ id: 'login.headline' })}
                    tagline={intl.formatMessage({ id: 'login.tagline' })}
                />

                <div className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-16">
                    <div className="mx-auto w-full max-w-sm">
                        {/* The brand mark stays lg:hidden — AuthPanel carries it
                            on desktop — but the language control does not.
                            /login and /register are the first pages a
                            logged-out visitor sees and were the only two
                            screens in the app with no way to change language
                            (found by the #219 verification pass: the toggle
                            lives in AppLayout, AdminLayout and LegalPage, none
                            of which wrap these two). */}
                        <div className="mb-8 flex items-center gap-2.5">
                            <div className="flex items-center gap-2.5 lg:hidden">
                                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                                    N
                                </span>
                                <span className="font-display text-lg font-semibold tracking-tight text-foreground">
                                    nutrilens
                                </span>
                            </div>
                            <LocaleToggle className="-mr-2 ml-auto" />
                        </div>

                        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
                            <FormattedMessage id="login.title" />
                        </h1>
                        {/* text-base, not text-sm: this is one full sentence of
                        prose under the page h1, not UI chrome — the same
                        "genuine prose" call CardDescription/EmptyState made
                        (see index.css's type-scale comment). */}
                        <p className="mt-2 text-base text-muted-foreground">
                            <FormattedMessage id="login.subtitle" />
                        </p>

                        <div className="mt-8 mb-6">
                            <OAuthButtons>
                                {/* The provider's own consent screen only covers the
                                grant to THEM — it says nothing about NutriLens's
                                own processing, so that disclosure has to live
                                here regardless. */}
                                <p className="text-xs text-muted-foreground">
                                    <FormattedMessage
                                        id="login.providerNotice"
                                        values={{
                                            terms: (chunks) => (
                                                <Link
                                                    to="/agb"
                                                    className="font-medium hover:text-foreground hover:underline"
                                                >
                                                    {chunks}
                                                </Link>
                                            ),
                                            privacy: (chunks) => (
                                                <Link
                                                    to="/datenschutz"
                                                    className="font-medium hover:text-foreground hover:underline"
                                                >
                                                    {chunks}
                                                </Link>
                                            ),
                                        }}
                                    />
                                </p>
                            </OAuthButtons>
                        </div>

                        <form
                            onSubmit={(e) => void handleSubmit(onSubmit)(e)}
                            className="flex flex-col gap-4"
                            noValidate
                        >
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="email">
                                    <FormattedMessage id="auth.email" />
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    autoComplete="email"
                                    placeholder={intl.formatMessage({ id: 'auth.emailPlaceholder' })}
                                    aria-invalid={!!errors.email}
                                    aria-describedby={errors.email ? 'email-error' : undefined}
                                    {...register('email')}
                                />
                                {errors.email && (
                                    <p id="email-error" role="alert" className="text-sm text-destructive">
                                        {errors.email.message}
                                    </p>
                                )}
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="password">
                                    <FormattedMessage id="auth.password" />
                                </Label>
                                <PasswordInput
                                    id="password"
                                    autoComplete="current-password"
                                    aria-invalid={!!errors.password}
                                    aria-describedby={errors.password ? 'password-error' : undefined}
                                    {...register('password')}
                                />
                                {errors.password && (
                                    <p id="password-error" role="alert" className="text-sm text-destructive">
                                        {errors.password.message}
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

                            {/* data-testid: the button's only handle is its label,
                                which is display copy #219 translates. */}
                            <Button
                                type="submit"
                                variant="default"
                                disabled={isSubmitting}
                                className="mt-2"
                                data-testid="login-submit"
                            >
                                <FormattedMessage id={isSubmitting ? 'login.submitting' : 'login.submit'} />
                            </Button>
                        </form>

                        <p className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
                            <FormattedMessage id="login.newHere" />{' '}
                            {/* text-primary on --background measures 4.36:1 — just under
                            the 4.5:1 AA floor for body text (see contrast notes in
                            auth-panel.tsx). text-foreground (17.96:1) carries the link at
                            rest; the accent only shows up on hover, a transient state SC
                            1.4.3 doesn't gate, with an underline so it's never colour-only. */}
                            <Link
                                to="/register"
                                className="font-semibold text-foreground hover:text-primary hover:underline"
                            >
                                <FormattedMessage id="login.createAccount" />
                            </Link>
                        </p>
                    </div>
                </div>
            </div>

            <Footer />
        </div>
    );
}
