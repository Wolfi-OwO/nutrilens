# Use Case: Admin Management

## UC-60 — Manage users

**Actor:** Admin

**Main flow:**

1. Admin searches/filters the user list.
2. Admin views a user's account status and, if needed, suspends or reinstates
   it (e.g. for abuse, or in response to a support request).

**Notes:** Admins cannot view a user's meal logs or photos in plaintext
through this flow — support access to personal data is a separate,
audit-logged break-glass procedure, not part of routine account management.

## UC-61 — Moderate content

**Actor:** Admin

**Main flow:**

1. Admin reviews flagged content (e.g. abusive display names, reported
   profile content).
2. Admin takes action: warn, remove content, suspend account.

## UC-62 — View system health

**Actor:** Admin

**Main flow:**

1. Admin views service health, including AI-detection server latency/error
   rate, so degraded inference quality is visible operationally, not just to
   end users hitting failures.
