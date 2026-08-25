# Access control

Enforced in `apps/api/src/middlewares/auth.ts`: `requireAuth` verifies the
session JWT, `requireRole(...roles)` checks `req.user.role` against an
allow-list. `role` is one of `user` | `coach` | `admin`
(`apps/api/src/lib/jwt.ts`). There is no partial/scoped admin — `admin`
grants every action below.

## Role matrix

| Action                                                                       | user | coach | admin                                                        |
| ---------------------------------------------------------------------------- | ---- | ----- | ------------------------------------------------------------ |
| Manage own account (profile, own diet plans/meal logs/weight entries)        | ✅   | ✅    | ✅                                                           |
| View own data                                                                | ✅   | ✅    | ✅                                                           |
| Search/list all users (UC-63)                                                | ❌   | ❌    | ✅                                                           |
| View another user's account detail (UC-64)                                   | ❌   | ❌    | ✅                                                           |
| View another user's personal content (meal logs, photos, plans) in plaintext | ❌   | ❌    | ❌ (break-glass only — see admin-management.md's UC-60 note) |
| Change another user's role or status (UC-65)                                 | ❌   | ❌    | ✅ (with the lockout guards below)                           |
| View platform stats (UC-66)                                                  | ❌   | ❌    | ✅                                                           |
| View the admin audit log (UC-68)                                             | ❌   | ❌    | ✅                                                           |

`coach` currently carries no permissions beyond `user` — it exists in the
role enum for a planned future capability (coaches viewing their assigned
clients' data with consent), not implemented yet. Nothing in M9 changes
that.

## Lockout prevention (UC-65's guard rules)

Two independent rules, both enforced server-side in the same transaction as
the change — never just a frontend confirmation dialog:

1. **Last-admin guard.** A role change or status change that would leave
   zero accounts with `role = 'admin'` and `status = 'active'` is rejected
   with `409 Conflict`. Checked by counting active admins excluding the
   target row, inside the same transaction as the write, not by a
   check-then-act query pair — a concurrent request could otherwise slip
   through the gap between the two.
2. **Self-suspension guard.** An admin cannot set their **own** account's
   `status` to `suspended` via `PATCH /users/:id`, regardless of whether
   they're the last admin or not. Self-demotion (`role` change) is allowed;
   an admin choosing to step down is a deliberate, reversible-by-another-
   admin action, whereas a suspended admin has locked themselves out with
   no path back except another admin's intervention — asymmetric enough to
   warrant a separate rule from the last-admin guard.

Both rules apply to the same endpoint and can both fire on the same
request (e.g. the last admin trying to suspend themselves) — either one
alone is sufficient grounds for rejection.
