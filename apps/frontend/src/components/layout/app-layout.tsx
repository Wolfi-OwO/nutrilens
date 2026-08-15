import { useState } from 'react';
import {
    BookOpen,
    Camera,
    LayoutGrid,
    LogOut,
    Plus,
    ShieldCheck,
    Target,
    TrendingUp,
    User,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/layout/footer';
import { OnboardingTutorial } from '@/components/onboarding-tutorial';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

// The two nav sets differ deliberately: the desktop top bar has room for the
// full destination names (Meal Plan), the mobile bottom bar is space-tight so
// it uses short labels and swaps an extra slot in for Profile (no dedicated
// topbar spot on the phone). Logging is NOT a nav destination — it is the
// single high-visibility "+ Log Food" CTA button on the right.
const DESKTOP_NAV: { to: string; label: string; icon: LucideIcon }[] = [
    { to: '/', label: 'Dashboard', icon: LayoutGrid },
    { to: '/plan', label: 'Meal Plan', icon: Target },
    { to: '/progress', label: 'Progress', icon: TrendingUp },
];

const MOBILE_NAV: { to: string; label: string; icon: LucideIcon }[] = [
    { to: '/', label: 'Dashboard', icon: LayoutGrid },
    { to: '/log-meal', label: 'Log', icon: Camera },
    { to: '/plan', label: 'Plan', icon: Target },
    { to: '/progress', label: 'Progress', icon: TrendingUp },
    { to: '/profile', label: 'Profile', icon: User },
];

export function AppLayout() {
    const { user, logout } = useAuth();
    const [guideOpen, setGuideOpen] = useState(false);

    if (!user) return null;

    return (
        // lg: becomes a viewport-height column so the footer is a shrink-0
        // last child pinned at the true bottom; below lg: it's a plain block
        // because the bottom tab nav owns the fixed-bottom strip there.
        <div className="min-h-dvh bg-background lg:flex lg:h-dvh lg:flex-col">
            {/* Sticky top bar, shared across breakpoints: brand + nav on
             desktop, a compact brand + actions strip on mobile. */}
            <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur">
                <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
                    <Link to="/" className="flex shrink-0 items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                            N
                        </span>
                        <div className="flex items-center gap-1.5">
                            <span className="font-display text-lg font-bold tracking-tight text-foreground">
                                NutriLens
                            </span>
                            <span className="hidden rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-primary uppercase sm:inline-block">
                                Beta
                            </span>
                        </div>
                    </Link>

                    <nav className="hidden items-center gap-1 lg:flex lg:pl-4" aria-label="Primary">
                        {DESKTOP_NAV.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === '/'}
                                className={({ isActive }) =>
                                    cn(
                                        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                        isActive
                                            ? 'bg-secondary text-foreground font-semibold'
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                    )
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <item.icon
                                            size={17}
                                            strokeWidth={2}
                                            className={isActive ? 'text-accent' : ''}
                                        />
                                        {item.label}
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </nav>

                    <div className="ml-auto flex items-center gap-1.5">
                        <Button asChild variant="default" className="hidden h-11 sm:inline-flex">
                            <Link to="/log-meal">
                                <Plus size={18} strokeWidth={2.25} />
                                Log Food
                            </Link>
                        </Button>

                        <button
                            type="button"
                            onClick={() => setGuideOpen(true)}
                            aria-label="Quick guide"
                            title="Quick guide"
                            className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <BookOpen size={18} strokeWidth={2} />
                        </button>

                        <ThemeToggle />

                        {user.role === 'admin' && (
                            <Link
                                to="/admin"
                                aria-label="Admin"
                                className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <ShieldCheck size={18} strokeWidth={2} />
                            </Link>
                        )}

                        <Link
                            to="/profile"
                            className={cn(
                                'ml-1 hidden items-center gap-2.5 rounded-full border border-border py-1 pl-1 pr-3 transition-colors hover:bg-muted sm:flex',
                            )}
                        >
                            <Avatar
                                name={user.displayName}
                                seed={user.id}
                                src={user.avatarUrl}
                                size="sm"
                            />
                            <span className="max-w-40 truncate text-sm font-medium text-foreground">
                                {user.displayName}
                            </span>
                        </Link>

                        <button
                            onClick={logout}
                            aria-label="Log out"
                            className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <LogOut size={18} strokeWidth={2} />
                        </button>
                    </div>
                </div>
            </header>

            <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                <main className="pb-24 lg:pb-10">
                    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
                        <Outlet />
                        <Footer className="lg:hidden" />
                    </div>
                </main>
            </div>

            <nav
                aria-label="Primary"
                className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-sm lg:hidden"
            >
                <ul className="mx-auto flex max-w-3xl justify-around px-2 py-1.5">
                    {MOBILE_NAV.map((item) => (
                        <li key={item.to} className="flex-1">
                            <NavLink
                                to={item.to}
                                end={item.to === '/'}
                                className={({ isActive }) =>
                                    cn(
                                        'flex w-full flex-col items-center gap-0.5 rounded-md py-1.5 text-[11px] font-medium transition-colors',
                                        isActive ? 'text-accent' : 'text-muted-foreground',
                                    )
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <item.icon size={20} strokeWidth={isActive ? 2.25 : 1.9} />
                                        {item.label}
                                    </>
                                )}
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </nav>

            <Footer className="hidden lg:flex lg:shrink-0" />

            <OnboardingTutorial open={guideOpen} onOpenChange={setGuideOpen} userId={user.id} />
        </div>
    );
}
