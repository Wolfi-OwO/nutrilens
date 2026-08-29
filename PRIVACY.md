# Privacy Policy — NutriLens

**Last updated:** [DATE] · **Canonical, user-facing version:** `/datenschutz` inside the running app (German, `apps/frontend/src/pages/datenschutz.tsx`) — this file is the English, repository-level companion for reviewers and contributors. If the two ever disagree, the in-app page is the one users actually saw and is the one that governs; update this file to match, not the other way round.

> Compliance draft, not legal advice. Not reviewed by a Rechtsanwalt.

## 1. Data Controller

Phillip Kofler, Villach, Kärnten, Austria
Email: <KoflerPhillip@outlook.com>

**Known gap, already flagged in the code (`TODO_STREET_ADDRESS` in `impressum.tsx`):** § 5 ECG wants a full geographic address capable of receiving service of process. Only the city is currently public. Fill in street + house number once the operator decides to publish it.

## 2. What We Collect

| Data                                                                                                    | Legal basis                                                     | Notes                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email, display name, argon2id password hash                                                             | Art 6(1)(b) contract                                            | Account credentials                                                                                                                                               |
| GitHub / Google / Microsoft account identity + profile picture, if used to sign in                      | Art 6(1)(b) contract                                            | Microsoft's picture is proxied server-side via Graph so the browser never talks to Microsoft directly; GitHub/Google pictures are shown via a provider-hosted URL |
| Diet plan (calorie/macro targets)                                                                       | Art 6(1)(b) contract                                            |                                                                                                                                                                   |
| Meal logs: foods, quantities, macros, timestamp, and the meal photo itself if photo-recognition is used | Art 6(1)(b) contract                                            | Photo is sent to the internal AI server for recognition only                                                                                                      |
| Body weight entries + optional weight goal                                                              | **Art 9(2)(a) explicit consent — separate from account signup** | See § 4                                                                                                                                                           |
| Admin audit log of administrative actions                                                               | Art 6(1)(f) legitimate interest                                 | Anonymizes the affected user's identifier on account deletion rather than deleting the log entry, so accountability survives deletion                             |

## 3. Special-Category Data (Art 9 DSGVO)

Body weight over time, combined with calorie/macro intake and a stated weight goal, is account-linked, longitudinal, and goal-directed — we treat this combination as **health data under Art 9(1)**. Processing rests on your **explicit, separate consent** (Art 9(2)(a)), collected before your first weight entry or goal, distinct from agreeing to this policy or the Terms. Withdrawable at any time from your profile settings with the same ease it was given; existing entries can be deleted there too.

## 4. Photo-Based Food Recognition

Your meal photo is sent to an **internal AI server with no public network path** for recognition. EXIF and GPS metadata are stripped before the photo leaves the API server (`apps/api/src/lib/strip-exif.ts`). The AI server holds no database, persists no images, and logs nothing containing image content by design (see `apps/ai-server/API.md`, ADR-0001). The recognition result is shown to you before it is saved and can be corrected — this is not an Art 22 automated decision with legal effect, because you review and confirm it every time.

## 5. Food Search

Search runs against our own, locally seeded PostgreSQL database (public-domain USDA data). No search input is sent to any external food-lookup API.

**Barcode lookup:** `food_catalog.ean_code` (migration `0011_food_catalog_barcode.sql`) is the schema for looking up foods by EAN/UPC barcode. Once populated by the planned [Open Food Facts](<https://openfoodfacts.org>) enrichment job, those rows carry data licensed **ODbL v1.0** (the database) and **DbCL v1.0** (its contents), which requires attribution: "Data sourced from Open Food Facts, <https://openfoodfacts.org>, licensed under ODbL." Add that attribution to the in-app data-sources page before the enrichment job first runs. OFF product images are licensed CC-BY-SA and are **not** used by this app — only names, barcodes and nutrition facts are ingested; adding images later would bring that third licence with them.

## 6. Recipients

- **Microsoft Azure** (West Europe) — infrastructure host, acting as processor under an Azure DPA.
- **GitHub / Google / Microsoft** — only if you choose that sign-in method; then the relevant provider receives the OAuth handshake. These are US-headquartered providers; confirm each one's current transfer mechanism (DPF certification or SCCs) before relying on it.
- No other third party receives your data. No third-country transfer for hosting — EU-region only.

## 7. Retention

**Known gap, already flagged in the code (`TODO_RETENTION` in `datenschutz.tsx`):** account, plan, and log data is kept for the life of the account, but no automated deletion routine exists in the backend yet beyond the self-service export/delete described below — no stated backup-retention window either. Update this section with the real figures once a retention job exists.

## 8. Your Rights — Already Self-Service

Unlike many apps this size, deletion and portability are **implemented, not just promised**:

- `GET /users/me/export` — full data export (Art 20), tested in `apps/api/tests/users/self-service-deletion-and-export.test.ts`.
- `DELETE /users/me` — account deletion (Art 17), requires password confirmation; admin audit log entries referencing the account are anonymized, not deleted, to preserve audit integrity.

Both are reachable from Profile settings in the app. For access (Art 15), rectification (Art 16), objection (Art 21), or a consent withdrawal not covered by the profile UI, email <KoflerPhillip@outlook.com>; response within one month (Art 12(3), extendable by two).

Complaints: Österreichische Datenschutzbehörde, Barichgasse 40–42, 1030 Wien, <www.dsb.gv.at>

## 9. Breach Notification

Reported to the Datenschutzbehörde within 72 hours of the controller becoming aware (Art 33) where risk is likely; to you directly where risk is high (Art 34).

## 10. Contact

<KoflerPhillip@outlook.com>
