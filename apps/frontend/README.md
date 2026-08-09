# @nutrilens/frontend

The production frontend: React 19, TypeScript, Vite, Tailwind CSS v4, React
Router, TanStack Query, shadcn-style components, react-hook-form + zod.
Talks to `apps/api` — see [ADR-0001](../../organizational/adr/0001-two-server-split.md)
for why that's a separate service and never called directly by this app.

Inspired by [`ui-prototype/`](../../ui-prototype) (same component structure —
`NavBar` → `AppLayout`, `Dashboard`/`LogMeal`/`Plan`/`Progress` pages) but
wired to real data instead of hardcoded mock data, and restyled with its own
design system (deep forest green + macro orange, DM Sans/Newsreader
typography, Bento-style rounded cards) rather than copying the prototype's
look 1:1.

## Development

```bash
npm install                          # from the repo root (npm workspaces)
cp apps/frontend/.env.example apps/frontend/.env
npm run dev --workspace=@nutrilens/frontend
```

Needs a running `apps/api` (see `apps/api/README.md`) at the URL configured
in `.env` (`VITE_API_BASE_URL`, defaults to `http://localhost:8080`).

```bash
npm run build --workspace=@nutrilens/frontend      # typecheck (tsc -b) + vite build
npm run lint --workspace=@nutrilens/frontend        # oxlint
```

## Structure

```text
src/
├── components/
│   ├── ui/            shadcn-style primitives (Button, Input, Card, ...)
│   ├── layout/         AppLayout — sidebar nav (desktop) / bottom tab bar (mobile)
│   └── protected-route.tsx   redirects to /login when not authenticated
├── context/            AuthContext + AuthProvider (login/register/logout, current user)
├── hooks/               useAuth
├── lib/
│   ├── api-client.ts    fetch wrapper: auth header, JSON (de)serialization, typed errors
│   └── utils.ts          cn() — clsx + tailwind-merge
├── pages/                one file per route
└── types/api.ts          mirrors apps/api's domain models (dates as ISO strings)
```

Auth: a JWT from `apps/api`'s `/auth/login` is stored in `localStorage` and
sent as `Authorization: Bearer <token>` on every request — see
`lib/api-client.ts`. `AuthProvider` re-validates it against `/users/me` on
load so a stale/expired token doesn't leave a logged-out user stuck on a
protected page.
