import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Link, Navigate, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { useAuth } from '@/hooks/use-auth';
import { ApiError } from '@/lib/api-client';

const registerSchema = z.object({
    displayName: z.string().min(1, 'Name is required.'),
    email: z.string().min(1, 'Email is required.').email('Enter a valid email address.'),
    password: z.string().min(8, 'Password must be at least 8 characters.'),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
    const { user, register: registerAccount } = useAuth();
    const navigate = useNavigate();
    const [formError, setFormError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

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
                    : 'Something went wrong. Please try again.',
            );
        }
    };

    return (
        // Same asymmetric split as login.tsx — kept as sibling markup rather
        // than a shared layout component, since the two masthead panels
        // carry different copy and this is the only page that needs it.
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
                        Calorie & macro tracking
                    </p>
                    <h2 className="mt-3 font-display text-4xl leading-tight font-bold">
                        Start tracking in seconds.
                    </h2>
                </div>

                <p className="max-w-xs border-t border-primary-foreground/15 pt-4 text-sm text-primary-foreground/70">
                    Log meals from a single photo and build a plan that fits your goals.
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
                        Create your account
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Start tracking meals with a photo in seconds.
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
                            <Label htmlFor="displayName">Name</Label>
                            <Input
                                id="displayName"
                                autoComplete="name"
                                placeholder="Alex Rivera"
                                aria-invalid={!!errors.displayName}
                                {...register('displayName')}
                            />
                            {errors.displayName && (
                                <p className="text-sm text-destructive">
                                    {errors.displayName.message}
                                </p>
                            )}
                        </div>

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
                                autoComplete="new-password"
                                aria-invalid={!!errors.password}
                                {...register('password')}
                            />
                            {errors.password ? (
                                <p className="text-sm text-destructive">
                                    {errors.password.message}
                                </p>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    At least 8 characters.
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

                        <Button type="submit" variant="default" disabled={isSubmitting} className="mt-2">
                            {isSubmitting ? 'Creating account…' : 'Create account'}
                        </Button>
                    </form>

                    <p className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
                        Already have an account?{' '}
                        <Link to="/login" className="font-medium text-primary hover:underline">
                            Log in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
