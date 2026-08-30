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
// inside the regular one.
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
            <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
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
                <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-border lg:bg-card lg:py-6">
                    <div className="mb-4 flex items-center gap-2.5 px-5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                            N
                        </span>
                        <div>
                            <span className="block font-display text-xl font-semibold tracking-tight text-foreground">
                                nutrilens
                            </span>
                            <span className="block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                <FormattedMessage id="nav.adminSection" />
                            </span>
                        </div>
                    </div>

                    <Link
                        to="/"
                        className="mb-6 flex items-center gap-2 border-b border-border px-5 pb-6 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <ArrowLeft size={14} strokeWidth={2} />
                        <FormattedMessage id="nav.backToApp" />
                    </Link>

                    <nav
                        className="flex flex-1 flex-col px-2.5"
                        aria-label={intl.formatMessage({ id: 'nav.adminSection' })}
                    >
                        {ADMIN_NAV_ITEMS.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === '/admin'}
                                className={({ isActive }) =>
                                    cn(
                                        // A left accent rule instead of AppLayout's rounded pill —
                                        // reads as a dense ledger/ops-console row, distinct from the
                                        // user-facing nav even though every colour is the same token.
                                        'flex items-center gap-3 border-l-2 py-2.5 pr-3 pl-[calc(0.75rem-2px)] text-sm font-medium transition-colors',
                                        isActive
                                            ? 'border-accent bg-muted text-foreground font-semibold'
                                            : 'border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                                    )
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <item.icon size={18} strokeWidth={2} className={isActive ? 'text-accent' : ''} />
                                        <FormattedMessage id={item.labelId} />
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </nav>

                    <div className="mt-2 flex items-center gap-1 border-t border-border px-3 pt-4">
                        <Link to="/profile" className="flex min-w-0 flex-1 items-center gap-2.5">
                            <Avatar
                                name={user?.displayName ?? '?'}
                                seed={user?.id}
                                src={user?.avatarUrl}
                                size="md"
                            />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-foreground">
                                    {user?.displayName}
                                </p>
                                <p className="truncate text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                    {user && <FormattedMessage id={`role.${user.role}`} />}
                                </p>
                            </div>
                        </Link>
                        <LocaleToggle className="shrink-0" />
                        <button
                            onClick={logout}
                            aria-label={intl.formatMessage({ id: 'nav.logOut' })}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
                                        'flex w-full flex-col items-center gap-0.5 rounded-md py-1.5 text-[11px] font-medium transition-colors',
                                        isActive ? 'text-accent' : 'text-muted-foreground',
                                    )
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <item.icon size={20} strokeWidth={isActive ? 2.25 : 1.9} />
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
