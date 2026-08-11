import { ArrowLeft, ClipboardList, LayoutGrid, LogOut, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

// #105 — a shell distinct from AppLayout's, not the same nav with an
// admin badge tacked on: different sections (Overview/Users/Audit Log
// instead of Today/Log meal/Plan/Progress), and a visible "back to app"
// link, since this is a separate area an admin steps into, not a tab
// inside the regular one.
const ADMIN_NAV_ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/admin', label: 'Overview', icon: LayoutGrid },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/audit', label: 'Audit log', icon: ClipboardList },
]

export function AdminLayout() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-dvh bg-background">
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-border lg:bg-card lg:px-4 lg:py-6">
        <div className="mb-2 flex items-center gap-2.5 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            N
          </span>
          <div>
            <span className="block font-display text-xl font-semibold tracking-tight text-foreground">
              nutrilens
            </span>
            <span className="block text-xs font-medium text-muted-foreground">Admin</span>
          </div>
        </div>

        <Link
          to="/"
          className="mb-6 flex items-center gap-2 px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} strokeWidth={2} />
          Back to app
        </Link>

        <nav className="flex flex-1 flex-col gap-1" aria-label="Admin">
          {ADMIN_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              <item.icon size={18} strokeWidth={2} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={logout}
          aria-label="Log out"
          className="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
            {user?.displayName.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">{user?.displayName}</span>
          <LogOut size={16} strokeWidth={2} />
        </button>
      </aside>

      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2.5">
          <Link to="/" aria-label="Back to app" className="text-muted-foreground">
            <ArrowLeft size={20} strokeWidth={2} />
          </Link>
          <span className="font-display text-lg font-semibold tracking-tight text-foreground">Admin</span>
        </div>
        <button
          onClick={logout}
          aria-label="Log out"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut size={18} strokeWidth={2} />
        </button>
      </header>

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

      <main className="pb-20 lg:ml-64 lg:pb-0">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
