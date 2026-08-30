import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Link, Navigate, useNavigate } from 'react-router';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Footer } from '@/components/layout/footer';
import { AuthPanel } from '@/components/auth/auth-panel';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { useAuth } from '@/hooks/use-auth';
import { ApiError } from '@/lib/api-client';

// Mirrors UserService.MIN_PASSWORD_LENGTH (apps/api/src/services/user-service.ts)
// — the only real server-side rule. Client-side validation is UX only; the
// server re-validates independently, so this constant just needs to match
// what the server actually enforces, not invent stricter rules of its own.
const MIN_PASSWORD_LENGTH = 8;

const registerSchema = z.object({
    displayName: z.string().min(1, 'Name is required.'),
    email: z.string().min(1, 'Email is required.').email('Enter a valid email address.'),
    password: z
        .string()
        .min(MIN_PASSWORD_LENGTH, `Password must be at least ${String(MIN_PASSWORD_LENGTH)} characters.`),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
    const { user, register: registerAccount } = useAuth();
    const navigate = useNavigate();
    const [formError, setFormError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<RegisterForm>({
        resolver: zodResolver(registerSchema),
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
                    : 'Something went wrong. Please try again.',
            );
        }
    };

    return (
        // Same AuthPanel as login.tsx, different copy. Wrapped in a flex
        // column with Footer as a sibling (not a grid child), same
        // reasoning as login.tsx: the legal links must survive outside the
        // two-column grid below.
        <div className="flex min-h-dvh flex-col bg-background">
            <div className="flex-1 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <AuthPanel
                    eyebrow="Calorie & macro tracking"
                    headline="Start tracking in seconds."
                    tagline="Log meals from a single photo and build a plan that fits your goals."
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
                            Create your account
                        </h1>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Start tracking meals with a photo in seconds.
                        </p>

                        <div className="mt-8">
                            <OAuthButtons />
                            {/* The provider's own consent screen only covers the
                            grant to THEM — it says nothing about NutriLens's
                            own processing, so that disclosure has to live
                            here regardless. */}
                            <p className="mt-3 text-xs text-muted-foreground">
                                Continuing with a provider creates your NutriLens account under our{' '}
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
                                <Label htmlFor="displayName">Name</Label>
                                <Input
                                    id="displayName"
                                    autoComplete="name"
                                    placeholder="Alex Rivera"
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
                                    At least {MIN_PASSWORD_LENGTH} characters
                                    <span className="sr-only">
                                        {passwordMeetsLength ? ' — met' : ' — not yet met'}
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
                                    className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
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
                                By creating an account you agree to our{' '}
                                <Link
                                    to="/agb"
                                    className="font-medium hover:text-foreground hover:underline"
                                >
                                    Terms
                                </Link>{' '}
                                and confirm you&apos;ve read our{' '}
                                <Link
                                    to="/datenschutz"
                                    className="font-medium hover:text-foreground hover:underline"
                                >
                                    Privacy Policy
                                </Link>
                                . Body-weight tracking uses a separate consent step the first time
                                you log a weight entry.
                            </p>

                            <Button
                                type="submit"
                                variant="default"
                                disabled={isSubmitting}
                                className="mt-2"
                                data-testid="register-submit"
                            >
                                {isSubmitting ? 'Creating account…' : 'Create account'}
                            </Button>
                        </form>

                        <p className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
                            Already have an account?{' '}
                            {/* Same fix as login.tsx's "Create an account" link — see the
                            comment there. text-primary on --background is 4.36:1, under
                            AA's 4.5:1 floor for this text size. */}
                            <Link
                                to="/login"
                                className="font-semibold text-foreground hover:text-primary hover:underline"
                            >
                                Log in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>

            <Footer />
        </div>
    );
}
