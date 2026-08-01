# Use Case: Progress Tracking

## UC-40 — View daily/weekly/monthly summary

**Actor:** User

**Main flow:**

1. User opens the progress view.
2. System aggregates logged meals against the active diet plan's targets for
   the selected period.
3. System displays totals, remaining budget for the day, and a trend chart.

## UC-41 — Log body weight

**Actor:** User

**Main flow:**

1. User records a weight entry (value, date, defaults to today).
2. System stores it and updates the weight trend chart.

**Alternate flows:**

- 1a. An entry already exists for that date → system asks whether to
  overwrite or keep both (some users weigh in more than once a day).

## UC-42 — View adherence streak

**Actor:** User

**Main flow:**

1. System calculates consecutive days with at least one logged meal within
   a configurable tolerance of the calorie target.
2. User sees current streak and personal best.
