import { ArrowLeft, ClipboardList, LayoutGrid, LogOut, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router';
import { Avatar } from '@/components/ui/avatar';
import { Footer } from '@/components/layout/footer';
import { useAuth } from '@/hooks/use-auth';
import { FOCUS_RING, cn } from '@/lib/utils';

// #105 — a shell distinct from AppLayout's, not the same nav with an
// admin badge tacked on: different sections (Overview/Users/Audit Log
// instead of Today/Log meal/Plan/Progress), and a visible "back to app"
// link, since this is a separate area an admin steps into, not a tab
// inside the regular one.
const ADMIN_NAV_ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
    { to: '/admin', label: 'Overview', icon: LayoutGrid },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/audit', label: 'Audit log', icon: ClipboardList },
];

export function AdminLayout() {
    const { user, logout } = useAuth();

    return (
        // Same lg: pinned-full-width-footer shell as AppLayout — see the
        // comment there for why it's scoped to lg: only.
        <div className="min-h-dvh bg-background lg:flex lg:h-dvh lg:flex-col">
            {/* First thing in the tab order, hidden off-canvas by a transform
                until focused. Without it a keyboard user had to tab through the
                whole sidebar (4 nav items, admin, profile, log out) on every
                single page before reaching any actual content. */}
            <a href="#main" className="skip-link">
                Skip to main content
            </a>
            <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
                <div className="flex items-center gap-2.5">
                    <Link to="/" aria-label="Back to app" className="text-muted-foreground">
                        <ArrowLeft size={20} strokeWidth={2} />
                    </Link>
                    <span className="font-display text-lg font-bold tracking-tight text-foreground">
                        Admin
                    </span>
                </div>
                <button
                    onClick={logout}
                    aria-label="Log out"
                    className={cn(
                        'flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                        FOCUS_RING,
                    )}
                >
                    <LogOut size={18} strokeWidth={2} />
                </button>
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
                                Admin
                            </span>
                        </div>
                    </div>

                    <Link
                        to="/"
                        className="mb-6 flex items-center gap-2 border-b border-border px-5 pb-6 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <ArrowLeft size={14} strokeWidth={2} />
                        Back to app
                    </Link>

                    <nav className="flex flex-1 flex-col gap-0.5 px-2.5" aria-label="Admin">
                        {ADMIN_NAV_ITEMS.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === '/admin'}
                                className={({ isActive }) =>
                                    cn(
                                        'flex items-center gap-3 rounded-md py-2.5 px-3 text-sm font-medium transition-colors',
                                        FOCUS_RING,
                                        isActive
                                            ? 'bg-secondary text-foreground font-semibold'
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                    )
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <item.icon size={18} strokeWidth={2} className={isActive ? 'text-accent' : ''} />
                                        {item.label}
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </nav>

                    <div className="mt-2 flex items-center gap-2.5 border-t border-border px-3 pt-4">
                        <Link to="/profile" className={cn('flex min-w-0 flex-1 items-center gap-2.5 rounded-md', FOCUS_RING)}>
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
                                    {user?.role}
                                </p>
                            </div>
                        </Link>
                        <button
                            onClick={logout}
                            aria-label="Log out"
                            className={cn(
                                'flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                                FOCUS_RING,
                            )}
                        >
                            <LogOut size={16} strokeWidth={2} />
                        </button>
                    </div>
                </aside>

                <main id="main" tabIndex={-1} className="pb-20 lg:min-w-0 lg:flex-1 lg:overflow-y-auto lg:pb-0">
                    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
                        <Outlet />
                        <Footer className="lg:hidden" />
                    </div>
                </main>
            </div>

            <nav
                aria-label="Admin"
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
                                        FOCUS_RING,
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
        </div>
    );
}
