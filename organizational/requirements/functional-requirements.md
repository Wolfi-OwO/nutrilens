# Functional Requirements

IDs are referenced from issues as `FR-xxx` so backlog items trace back to a
concrete requirement.

## Account & auth

- **FR-001** Users can register with email + password.
- **FR-002** Users can log in and receive a short-lived access token plus a
  rotating refresh token.
- **FR-003** Users can update their profile (name, avatar, dietary
  restrictions, unit preference).
- **FR-004** Users can permanently delete their account and all associated
  data.

## Diet plans

- **FR-010** Users can create a diet plan via a guided wizard (goal,
  biometrics → suggested targets) or by entering targets manually.
- **FR-011** Users can edit an active diet plan's targets.
- **FR-012** Users can archive/end a diet plan; archived plans remain visible
  in history.
- **FR-013** Only one diet plan is active per user at a time.

## Meal logging

- **FR-020** Users can log a meal manually via a searchable food database.
- **FR-021** Users can log a meal by uploading/capturing a photo.
- **FR-022** Photo-based logging returns an AI prediction (items, portions,
  macros, confidence) for user confirmation before it is saved.
- **FR-023** Users can edit AI predictions before confirming.
- **FR-024** Users can edit or delete any previously logged meal.
- **FR-025** If AI inference fails or times out, the user is offered manual
  logging without losing their place in the flow.

## Progress tracking

- **FR-030** Users can view daily/weekly/monthly totals against their active
  plan's targets.
- **FR-031** Users can log body weight entries and view a trend chart.
- **FR-032** Users can view their current and best adherence streak.

## Notifications

- **FR-040** Users receive a configurable reminder if no meal has been logged
  by a chosen time of day.
- **FR-041** Users receive a weekly goal check-in summary.
- **FR-042** Users can control notification channel and quiet hours per
  notification type.

## Admin

- **FR-050** Admins can search users and suspend/reinstate accounts.
- **FR-051** Admins can review and act on flagged content.
- **FR-052** Admins can view AI-detection server health metrics (latency,
  error rate) separately from general application health.
