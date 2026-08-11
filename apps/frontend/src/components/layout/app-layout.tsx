import { Camera, LayoutGrid, LogOut, ShieldCheck, Target, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router';
import { Avatar } from '@/components/ui/avatar';
import { Footer } from '@/components/layout/footer';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

const NAV_ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
    { to: '/', label: 'Today', icon: LayoutGrid },
    { to: '/log-meal', label: 'Log meal', icon: Camera },
    { to: '/plan', label: 'Plan', icon: Target },
    { to: '/progress', label: 'Progress', icon: TrendingUp },
];

export function AppLayout() {
    const { user, logout } = useAuth();

    return (
        // lg: becomes a viewport-height flex column (header row is mobile-only
        // so effectively: [sidebar+main row] -> [footer]) so the footer is a
        // shrink-0 last child pinned at the true bottom of the viewport and
        // spanning the full width underneath the sidebar too — matching
        // network-visualizer's and portfolio-webpage's footers. Below lg: this
        // stays a plain block (natural page scroll, unchanged) because the
        // bottom tab nav already owns the fixed-bottom strip there; a second
        // pinned bar would sit on top of it. See footer.tsx's mobile branch
        // below for where the same component renders in-flow instead.
        <div className="min-h-dvh bg-background lg:flex lg:h-dvh lg:flex-col">
            {/* Mobile-only top bar — the sidebar below (lg:) owns branding + logout
          on desktop, but is `hidden` below lg:, so without this there was no
          way to log out on a phone at all (the bottom tab nav only holds the
          4 primary destinations). Admin access lives here too, for the same
          reason — one more icon-only button, not a 5th bottom-tab slot most
          users (non-admins) would never use. */}
            <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
                <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                        N
                    </span>
                    <span className="font-display text-lg font-bold tracking-tight text-foreground">
                        nutrilens
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    {user?.role === 'admin' && (
                        <Link
                            to="/admin"
                            aria-label="Admin"
                            className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <ShieldCheck size={18} strokeWidth={2} />
                        </Link>
                    )}
                    <button
                        onClick={logout}
                        aria-label="Log out"
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <LogOut size={18} strokeWidth={2} />
                    </button>
                </div>
            </header>

            <div className="lg:flex lg:min-h-0 lg:flex-1">
                <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-border lg:bg-card lg:py-6">
                    <div className="mb-6 flex items-center gap-2.5 border-b border-border px-5 pb-6">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                            N
                        </span>
                        <span className="font-display text-xl font-bold tracking-tight text-foreground">
                            nutrilens
                        </span>
                    </div>

                    <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Primary">
                        {NAV_ITEMS.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.to === '/'}
                                className={({ isActive }) =>
                                    cn(
                                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                                        isActive
                                            ? 'bg-primary/12 text-primary'
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                                    )
                                }
                            >
                                <item.icon size={18} strokeWidth={2} />
                                {item.label}
                            </NavLink>
                        ))}

                        {user?.role === 'admin' && (
                            <Link
                                to="/admin"
                                className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <ShieldCheck size={18} strokeWidth={2} />
                                Admin
                            </Link>
                        )}
                    </nav>

                    <div className="mt-2 flex items-center gap-2.5 border-t border-border px-3 pt-4">
                        <Avatar name={user?.displayName ?? '?'} seed={user?.id} size="md" />
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                                {user?.displayName}
                            </p>
                            <p className="truncate text-xs capitalize text-muted-foreground">
                                {user?.role}
                            </p>
                        </div>
                        <button
                            onClick={logout}
                            aria-label="Log out"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <LogOut size={16} strokeWidth={2} />
                        </button>
                    </div>
                </aside>

                <main className="pb-20 lg:min-w-0 lg:flex-1 lg:overflow-y-auto lg:pb-0">
                    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
                        <Outlet />
                        <Footer className="lg:hidden" />
                    </div>
                </main>
            </div>

            <nav
                aria-label="Primary"
                className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card/95 backdrop-blur-sm lg:hidden"
            >
                <ul className="mx-auto flex max-w-3xl justify-around px-2 py-1.5">
                    {NAV_ITEMS.map((item) => (
                        <li key={item.to} className="flex-1">
                            <NavLink
                                to={item.to}
                                end={item.to === '/'}
                                className={({ isActive }) =>
                                    cn(
                                        'flex w-full flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors',
                                        isActive ? 'text-primary' : 'text-muted-foreground',
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
