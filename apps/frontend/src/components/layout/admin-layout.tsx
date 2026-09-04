import { ArrowLeft, ClipboardList, LayoutGrid, LogOut, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Link, NavLink, Outlet } from 'react-router';
import { Avatar } from '@/components/ui/avatar';
import { Footer } from '@/components/layout/footer';
import { LocaleToggle } from '@/components/locale-toggle';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

// #105 — a shell distinct from AppLayout's, not the same nav with an
// admin badge tacked on: different sections (Overview/Users/Audit Log
// instead of Today/Log meal/Plan/Progress), and a visible "back to app"
// link, since this is a separate area an admin steps into, not a tab
// inside the regular one. The desktop aside is a 92px icon rail (see below)
// rather than AppLayout's top bar — an ops console reads as a narrower,
// denser instrument than the consumer-facing shell it sits next to.
const ADMIN_NAV_ITEMS: { to: string; labelId: string; icon: LucideIcon }[] = [
    { to: '/admin', labelId: 'nav.adminOverview', icon: LayoutGrid },
    { to: '/admin/users', labelId: 'nav.adminUsers', icon: Users },
    { to: '/admin/audit', labelId: 'nav.adminAuditLog', icon: ClipboardList },
];

export function AdminLayout() {
    const { user, logout } = useAuth();
    const intl = useIntl();

    return (
        // Same lg: pinned-full-width-footer shell as AppLayout — see the
        // comment there for why it's scoped to lg: only.
        <div className="min-h-dvh bg-background lg:flex lg:h-dvh lg:flex-col">
            <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 shadow-elev-1 lg:hidden">
                <div className="flex items-center gap-2.5">
                    <Link
                        to="/"
                        aria-label={intl.formatMessage({ id: 'nav.backToApp' })}
                        className="text-muted-foreground"
                    >
                        <ArrowLeft size={20} strokeWidth={2} />
                    </Link>
                    <span className="font-display text-lg font-bold tracking-tight text-foreground">
                        <FormattedMessage id="nav.adminSection" />
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <LocaleToggle />
                    <button
                        onClick={logout}
                        aria-label={intl.formatMessage({ id: 'nav.logOut' })}
                        className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <LogOut size={18} strokeWidth={2} />
                    </button>
                </div>
            </header>

            <div className="lg:flex lg:min-h-0 lg:flex-1">
                {/* 92px icon rail, Werkbank's vertical-tab-bar language — icon on
                    top, label under, active state a solid cobalt block. Replaces
                    the old w-64 text sidebar with icon+label ROWS and a
                    left-accent-rule active state; this is a genuine redesign of
                    that treatment, not a restyle of it, per the plan. A wordmark
                    doesn't fit 92px, so the brand mark drops to the "N" glyph
                    alone (the mobile header below still carries the full name),
                    and every destination label is short enough in both locales
                    (checked against de.ts/en.ts) to read as one or two centered
                    lines rather than truncating. */}
                <aside className="hidden lg:flex lg:w-[92px] lg:shrink-0 lg:flex-col lg:items-center lg:border-r lg:border-border lg:bg-card lg:py-4">
                    <Link
                        to="/"
                        aria-label="NutriLens"
                        className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground"
                    >
                        N
                    </Link>
                    <span className="mb-4 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
                        <FormattedMessage id="nav.adminSection" />
                    </span>

                    <Link
                        to="/"
                        title={intl.formatMessage({ id: 'nav.backToApp' })}
                        className="mb-3 flex w-full flex-col items-center gap-1 border-b border-border px-1.5 pb-3 text-center text-2xs leading-tight font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <ArrowLeft size={18} strokeWidth={2} />
                        <FormattedMessage id="nav.backToApp" />
                    </Link>

                    <nav
                        className="flex w-full flex-1 flex-col items-center gap-1.5 px-2"
                        aria-label={intl.formatMessage({ id: 'nav.adminSection' })}
                    >
                        {ADMIN_NAV_ITEMS.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === '/admin'}
                                className={({ isActive }) =>
                                    cn(
                                        // Solid cobalt block, not the old border-l-2 rule —
                                        // same active-state signature as AppLayout's desktop
                                        // nav, so the app reads as one instrument regardless
                                        // of which shell is on screen.
                                        'flex w-full flex-col items-center gap-1 rounded-xl py-2.5 text-center text-2xs leading-tight font-medium transition-colors',
                                        isActive
                                            ? 'bg-primary text-primary-foreground font-semibold shadow-elev-1'
                                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                                    )
                                }
                            >
                                <item.icon size={20} strokeWidth={2} />
                                <FormattedMessage id={item.labelId} />
                            </NavLink>
                        ))}
                    </nav>

                    {/* No name/role text below the avatar — 92px has no room for
                        it without truncating to illegibility, so it moves to a
                        native title tooltip instead of disappearing outright. */}
                    <div className="mt-2 flex w-full flex-col items-center gap-2 border-t border-border px-2 pt-3">
                        <Link
                            to="/profile"
                            title={
                                user
                                    ? `${user.displayName} · ${intl.formatMessage({ id: `role.${user.role}` })}`
                                    : undefined
                            }
                            /* Was `transition-opacity hover:opacity-80`. Avatar renders
                               initials, so the fade dimmed text on an ancestor — same
                               3.81:1 settled measurement as the footer pill. A ring is
                               the stronger affordance here anyway: it reads on an image
                               avatar too, where dimming just looks like a load state. */
                            className="rounded-full transition-shadow hover:ring-2 hover:ring-ring hover:ring-offset-2 hover:ring-offset-card"
                        >
                            <Avatar
                                name={user?.displayName ?? '?'}
                                seed={user?.id}
                                src={user?.avatarUrl}
                                size="sm"
                            />
                        </Link>
                        <LocaleToggle />
                        <button
                            onClick={logout}
                            aria-label={intl.formatMessage({ id: 'nav.logOut' })}
                            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <LogOut size={16} strokeWidth={2} />
                        </button>
                    </div>
                </aside>

                <main className="pb-20 lg:min-w-0 lg:flex-1 lg:overflow-y-auto lg:pb-0">
                    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
                        <Outlet />
                        <Footer className="lg:hidden" />
                    </div>
                </main>
            </div>

            <nav
                aria-label={intl.formatMessage({ id: 'nav.adminSection' })}
                className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card/95 backdrop-blur-sm lg:hidden"
            >
                <ul className="mx-auto flex max-w-3xl justify-around px-2 py-1.5">
                    {ADMIN_NAV_ITEMS.map((item) => (
                        <li key={item.to} className="flex-1">
                            <NavLink
                                to={item.to}
                                end={item.to === '/admin'}
                                className={({ isActive }) =>
                                    cn(
                                        'flex w-full flex-col items-center gap-0.5 py-1.5 text-2xs font-medium transition-colors',
                                        isActive ? 'text-primary' : 'text-muted-foreground',
                                    )
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        {/* Same scaled-down rail echo as AppLayout's mobile
                                            tab bar — see the comment there. */}
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
                    ))}
                </ul>
            </nav>

            <Footer className="hidden lg:flex lg:shrink-0" />
        </div>
    );
}
