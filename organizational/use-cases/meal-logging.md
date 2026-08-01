# Use Case: Meal Logging

## UC-20 — Log meal manually

**Actor:** User

**Main flow:**

1. User searches the food database by name.
2. User selects a food item and specifies a portion size.
3. System calculates calories/macros for that portion and adds a `MealLog`
   entry with `source = MANUAL_SEARCH`.

## UC-21 — Log meal via photo

**Actor:** User
**Includes:** [AI food detection](ai-food-detection.md#uc-30--run-food-inference)

**Main flow:**

1. User takes or uploads a photo of a meal.
2. System sends the photo to the AI-detection server.
3. AI-detection server returns identified items, estimated portions, and a
   macro/calorie estimate per item, each with a confidence score.
4. System presents the prediction to the user for review.
5. User confirms as-is, or edits item names/portions.
6. System creates a `MealLog` entry with `source = AI_PHOTO`, storing whether
   the user corrected the prediction (`userCorrected`).

**Alternate flows:**

- 2a. AI-detection server times out or errors → user is offered the manual
  logging flow instead; the photo is discarded (see
  [README](../../README.md#why-a-two-server-architecture) — the AI server
  does not persist images, so there is nothing left to clean up on failure).
- 3a. No food confidently identified → system tells the user to try manual
  entry, does not fabricate a low-confidence guess as if it were reliable.

## UC-22 — Edit or delete a logged meal

**Actor:** User

**Main flow:**

1. User opens a previously logged meal from their history.
2. User edits portion/items or deletes the entry entirely.
3. System recalculates the day's running totals.
