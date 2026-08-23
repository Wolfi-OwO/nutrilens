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
// topbar spot on the phone). On desktop, logging is the single
// high-visibility "+ Log Food" CTA button on the right, not a nav item. On
// mobile there's no room for a separate CTA button next to the tab bar, so
// Log is IN the bar but centered and raised — a camera FAB, not one item
// among five equals (see the `primary` branch below).
const DESKTOP_NAV: { to: string; label: string; icon: LucideIcon }[] = [
    { to: '/', label: 'Dashboard', icon: LayoutGrid },
    { to: '/plan', label: 'Meal Plan', icon: Target },
    { to: '/progress', label: 'Progress', icon: TrendingUp },
];

const MOBILE_NAV: { to: string; label: string; icon: LucideIcon; primary?: boolean }[] = [
    { to: '/', label: 'Dashboard', icon: LayoutGrid },
    { to: '/plan', label: 'Plan', icon: Target },
    { to: '/log-meal', label: 'Log', icon: Camera, primary: true },
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
            {/* First in tab order, ahead of the header — a sighted mouse
                user never sees it (sr-only until :focus), a keyboard user
                tabbing in lands here first and can jump straight past the
                header/nav to the page content. */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
            >
                Skip to content
            </a>

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
                            {/* text-primary here only reached 3.84:1 against the
                                composited bg-primary/10 tint (measured — see
                                --primary-strong in index.css), under the 4.5:1 AA
                                floor for this 10px text. text-primary-strong clears
                                it at 5.56:1+ in every surface this badge sits on. */}
                            <span className="hidden rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-primary-strong uppercase sm:inline-block">
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
                        {/* The one lens-glow button in the shell — reserved for the
                            product's actual differentiator (photo logging), not spent
                            on anything else. */}
                        <Button
                            asChild
                            variant="default"
                            className="lens-glow hidden h-11 sm:inline-flex"
                        >
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
                {/* id/tabIndex is the skip link's landing target — an href-only
                    anchor scrolls but never moves keyboard focus, so a
                    non-focusable <main> would leave a keyboard user's focus
                    still sitting on the skip link after "using" it. */}
                <main id="main-content" tabIndex={-1} className="pb-24 lg:pb-10">
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
                <ul className="relative mx-auto flex max-w-3xl justify-around px-2 py-1.5">
                    {MOBILE_NAV.map((item) =>
                        item.primary ? (
                            // Empty same-width spacer keeps the four real tabs evenly
                            // spaced around the FAB, which renders separately below,
                            // absolutely positioned — that lets it rise above the bar
                            // without fighting flexbox cross-axis alignment for height.
                            <li key={item.to} aria-hidden="true" className="flex-1" />
                        ) : (
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
                        ),
                    )}

                    {/* The raised camera FAB itself — still a real <li>, an <a>
                        can't be a direct child of <ul> without one (list/listitem
                        structure). The <li> covers the whole bar (inset-0) and is
                        non-interactive except where the link re-enables pointer
                        events, so it can center-and-rise above the bar without
                        disturbing the flex row underneath it. */}
                    <li className="pointer-events-none absolute inset-0 flex items-start justify-center">
                        <NavLink
                            to="/log-meal"
                            className="group pointer-events-auto -mt-6 flex flex-col items-center gap-1"
                        >
                            {({ isActive }) => (
                                <>
                                    <span
                                        className={cn(
                                            'flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 lens-glow-strong transition-transform group-active:scale-95',
                                            isActive && 'ring-2 ring-accent ring-offset-2 ring-offset-background',
                                        )}
                                    >
                                        <Camera size={24} strokeWidth={2.25} />
                                    </span>
                                    <span
                                        className={cn(
                                            'text-[11px] font-semibold',
                                            isActive ? 'text-accent' : 'text-foreground',
                                        )}
                                    >
                                        Log
                                    </span>
                                </>
                            )}
                        </NavLink>
                    </li>
                </ul>
            </nav>

            <Footer className="hidden lg:flex lg:shrink-0" />

            <OnboardingTutorial open={guideOpen} onOpenChange={setGuideOpen} userId={user.id} />
        </div>
    );
}
