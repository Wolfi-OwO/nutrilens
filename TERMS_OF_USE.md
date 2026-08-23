# Terms of Use — NutriLens

**Last updated:** [DATE] · Canonical, user-facing version: `/agb` inside the app (`apps/frontend/src/pages/agb.tsx`), in German as "Allgemeine Geschäftsbedingungen". This file mirrors it for the repository.

> Compliance draft, not legal advice.

## 1. Acceptance

Creating a NutriLens account means you accept these Terms.

## 2. What NutriLens Is

Meal logging (photo recognition, search, or barcode), diet plan creation and tracking, weight and progress tracking. The app is in active development; feature scope and availability may change.

## 3. No Medical Advice

**NutriLens is not a medical device and does not replace medical, nutritional, or other professional advice.** All calorie/macro values, diet plans, weight goals, and AI recognition results are general, automatically generated estimates, computed without knowledge of your individual health situation. They are not a diagnosis or a treatment recommendation. Do not make health-consequential decisions (existing conditions, eating disorders, pregnancy) based on NutriLens alone — consult a doctor or qualified nutrition professional.

## 4. AI-Assisted Recognition

Photo-based food recognition is an automated estimate, labeled as such in the app. It can be wrong — food, portion size, and preparation method are not always determinable from a photo. Review and correct every result before saving. No warranty is given for the accuracy of automatically recognized nutrition values.

## 5. User Responsibilities

- Keep credentials confidential; accounts are non-transferable.
- Provide only truthful information about yourself.
- Do not use the app for unlawful purposes or to impair its operation (automated mass scraping, denial-of-service).
- Uploaded photos and inputs must not infringe third-party rights or contain unlawful content.

## 6. Intellectual Property

- Source code is MIT-licensed (`LICENSE`) — covers reuse of the code, not use of the operator's hosted instance under these Terms.
- Your meal logs, plans, and photos remain yours. You grant the operator only the license needed to store, process (including sending photos to the internal AI server), and display them back to you.

## 7. Account Termination

You may delete your account at any time from Profile settings (`DELETE /users/me`, GDPR Art 17) or by emailing KoflerPhillip@outlook.com. We may suspend or delete an account for a Terms violation, after prior notice, or immediately for a serious violation.

## 8. Limitation of Liability

Use is free of charge and at your own risk. Liability is unlimited for intent and gross negligence and under the Produkthaftungsgesetz; liability for slight negligence is excluded to the extent legally permitted. No warranty for the accuracy of automatically computed nutrition values or AI recognition results (§§ 3, 4).

## 9. Data Security Measures

`helmet()` HTTP hardening, argon2id password hashing, EXIF/GPS stripping on uploaded photos before AI processing, an internally isolated AI server with no database and no image persistence, and self-service Art 17/20 endpoints — see `apps/api/src/app.ts` and PRIVACY.md.

## 10. Changes

These Terms may be adapted for new features or legal requirements. Material changes are announced in-app; continued use after a change constitutes acceptance.

## 11. Governing Law and Disputes

Austrian law applies, excluding conflict-of-laws rules and the CISG. Consumers keep the protection of the mandatory law of their habitual residence. See PRIVACY.md for data processing and IMPRESSUM.md for provider details.
