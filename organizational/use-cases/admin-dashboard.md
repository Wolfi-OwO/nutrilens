# Use Case: Admin Dashboard (M9)

Grounds the M9 milestone (#99-108) in the real domain model before any
endpoint gets built — `role` is `user` | `coach` | `admin`, `status` is
`active` | `suspended` | `deleted` (see `apps/api/src/models/user.model.ts`).
Continues admin-management.md's UC-60/61/62 numbering.

## UC-63 — Search and list users

**Actor:** Admin

**Main flow:**

1. Admin opens the user list, optionally filters by a search term
   (matches email or display name), `role`, and/or `status`.
2. System returns a paginated, capped page of matches plus a total count.

**Notes:** Unbounded scans are out — `pageSize` is validated and capped
server-side, not just a UI convention a caller could bypass. Backs #100/#106.

## UC-64 — View a user's detail

**Actor:** Admin

**Main flow:**

1. Admin selects a user from the list.
2. System shows their profile fields, role, status, and account timestamps.

**Notes:** Explicitly **not** in scope: meal logs, diet plans, or any other
personal content in plaintext — see admin-management.md's UC-60 note on
break-glass access being a separate, audit-logged procedure. The admin
dashboard is account administration, not a support tool for viewing user
data.

## UC-65 — Change a user's role or status

**Actor:** Admin
**Preconditions:** Target account exists.

**Main flow:**

1. Admin changes a user's `role` (promote/demote among `user`/`coach`/`admin`)
   and/or `status` (`active`/`suspended`).
2. System applies the change and writes an audit log entry in the same
   transaction (UC-67) — the two never happen independently of each other.

**Alternate flows:**

- 1a. The change would remove the last remaining `admin` (demoting the only
  admin, or suspending them) → **rejected with 409.** The system does not
  let itself get locked out of its own admin surface.
- 1b. Admin attempts to suspend **their own** account → **rejected.**
  Self-demotion to a lower role is allowed (an admin choosing to step down
  deliberately is different from an accidental self-lockout via suspension);
  self-suspension is not, since a suspended account can't undo the mistake.
- 1c. Target status is already `deleted` → rejected; a deleted account isn't
  administered back into existence through this flow.

**Postconditions:** User's role/status updated; one `admin_audit_log` row
written. Backs #101/#106.

## UC-66 — View platform stats

**Actor:** Admin

**Main flow:**

1. Admin opens the dashboard overview.
2. System shows aggregate counts: users by role and by status, active diet
   plans, meal logs logged in the last 7 and 30 days, and a daily new-signup
   series for the last 30 days.

**Notes:** Aggregate SQL only — no pulling full tables into application
memory to count them. Backs #102/#107.

## UC-67 — Audit every role/status change

**Actor:** System (triggered by UC-65)

**Main flow:**

1. Whenever an admin changes a user's role or status, the system records:
   who did it (`actor_id`), to whom (`target_user_id`), what changed
   (`action`, `previous_value`, `new_value`), and when.
2. The write happens inside the same database transaction as the change
   itself — a role change that "succeeded" with no audit row, or an audit
   row for a change that didn't actually commit, are both bugs this
   guarantees against structurally, not by convention.

**Notes:** Backs #103.

## UC-68 — View the audit log

**Actor:** Admin

**Main flow:**

1. Admin opens the audit log.
2. System shows entries newest-first, paginated.

**Notes:** Backs #103/#108.

## Explicitly out of scope for M9

- Editing another user's profile fields (display name, dietary preferences,
  etc.) — role/status only. Changing someone else's personal data without
  their action is a different, larger conversation this milestone doesn't
  open.
- Bulk actions (bulk suspend, bulk role change) — every action here is
  one admin, one target user, one audit entry.
- Content moderation (UC-61) and system health (UC-62) — already scoped in
  admin-management.md, not part of this milestone's endpoints.
