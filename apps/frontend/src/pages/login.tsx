import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Footer } from '@/components/layout/footer';
import { AuthPanel } from '@/components/auth/auth-panel';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { useAuth } from '@/hooks/use-auth';
import { ApiError } from '@/lib/api-client';

const loginSchema = z.object({
    email: z.string().min(1, 'Email is required.').email('Enter a valid email address.'),
    password: z.string().min(1, 'Password is required.'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
    const { user, login } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [formError, setFormError] = useState<string | null>(searchParams.get('error'));

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginForm>({
        resolver: zodResolver(loginSchema),
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
                    : 'Something went wrong. Please try again.',
            );
        }
    };

    return (
        // Asymmetric editorial split, not a centred card on a gradient — the
        // masthead panel only appears at lg: (a fixed brand mark stands in
        // for it below that), so the form itself never depends on it. Wrapped
        // in a flex column with the Footer as a sibling (not a grid child) so
        // the Impressum/Datenschutz/AGB links stay reachable while logged
        // out without disturbing the two-column grid below.
        <div className="flex min-h-dvh flex-col bg-background">
            <div className="flex-1 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <AuthPanel
                    eyebrow="Calorie & macro tracking"
                    headline="Know exactly what you eat."
                    tagline="Snap a photo of your meal and get the nutrition back in seconds."
                />

                <div className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-16">
                    <div className="mx-auto w-full max-w-sm">
                        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
                            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                                N
                            </span>
                            <span className="font-display text-lg font-semibold tracking-tight text-foreground">
                                nutrilens
                            </span>
                        </div>

                        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
                            Welcome back
                        </h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Log in to keep tracking your meals.
                        </p>

                        <div className="mt-8">
                            <OAuthButtons />
                            {/* The provider's own consent screen only covers the
                            grant to THEM — it says nothing about NutriLens's
                            own processing, so that disclosure has to live
                            here regardless. */}
                            <p className="mt-3 text-xs text-muted-foreground">
                                Continuing with a provider creates or signs in to your NutriLens
                                account under our{' '}
                                <Link
                                    to="/agb"
                                    className="font-medium hover:text-foreground hover:underline"
                                >
                                    Terms
                                </Link>{' '}
                                and{' '}
                                <Link
                                    to="/datenschutz"
                                    className="font-medium hover:text-foreground hover:underline"
                                >
                                    Privacy Policy
                                </Link>
                                .
                            </p>
                        </div>

                        <form
                            onSubmit={(e) => void handleSubmit(onSubmit)(e)}
                            className="flex flex-col gap-4"
                            noValidate
                        >
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    autoComplete="email"
                                    placeholder="you@example.com"
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
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
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
                                    className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
                                >
                                    {formError}
                                </p>
                            )}

                            <Button
                                type="submit"
                                variant="default"
                                disabled={isSubmitting}
                                className="mt-2"
                            >
                                {isSubmitting ? 'Logging in…' : 'Log in'}
                            </Button>
                        </form>

                        <p className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
                            New to nutrilens?{' '}
                            {/* text-primary on --background measures 4.36:1 — just under
                            the 4.5:1 AA floor for body text (see contrast notes in
                            auth-panel.tsx). text-foreground (17.96:1) carries the link at
                            rest; the accent only shows up on hover, a transient state SC
                            1.4.3 doesn't gate, with an underline so it's never colour-only. */}
                            <Link
                                to="/register"
                                className="font-semibold text-foreground hover:text-primary hover:underline"
                            >
                                Create an account
                            </Link>
                        </p>
                    </div>
                </div>
            </div>

            <Footer />
        </div>
    );
}
