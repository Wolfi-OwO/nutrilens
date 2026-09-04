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
import { FormattedMessage, useIntl } from 'react-intl';
import { Link, NavLink, Outlet } from 'react-router';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/layout/footer';
import { LocaleToggle } from '@/components/locale-toggle';
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
//
// The two label sets are separate message ids, not one id reused: German runs
// ~30% longer than English, and "Ernährungsplan" (the desktop label) does not
// fit a fifth of a 390px tab bar, so the mobile bar keeps its own short form
// ("Plan") in both languages rather than inheriting the desktop wording.
const DESKTOP_NAV: { to: string; labelId: string; icon: LucideIcon }[] = [
    { to: '/', labelId: 'nav.dashboard', icon: LayoutGrid },
    { to: '/plan', labelId: 'nav.mealPlan', icon: Target },
    { to: '/progress', labelId: 'nav.progress', icon: TrendingUp },
];

const MOBILE_NAV: { to: string; labelId: string; icon: LucideIcon; primary?: boolean }[] = [
    { to: '/', labelId: 'nav.dashboard', icon: LayoutGrid },
    { to: '/plan', labelId: 'nav.plan', icon: Target },
    { to: '/log-meal', labelId: 'nav.log', icon: Camera, primary: true },
    { to: '/progress', labelId: 'nav.progress', icon: TrendingUp },
    { to: '/profile', labelId: 'nav.profile', icon: User },
];

export function AppLayout() {
    const { user, logout } = useAuth();
    const [guideOpen, setGuideOpen] = useState(false);
    const intl = useIntl();

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
                <FormattedMessage id="common.skipToContent" />
            </a>

            {/* Sticky top bar, shared across breakpoints: brand + nav on
             desktop, a compact brand + actions strip on mobile. shadow-elev-1
             (not just border-b) is what separates the bar from scrolled
             content on the dark ground, where a 1px border alone reads
             almost flat — same reasoning as Card's shadow-elev-1 use. */}
            <header className="sticky top-0 z-40 border-b border-border bg-card/90 shadow-elev-1 backdrop-blur">
                <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
                    <Link to="/" className="flex shrink-0 items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                            N
                        </span>
                        {/* The wordmark is dropped below 360px. Measured, not
                            guessed: at a 320px viewport the header's action
                            cluster ran to 351px, which put the whole log-out
                            button outside the viewport and gave EVERY signed-in
                            page a horizontally scrolling document. The wordmark
                            plus its gap is ~103px of that; without it the header
                            measures 294px and nothing overflows. The N tile still
                            carries the brand and still links home, which is what
                            every phone-width app header does anyway. */}
                        <div className="flex items-center gap-1.5">
                            <span className="hidden font-display text-lg font-bold tracking-tight text-foreground min-[360px]:inline">
                                NutriLens
                            </span>
                            {/* text-primary here only reached 3.84:1 against the
                                composited bg-primary/10 tint (measured — see
                                --primary-strong in index.css), under the 4.5:1 AA
                                floor for this 10px text. text-primary-strong clears
                                it at 5.56:1+ in every surface this badge sits on. */}
                            <span className="hidden rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-primary-strong uppercase sm:inline-block">
                                <FormattedMessage id="nav.beta" />
                            </span>
                        </div>
                    </Link>

                    <nav
                        className="hidden items-center gap-1 lg:flex lg:pl-4"
                        aria-label={intl.formatMessage({ id: 'nav.primary' })}
                    >
                        {DESKTOP_NAV.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === '/'}
                                // Active tab is a solid cobalt block, not a tint chip —
                                // Werkbank's active-state signature (see the icon rail
                                // in admin-layout.tsx for the same language at a
                                // smaller scale). Icon color is no longer overridden
                                // per-state: it inherits the item's own text color
                                // (primary-foreground active, muted-foreground rest),
                                // which is simpler than a second ternary once the whole
                                // row already carries the state color.
                                className={({ isActive }) =>
                                    cn(
                                        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                        isActive
                                            ? 'bg-primary text-primary-foreground font-semibold'
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                    )
                                }
                            >
                                <item.icon size={17} strokeWidth={2} />
                                <FormattedMessage id={item.labelId} />
                            </NavLink>
                        ))}
                    </nav>

                    <div className="ml-auto flex items-center gap-1.5">
                        {/* data-testid on the three shell controls the e2e suite
                            drives (this CTA, the admin shield, log out): their only
                            handles today are display copy ("Log Food") or an
                            aria-label that is display copy ("Admin", "Log out"),
                            and #219 translates all three. Only the desktop CTA is
                            tagged — the mobile bottom-nav link to the same route is
                            a separate element, and tagging both would make the
                            locator ambiguous.

                            This is a cobalt CTA, so it gets .cta-glow, not
                            .lens-glow or .fab-glow — the camera FAB below gets
                            .fab-glow, cobalt in light and lime in dark (see
                            index.css's .fab-glow comment for why the two themes
                            differ), and .lens-glow remains for the two
                            lime-on-neutral consumers in log-meal.tsx (see
                            index.css's .cta-glow comment for the token this CTA
                            reads). */}
                        <Button
                            asChild
                            variant="default"
                            className="cta-glow hidden h-11 sm:inline-flex"
                        >
                            <Link to="/log-meal" data-testid="nav-log-food">
                                <Plus size={18} strokeWidth={2.25} />
                                <FormattedMessage id="nav.logFood" />
                            </Link>
                        </Button>

                        <button
                            type="button"
                            onClick={() => setGuideOpen(true)}
                            aria-label={intl.formatMessage({ id: 'nav.quickGuide' })}
                            title={intl.formatMessage({ id: 'nav.quickGuide' })}
                            className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <BookOpen size={18} strokeWidth={2} />
                        </button>

                        <LocaleToggle />

                        <ThemeToggle />

                        {user.role === 'admin' && (
                            <Link
                                to="/admin"
                                aria-label={intl.formatMessage({ id: 'nav.admin' })}
                                data-testid="nav-admin"
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
                            aria-label={intl.formatMessage({ id: 'nav.logOut' })}
                            data-testid="nav-logout"
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
                aria-label={intl.formatMessage({ id: 'nav.primary' })}
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
                                            'flex w-full flex-col items-center gap-0.5 py-1.5 text-2xs font-medium transition-colors',
                                            isActive ? 'text-primary' : 'text-muted-foreground',
                                        )
                                    }
                                >
                                    {({ isActive }) => (
                                        <>
                                            {/* A scaled-down echo of the rail's solid-block
                                                active state (admin-layout.tsx) — a tint chip
                                                here rather than a full solid fill, since a
                                                cobalt block this small (20px icon) would read
                                                as a dot, not a tab. */}
                                            <span
                                                className={cn(
                                                    'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                                                    isActive && 'bg-primary/15',
                                                )}
                                            >
                                                <item.icon size={20} strokeWidth={isActive ? 2.25 : 1.9} />
                                            </span>
                                            <FormattedMessage id={item.labelId} />
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
                                            'flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 fab-glow transition-transform group-active:scale-95',
                                            isActive && 'ring-2 ring-accent ring-offset-2 ring-offset-background',
                                        )}
                                    >
                                        <Camera size={24} strokeWidth={2.25} />
                                    </span>
                                    <span
                                        className={cn(
                                            'text-2xs font-semibold',
                                            isActive ? 'text-accent' : 'text-foreground',
                                        )}
                                    >
                                        <FormattedMessage id="nav.log" />
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
