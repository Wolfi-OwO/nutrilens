# Use Case: AI Food Detection

## UC-30 — Run food inference

**Actor:** AI-Detection Server (system actor), invoked by `apps/api` on
behalf of a User

**Preconditions:** `apps/api` has received a photo upload from an
authenticated user and validated it (size, format, contains no EXIF GPS
data — stripped before forwarding).

**Main flow:**

1. `apps/api` forwards the image to `apps/ai-server` over the internal
   network only — the AI server is not reachable from the public internet.
2. `apps/ai-server` runs the food recognition model on the image.
3. `apps/ai-server` returns a structured response: a list of `{ foodName,
   estimatedPortionGrams, confidence, calories, proteinGrams, carbGrams,
   fatGrams }`.
4. `apps/ai-server` discards the image from memory; nothing is written to
   disk or to any datastore it owns.
5. `apps/api` relays the structured result to the requesting user for
   confirmation (see [UC-21](meal-logging.md#uc-21--log-meal-via-photo)).

**Alternate flows:**

- 2a. Model confidence below threshold for all items → response indicates
  no confident match rather than a forced low-quality guess.
- 1a. Image fails validation (unsupported format, exceeds size limit) →
  `apps/api` rejects before ever calling the AI server.

**Non-functional notes:**

- The AI server holds no user data, no auth of its own beyond a shared
  internal service credential, and no direct route from the public internet
  — see [non-functional requirements](../requirements/non-functional-requirements.md#security)
  and [ADR-0001](../adr/0001-two-server-split.md).
- Target inference latency: p95 under 3 seconds end-to-end (upload to
  result), so the flow stays usable at the point of eating.
