import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { FormattedMessage, useIntl } from 'react-intl';
import type { IntlShape } from 'react-intl';
import { z } from 'zod';
import { Link, Navigate, useNavigate } from 'react-router';
import { Check, X } from 'lucide-react';
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

// Mirrors UserService.MIN_PASSWORD_LENGTH (apps/api/src/services/user-service.ts)
// — the only real server-side rule. Client-side validation is UX only; the
// server re-validates independently, so this constant just needs to match
// what the server actually enforces, not invent stricter rules of its own.
const MIN_PASSWORD_LENGTH = 8;

// Rebuilt per render from the active locale — see the same note in login.tsx:
// zod bakes the message in at schema-construction time, so a module-level
// schema would keep the language it was first evaluated in.
function buildRegisterSchema(intl: IntlShape) {
    return z.object({
        displayName: z.string().min(1, intl.formatMessage({ id: 'auth.validation.nameRequired' })),
        email: z
            .string()
            .min(1, intl.formatMessage({ id: 'auth.validation.emailRequired' }))
            .email(intl.formatMessage({ id: 'auth.validation.emailInvalid' })),
        password: z
            .string()
            .min(
                MIN_PASSWORD_LENGTH,
                intl.formatMessage(
                    { id: 'auth.validation.passwordTooShort' },
                    { count: MIN_PASSWORD_LENGTH },
                ),
            ),
    });
}

type RegisterForm = z.infer<ReturnType<typeof buildRegisterSchema>>;

export default function RegisterPage() {
    const { user, register: registerAccount } = useAuth();
    const intl = useIntl();
    const navigate = useNavigate();
    const [formError, setFormError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<RegisterForm>({
        resolver: zodResolver(buildRegisterSchema(intl)),
        // See login.tsx for the same reasoning: check a field once the
        // person leaves it, not on every keystroke, then keep re-checking
        // once an error is already showing.
        mode: 'onBlur',
        reValidateMode: 'onChange',
    });
    const passwordValue = watch('password') ?? '';
    const passwordMeetsLength = passwordValue.length >= MIN_PASSWORD_LENGTH;

    if (user) return <Navigate to="/" replace />;

    const onSubmit = async (values: RegisterForm) => {
        setFormError(null);
        try {
            await registerAccount(values.email, values.password, values.displayName);
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
        // Same re-decision as login.tsx: the 2fr/3fr split survives as an
        // "unequal bento span", never a centred card on a gradient; only the
        // copy differs from login.tsx. Wrapped in a flex column with Footer
        // as a sibling (not a grid child), same reasoning as login.tsx: the
        // legal links must survive outside the two-column grid below.
        <div className="flex min-h-dvh flex-col bg-background">
            <div className="flex-1 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <AuthPanel
                    eyebrow={intl.formatMessage({ id: 'auth.panel.eyebrow' })}
                    headline={intl.formatMessage({ id: 'register.headline' })}
                    tagline={intl.formatMessage({ id: 'register.tagline' })}
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
                            <FormattedMessage id="register.title" />
                        </h1>
                        {/* text-base: genuine prose under the h1, same call as
                        login.tsx's subtitle. */}
                        <p className="mt-2 text-base text-muted-foreground">
                            <FormattedMessage id="register.subtitle" />
                        </p>

                        <div className="mt-8 mb-6">
                            <OAuthButtons>
                                {/* The provider's own consent screen only covers the
                                grant to THEM — it says nothing about NutriLens's
                                own processing, so that disclosure has to live
                                here regardless. */}
                                <p className="text-xs text-muted-foreground">
                                    <FormattedMessage
                                        id="register.providerNotice"
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
                                <Label htmlFor="displayName">
                                    <FormattedMessage id="auth.name" />
                                </Label>
                                <Input
                                    id="displayName"
                                    autoComplete="name"
                                    placeholder={intl.formatMessage({ id: 'auth.namePlaceholder' })}
                                    aria-invalid={!!errors.displayName}
                                    aria-describedby={errors.displayName ? 'displayName-error' : undefined}
                                    {...register('displayName')}
                                />
                                {errors.displayName && (
                                    <p id="displayName-error" role="alert" className="text-sm text-destructive">
                                        {errors.displayName.message}
                                    </p>
                                )}
                            </div>

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
                                    autoComplete="new-password"
                                    aria-invalid={!!errors.password}
                                    aria-describedby={
                                        errors.password
                                            ? 'password-requirement password-error'
                                            : 'password-requirement'
                                    }
                                    {...register('password')}
                                />
                                {/* Requirement is visible before submission, not just after
                                rejection, and the valid state gets its own feedback (a check
                                icon + "met" text for screen readers) rather than relying on
                                colour alone to say the field is fine now. */}
                                <p
                                    id="password-requirement"
                                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                                >
                                    {passwordMeetsLength ? (
                                        <Check
                                            size={14}
                                            strokeWidth={2.5}
                                            className="text-accent"
                                            aria-hidden="true"
                                        />
                                    ) : (
                                        <X size={14} strokeWidth={2.5} aria-hidden="true" />
                                    )}
                                    <FormattedMessage
                                        id="register.passwordRequirement"
                                        values={{ count: MIN_PASSWORD_LENGTH }}
                                    />
                                    <span className="sr-only">
                                        <FormattedMessage
                                            id={
                                                passwordMeetsLength
                                                    ? 'register.requirementMet'
                                                    : 'register.requirementNotMet'
                                            }
                                        />
                                    </span>
                                </p>
                                {errors.password && (
                                    <p id="password-error" role="alert" className="text-sm text-destructive">
                                        {errors.password.message}
                                    </p>
                                )}
                            </div>

                            {/* data-testid on both the submit button and this error
                                line: the button's handle is its label and the
                                error's is the message text, and #219 translates
                                both. The message itself comes from the API, so a
                                test asserting *which* error this is checks the
                                response status instead of matching wording. */}
                            {formError && (
                                <p
                                    role="alert"
                                    data-testid="register-error"
                                    className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive-strong"
                                >
                                    {formError}
                                </p>
                            )}

                            {/* Art. 13 GDPR notice at the actual point of
                            collection — the fields above this line are the
                            first personal data NutriLens ever collects from
                            this person, so the notice sits directly before
                            the submit action rather than in a footer link
                            they'd have to go looking for. */}
                            <p className="text-xs text-muted-foreground">
                                <FormattedMessage
                                    id="register.gdprNotice"
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

                            <Button
                                type="submit"
                                variant="default"
                                disabled={isSubmitting}
                                className="mt-2"
                                data-testid="register-submit"
                            >
                                <FormattedMessage
                                    id={isSubmitting ? 'register.submitting' : 'register.submit'}
                                />
                            </Button>
                        </form>

                        <p className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
                            <FormattedMessage id="register.haveAccount" />{' '}
                            {/* Same fix as login.tsx's "Create an account" link — see the
                            comment there. text-primary on --background is 4.36:1, under
                            AA's 4.5:1 floor for this text size. */}
                            <Link
                                to="/login"
                                className="font-semibold text-foreground hover:text-primary hover:underline"
                            >
                                <FormattedMessage id="register.logIn" />
                            </Link>
                        </p>
                    </div>
                </div>
            </div>

            <Footer />
        </div>
    );
}
