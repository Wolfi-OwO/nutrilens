# Use Case: Diet Plan Management

## UC-10 — Create diet plan (guided)

**Actor:** User
**Preconditions:** User is authenticated, has no active diet plan (or accepts
replacing one).

**Main flow:**

1. User selects a goal: lose weight, maintain, or gain weight.
2. User provides current weight, height, age, sex, activity level.
3. System calculates a suggested daily calorie target (via a standard BMR/TDEE
   formula) and a default macro split.
4. User reviews and optionally adjusts the suggested targets.
5. System creates the diet plan, marks it active, deactivates any prior
   active plan.

**Alternate flows:**

- 4a. User enters targets manually instead of accepting the suggestion —
  system validates they're within a safe physiological range and warns
  (but does not block) if not.

## UC-11 — Edit diet plan

**Actor:** User

**Main flow:**

1. User opens the active diet plan.
2. User adjusts calorie/macro targets or end date.
3. System persists changes; historical meal logs keep their original targets
   for progress-tracking accuracy (targets are not retroactively rewritten).

## UC-12 — End / archive diet plan

**Actor:** User

**Main flow:**

1. User ends the active plan (goal reached, or starting a new one).
2. System archives it; it remains visible in progress history but stops
   accepting new meal-log associations.
