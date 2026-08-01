# Use Case: User Account Management

## UC-01 — Register

**Actor:** User
**Preconditions:** User has a valid email address, is not already registered.

**Main flow:**

1. User submits email, password, display name.
2. System validates email format and password strength.
3. System checks the email is not already registered.
4. System creates the account in `PENDING_VERIFICATION` status, sends a
   verification email.
5. User clicks the verification link; account moves to `ACTIVE`.

**Alternate flows:**

- 3a. Email already registered → system returns a generic "check your inbox"
  message (does not confirm/deny existence, to avoid account enumeration).
- 2a. Password fails strength check → system returns the specific rule that
  failed.

**Postconditions:** Account exists, unverified until step 5.

## UC-02 — Log in

**Actor:** User
**Preconditions:** Account exists and is `ACTIVE`.

**Main flow:**

1. User submits email + password.
2. System verifies credentials, issues an access token (short-lived) and a
   refresh token (rotating, long-lived).

**Alternate flows:**

- 2a. Invalid credentials → generic error, no indication of which field was
  wrong. Rate-limited per IP and per account after repeated failures.
- 2b. Account `SUSPENDED` or `DELETED` → explicit error, login refused.

## UC-03 — Manage profile

**Actor:** User

**Main flow:**

1. User views/edits display name, avatar, dietary restrictions, units
   preference (metric/imperial).
2. System validates and persists changes.

## UC-04 — Delete account

**Actor:** User
**Preconditions:** User is authenticated.

**Main flow:**

1. User requests account deletion, confirms via a re-authentication step.
2. System marks the account `DELETED`, schedules hard deletion of personal
   data per the data-retention policy, revokes all active sessions.

**Notes:** Deletion must cascade to diet plans, meal logs, and weight
entries — see [non-functional requirements](../requirements/non-functional-requirements.md#data-protection)
for retention timelines.
