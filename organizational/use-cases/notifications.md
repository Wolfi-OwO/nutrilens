# Use Case: Notifications

## UC-50 — Logging reminder

**Actor:** System (scheduled), User (recipient)

**Main flow:**

1. System detects no meal logged by a user-configured time of day.
2. System sends a reminder notification (push/email, per user preference).

## UC-51 — Goal check-in

**Actor:** System (scheduled), User (recipient)

**Main flow:**

1. On a weekly cadence, system compares actual weight trend against the diet
   plan's goal trajectory.
2. System sends a summary notification: on track, ahead, or behind.

## UC-52 — Manage notification preferences

**Actor:** User

**Main flow:**

1. User enables/disables each notification type and sets channel (push,
   email) and quiet hours.
2. System persists preferences and respects them for all future sends.
