import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

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
        // for it below that), so the form itself never depends on it.
        <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <aside className="hidden flex-col justify-between border-r border-border bg-primary px-10 py-12 text-primary-foreground lg:flex">
                <span className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-foreground/10 text-sm font-semibold">
                        N
                    </span>
                    <span className="font-display text-xl font-semibold tracking-tight">
                        nutrilens
                    </span>
                </span>

                <div className="max-w-sm">
                    <p className="text-xs font-semibold tracking-wide text-primary-foreground/60 uppercase">
                        Vol. I — Nutrition, measured
                    </p>
                    <h2 className="mt-3 font-display text-4xl leading-tight font-medium">
                        Every plate tells a story.
                    </h2>
                </div>

                <p className="max-w-xs border-t border-primary-foreground/15 pt-4 text-sm text-primary-foreground/70">
                    Snap a photo of your meal — nutrilens reads the label so you don't have to.
                </p>
            </aside>

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
                                {...register('email')}
                            />
                            {errors.email && (
                                <p className="text-sm text-destructive">{errors.email.message}</p>
                            )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                autoComplete="current-password"
                                aria-invalid={!!errors.password}
                                {...register('password')}
                            />
                            {errors.password && (
                                <p className="text-sm text-destructive">{errors.password.message}</p>
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

                        <Button type="submit" variant="accent" disabled={isSubmitting} className="mt-2">
                            {isSubmitting ? 'Logging in…' : 'Log in'}
                        </Button>
                    </form>

                    <p className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
                        New to nutrilens?{' '}
                        <Link to="/register" className="font-medium text-primary hover:underline">
                            Create an account
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
