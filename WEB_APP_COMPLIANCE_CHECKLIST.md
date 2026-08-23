# Web App Compliance Audit & Implementation Checklist

**NutriLens — AI Nutrition Tracking**  
**Date:** 2026-08-23  
**Repository:** github.com/Wolfi-OwO/nutrilens  
**Status:** Production with SPECIAL CATEGORY data (health) — HIGH compliance priority

---

## Executive Summary

NutriLens is a **nutrition tracking app with AI meal recognition** that collects and processes **SPECIAL CATEGORY PERSONAL DATA** under GDPR Article 9:

- **Health data:** Meal logs, calorie tracking, weight, diet plans
- **Photo data:** Food photos (sent to AI server for recognition)
- **User profiles:** Email, credentials, dietary restrictions
- **Medical-adjacent features:** Weight tracking, macronutrient management

**Key compliance requirement:** DSGVO Article 9 processing of health data requires:

- Explicit, informed consent
- High security (encryption)
- User rights (access, deletion, portability)
- Data minimization (not retain longer than necessary)

**Status:**

- ✅ Legal pages are implemented (Impressum, Datenschutz, AGB)
- ✅ Footer has links to all three legal pages
- ❌ Backend is missing: Data export, deletion, consent tracking
- ⚠️ Needs security hardening for health data

---

## Frontend Compliance Checklist

### ✅ Existing Legal Infrastructure

- [x] **Footer component** (`apps/frontend/src/components/layout/footer.tsx`)
  - [x] Has LEGAL_LINKS array with: /impressum, /datenschutz, /agb
  - [x] Renders in German (Über uns, Impressum, Datenschutz, AGB)
  - [x] Accessible from all pages (consistent layout)
  - [x] Mobile-responsive (flex layout adapts)

- [x] **Legal page components** (`apps/frontend/src/pages/`)
  - [x] `impressum.tsx` — Operator info, business details
  - [x] `datenschutz.tsx` — Privacy policy (DSGVO-compliant)
  - [x] `agb.tsx` — Terms of Use (AGB)
  - [x] All use `LegalPage` and `LegalSection` components for consistent styling

- [x] **Reusable legal layout** (`apps/frontend/src/components/layout/legal-page.tsx`)
  - [x] Renders title, lede, sections
  - [x] Print-friendly formatting
  - [x] Semantic HTML (proper heading hierarchy)

### ⚠️ Enhancements Needed

#### Legal Content Completeness

- [x] **Impressum is complete** — Operator address, contact, business info
  
- [x] **Datenschutzerklärung covers:**
  - [x] Data controller info
  - [x] Types of data collected (account, meal logs, photos, weight)
  - [x] Legal basis for processing (consent, contract, legitimate interest)
  - [x] Data retention (meal logs: until deletion, photos: 30 days after upload)
  - [x] User rights (access, deletion, portability, objection)
  - [x] Third-party disclosures (if any: GitHub OAuth, Google OAuth, Microsoft)
  - [x] Cookie policy
  - [x] Regional compliance (Austria, EU, DSGVO)

- [ ] **Datenschutz should additionally mention:**
  - [ ] **Special category data processing** (Article 9 DSGVO)
    - Text: "Health and nutrition data are processed with explicit consent (Article 9 DSGVO). By using NutriLens, you consent to processing of this special category data."
  - [ ] **AI processing disclaimer**
    - Text: "Meal photos are processed by our AI model for food recognition. Photos are not permanently stored; they're analyzed and deleted after [X] days."
  - [ ] **Data security measures specific to health data**
    - Encryption at rest (AES-256)
    - Encryption in transit (TLS 1.3)
    - Access controls (only you can see your data)

- [x] **AGB (Terms of Use) covers:**
  - [x] User responsibilities
  - [x] Disclaimer: "NutriLens is not medical advice"
  - [x] Limitation of liability
  - [x] Service availability
  - [x] Dispute resolution (Austrian law)

#### Cookie Consent Banner

**Status:** [NEEDS VERIFICATION]

- [ ] **Cookie consent banner implementation**
  - [ ] Check if banner library is already installed (e.g., `react-cookie-consent`)
  - [ ] If not: Install and implement
  - [ ] Banner appears on first visit
  - [ ] User choices are stored

- [ ] **Banner functionality:**
  - [ ] "Accept All" button
  - [ ] "Reject All" button (equally prominent)
  - [ ] "Preferences" link (granular consent)
  - [ ] Link to Datenschutzerklärung (/datenschutz)

- [ ] **Analytics enforcement:**
  - [ ] Check if Google Analytics is used
  - [ ] If yes: GA script only loads after consent.analytics === true
  - [ ] Consent stored in localStorage or database

#### Accessibility

- [x] **Legal pages are accessible** (based on existing implementation)
  - [x] Semantic HTML (proper heading tags)
  - [x] Color contrast adequate
  - [x] Keyboard navigation

- [ ] **Cookie banner is accessible** (if implemented)
  - [ ] Keyboard navigable
  - [ ] Screen reader friendly (`role="dialog"`, `aria-label`)
  - [ ] Focus trap (focus stays within modal while open)

---

## Backend Compliance Checklist

### Overview of Current Implementation

NutriLens has a **two-service architecture:**

1. **`apps/api`** — Main application server (Node.js, Express, PostgreSQL)
   - Handles: User auth, meal logs, diet plans, weight tracking
   - Database: PostgreSQL (user data, health records)

2. **`apps/ai-server`** — AI inference service (Python, FastAPI, ONNX Runtime)
   - Handles: Food recognition from photos
   - **Does NOT store data** (no database, no user PII)
   - Receives photo, returns JSON prediction, deletes photo

**Compliance implication:** Health data is centralized in `apps/api`. AI server is isolated (no liability for data breaches there).

### ✅ Existing Security Features

- [x] **HTTPS/TLS 1.3** enforced
- [x] **Password hashing** (Argon2id for new accounts)
- [x] **JWT session tokens** in httpOnly cookies
- [x] **Rate limiting** on API endpoints
- [x] **Input validation** (zod schemas)
- [x] **OAuth 2.0** support (GitHub, Google, Microsoft)

### ❌ Missing GDPR Features

#### Data Export (GDPR Art. 20 — Right to Data Portability)

**Status:** [NOT IMPLEMENTED]

**Endpoint needed:** `GET /api/users/:id/export`

- [ ] **Create endpoint in `apps/api/src/routes/users.routes.ts`**

  ```typescript
  router.get('/:id/export', async (req, res) => {
    // 1. Verify auth (user exporting own data or admin)
    // 2. Fetch user record (no password hash)
    // 3. Fetch all meal logs
    // 4. Fetch all weight entries
    // 5. Fetch diet plans
    // 6. Serialize as JSON
    // 7. Return with Content-Disposition: attachment
  });
  ```

- [ ] **Export content:**
  - [ ] User profile: ID, email, username, created_at, last_login
  - [ ] All meal logs: date, food items, calories, macros, photos (as base64 or URLs)
  - [ ] All weight entries: date, weight, notes
  - [ ] Diet plans: goals, calorie limits, macronutrient targets
  - [ ] Account settings: preferred language, notifications, privacy settings

- [ ] **Export excludes:**
  - [ ] Password hash (never export)
  - [ ] Session tokens
  - [ ] Internal logs (not personal data)
  - [ ] Other users' data

- [ ] **Export format:**
  - [ ] JSON (machine-readable, portable)
  - [ ] Structure:

    ```json
    {
      "exported_at": "2026-08-23T10:30:00Z",
      "user": { ... },
      "meal_logs": [ ... ],
      "weight_entries": [ ... ],
      "diet_plans": [ ... ]
    }
    ```

- [ ] **Rate limit:**
  - [ ] 1 export per 24 hours
  - [ ] Logged in audit log

#### Data Deletion (GDPR Art. 17 — Right to Erasure)

**Status:** [PARTIALLY IMPLEMENTED — need to verify grace period]

- [ ] **Endpoint enhancement: `DELETE /api/users/:id`**

  ```text
  User requests deletion
       ↓
  [Soft-delete] Mark as deleted, hide from UI
       ↓
  [Notification] Email: "Your account will be deleted on [date+90]"
       ↓
  [Grace period] 90 days (user can cancel)
       ↓
  [Hard-delete] Auto-purge all records after 90 days
  ```

- [ ] **Soft-delete workflow:**
  - [ ] Add `deleted_at` timestamp to user record
  - [ ] Add `is_deleted` boolean flag
  - [ ] Hide deleted users from all queries
  - [ ] Preserve all data during grace period (for recovery)

- [ ] **Hard-delete workflow:**
  - [ ] Daily scheduled job (e.g., 00:00 UTC)
  - [ ] Find users: `deleted_at < now() - 90 days`
  - [ ] Delete completely:
    - [ ] User record
    - [ ] Meal logs
    - [ ] Weight entries
    - [ ] Diet plans
    - [ ] Session tokens
    - [ ] Any uploaded photos
    - [ ] Account settings
  - [ ] Keep audit log (for compliance, do NOT delete)

- [ ] **Deletion exceptions:**
  - [ ] Audit logs: Retained for compliance (cannot delete)
  - [ ] Backups: Remove user data after 30 days
  - [ ] Photos: Delete immediately (not kept in archive)

- [ ] **Notifications:**
  - [ ] Email 1: "Deletion requested" — immediate
  - [ ] Email 2: "Your account will be deleted on [date]" — 1 day before deadline
  - [ ] Email 3: "Account deleted" — confirmation (post-hard-delete)
  - [ ] User can click link to cancel deletion (within 7 days)

#### Consent Management (Art. 7 & 9)

**Status:** [NOT IMPLEMENTED — critical for health data]

**DSGVO Article 9 requires explicit consent for special category data.**

- [ ] **Create `consents` table in PostgreSQL:**

  ```sql
  CREATE TABLE consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_type VARCHAR(50) NOT NULL, -- 'health_data_processing', 'ai_photo_analysis', 'analytics'
    granted BOOLEAN NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    granted_version VARCHAR(20) NOT NULL, -- Privacy policy version (e.g., "2.0")
    ip_address INET NOT NULL, -- For audit trail (anonymize: last octet = 0)
    user_agent TEXT,
    UNIQUE(user_id, consent_type)
  );
  ```

- [ ] **Consent types to track:**
  - [ ] `'health_data_processing'` — Processing meal logs, weight, diet plans (Article 9)
  - [ ] `'ai_photo_analysis'` — Send photos to AI server for recognition
  - [ ] `'analytics'` — Allow Google Analytics tracking (optional)
  - [ ] `'marketing_emails'` — Allow promotional emails (optional)

- [ ] **Consent collection on signup/first login:**
  - [ ] Display consent form (not auto-checked boxes)
  - [ ] Explain: "By creating an account, you consent to processing your health data (Article 9 DSGVO)"
  - [ ] User must check box to continue
  - [ ] Timestamp and log the consent

- [ ] **Consent withdrawal:**
  - [ ] User can withdraw at any time (dashboard → Settings → Privacy)
  - [ ] Immediate effect (no new data processing)
  - [ ] Existing data is NOT deleted (but no new processing)
  - [ ] Email confirmation

- [ ] **Consent enforcement in backend:**
  - [ ] Before creating meal log: Check `consents.health_data_processing == true`
  - [ ] Before sending photo to AI server: Check `consents.ai_photo_analysis == true`
  - [ ] Before logging to Google Analytics: Check `consents.analytics == true`

#### Audit Logging

**Status:** [LIKELY IMPLEMENTED — verify scope]

- [ ] **Verify audit log captures:**
  - [ ] User login/logout
  - [ ] Meal log creation, update, deletion
  - [ ] Weight entry creation, deletion
  - [ ] Diet plan changes
  - [ ] Account deletion requests
  - [ ] Consent grants/withdrawals
  - [ ] Data export requests
  - [ ] Permission/role changes (if admin portal exists)

- [ ] **Audit log does NOT contain:**
  - [ ] Meal photos (PII)
  - [ ] Passwords or tokens
  - [ ] Full names (if not needed for compliance)
  - [ ] Dietary restrictions (if sensitive)

- [ ] **Audit log retention:**
  - [ ] Default: 90 days or configurable
  - [ ] Cleanup job: Runs daily, removes entries >90 days old
  - [ ] Special case: Keep deletion requests forever (proof of compliance)

#### Photo Handling (Special Care for Health Data)

**Status:** [NEEDS REVIEW]

- [ ] **Verify photo lifecycle:**

  ```text
  User uploads photo
       ↓
  [Storage] Save temporarily (max 24 hours or immediate processing)
       ↓
  [AI Analysis] Send to apps/ai-server for recognition
       ↓
  [Deletion] Delete photo from disk/storage after analysis
       ↓
  [Database] Store only the recognition result (food name, calories)
  ```

- [ ] **Photo storage implementation:**
  - [ ] Photos are NOT permanently archived
  - [ ] Temporary storage: `/tmp/uploads` or cloud bucket with TTL
  - [ ] Max retention: 24 hours (or immediate delete after analysis)
  - [ ] Encrypted in transit (TLS 1.3)
  - [ ] Encrypted at rest (if cloud storage used)

- [ ] **AI server isolation (VERIFIED AS GOOD DESIGN):**
  - [ ] AI server has NO database access
  - [ ] AI server does NOT log photos or user identifiers
  - [ ] API call includes only: photo (binary), model parameters
  - [ ] Response: JSON with prediction (food name, confidence, nutrition facts)
  - [ ] Photo is deleted immediately after response

- [ ] **Photo user rights:**
  - [ ] User can view photos they uploaded (in their meal log)
  - [ ] User can delete photos (which also deletes the meal log entry if desired)
  - [ ] Photos are not shared with third parties

#### Security Measures for Health Data

- [ ] **Encryption at rest:**
  - [ ] PostgreSQL database: Enable encryption at rest (AWS RDS, Azure Database options)
  - [ ] Backups: AES-256 encryption
  - [ ] Temporary file storage: Encrypted

- [ ] **Encryption in transit:**
  - [x] HTTPS/TLS 1.3 (already verified)
  - [ ] API → AI server communication: HTTPS with mutual TLS (optional but recommended)

- [ ] **Access controls:**
  - [ ] Database user (app connection): Read/write only to own data
  - [ ] Backup system: Cannot read unencrypted data without keys
  - [ ] Admin access: Logged, must be justified, restricted to specific tables

- [ ] **Data minimization:**
  - [ ] Only collect: Email, password hash, meal logs, weight, diet plan
  - [ ] Do NOT collect: Full name (unless necessary), address, phone, medical history
  - [ ] Photos: Delete immediately after analysis (do NOT keep)

### Session & Authentication

- [ ] **Session management verified:**
  - [ ] JWT tokens in httpOnly cookies
  - [ ] Secure flag (HTTPS only)
  - [ ] SameSite=Strict (CSRF protection)
  - [ ] TTL: 7 days or configurable

- [ ] **Password requirements enforced:**
  - [ ] Minimum 12 characters (or configurable)
  - [ ] Password reset: Link expires after 1 hour
  - [ ] No password history leaks (reset tokens are one-time use)

- [ ] **OAuth flows secure:**
  - [ ] PKCE flow (if mobile app exists)
  - [ ] State parameter verified (CSRF protection)
  - [ ] Redirect URI whitelisted

### Rate Limiting

- [x] **Rate limiting per endpoint:**
  - [x] Default: 100 req/min per user, 1000 req/min per IP
  - [x] Login endpoint: 5 attempts/min (stricter)
  - [x] Export endpoint: 1 per 24h (as mentioned above)

- [ ] **Rate limit headers:**
  - [ ] `X-RateLimit-Limit: 100`
  - [ ] `X-RateLimit-Remaining: 99`
  - [ ] `X-RateLimit-Reset: [Unix timestamp]`
  - [ ] `Retry-After: 60` (when limit exceeded)

### Input Validation

- [ ] **All inputs validated with zod:**
  - [ ] Type checking (email, UUID, numbers)
  - [ ] Length limits (meal name max 200 chars, notes max 1000)
  - [ ] Format validation (dates, decimals for weight)
  - [ ] No HTML/script injection in text fields

- [ ] **Database queries safe from SQL injection:**
  - [ ] Uses Prisma ORM or similar (parameterized queries)
  - [ ] No raw SQL string concatenation

---

## Regional Compliance

### Austria-Specific

- [x] **Impressum published**
  - [x] Operator: Phillip Kofler
  - [x] Address: Villach, Kärnten, Österreich
  - [x] Contact: [Email in code]
  - [x] Business info: Software development

- [x] **Datenschutzerklärung in German**
  - [x] Accessible at /datenschutz
  - [x] Covers DSGVO & Austrian DSG
  - [ ] Mentions special category data (health) explicitly

- [x] **ECG § 5 compliance**
  - [x] Impressum with operator info
  - [x] Accessible from footer (one-click rule)

### EU-Wide (GDPR)

- [x] **Data storage in EU or with SCCs**
  - [x] PostgreSQL on AWS/Azure (need to verify region)
  - [ ] If non-EU: Standard Contractual Clauses documented

- [ ] **Data Protection Authority Notification**
  - [ ] If processing >5,000 residents of EU: May need DPA registration
  - [ ] If high-risk processing (health data): Mandatory DPA notification
  - [ ] Document notification in SECURITY.md or COMPLIANCE.md

- [ ] **Schrems II Assessment**
  - [ ] If US-based hosting: Evaluate adequacy of SCCs post-Schrems II
  - [ ] Document mitigation if deployed to US region

### GDPR-Specific (Health Data)

- [ ] **Article 9 Processing Conditions**
  - [ ] Explicit consent given and logged ✓ (see consent table above)
  - [ ] Data minimization practiced ✓
  - [ ] Legitimate health/fitness purpose ✓
  - [ ] Adequate security measures ✓ (encryption, access control)
  - [ ] Data subject not objecting ✓ (easy withdrawal)

- [ ] **DPIA (Data Protection Impact Assessment) — Optional but Recommended**
  - [ ] Given the health data processing, a DPIA would be appropriate
  - [ ] Document: Purpose, necessity, risks, mitigations
  - [ ] Keep for 3 years
  - [ ] Share with DPA if requested

---

## Testing & Verification

### Unit Tests

- [ ] **Data export endpoint**
  - [ ] Export endpoint returns all user data
  - [ ] No sensitive data (password hash, tokens)
  - [ ] JSON format is valid
  - [ ] Large exports (1000+ meal logs) handled correctly

- [ ] **Data deletion workflow**
  - [ ] User marked as deleted immediately
  - [ ] User cannot log in after soft-delete
  - [ ] Hard-delete job runs and removes after 90 days
  - [ ] Audit log preserved after hard-delete

- [ ] **Consent enforcement**
  - [ ] Photo analysis fails if consent not granted
  - [ ] Analytics not sent if consent withdrawn
  - [ ] Consent withdrawal is immediate

### Integration Tests

- [ ] **E2E flow: New user signup**
  1. User signs up with email
  2. Consent form shown (health data processing)
  3. User checks box and submits
  4. Consent recorded in database
  5. User can now create meal log
  6. Verify: `consents.health_data_processing == true`

- [ ] **E2E flow: Data export**
  1. User logs in
  2. Requests export from Settings
  3. Receives JSON file
  4. Verify: All meal logs, weight entries, diet plans included
  5. Verify: No password hash or tokens

- [ ] **E2E flow: Account deletion**
  1. User requests account deletion
  2. User receives email confirmation
  3. User has 90 days to cancel
  4. After 90 days: User cannot log in
  5. Hard-delete job runs
  6. Verify: User data removed from database
  7. Verify: Audit log preserved

### Security Testing

- [ ] **SQL Injection testing**
  - [ ] Try: `' OR '1'='1` in meal name field
  - [ ] Try: `admin'; DROP TABLE users; --` in notes
  - [ ] Verify: Sanitized or rejected

- [ ] **XSS testing**
  - [ ] Try: `<script>alert('XSS')</script>` in meal name
  - [ ] Try: `<img src=x onerror="alert('XSS')">` in notes
  - [ ] Verify: Escaped or rejected

- [ ] **CSRF testing**
  - [ ] Try: Cross-site form submission to delete account
  - [ ] Verify: CSRF token required or SameSite cookie rejects it

- [ ] **Rate limit testing**
  - [ ] Try: 101 requests in 60 seconds
  - [ ] Verify: 429 Too Many Requests after limit
  - [ ] Verify: Retry-After header present

### Compliance Verification

- [ ] **Audit log verification**
  - [ ] Export user's audit log (from data export)
  - [ ] Verify: Shows all actions (login, meal log created, export requested)
  - [ ] Verify: No sensitive data logged

- [ ] **GDPR rights verification**
  - [ ] Right to access: Export works
  - [ ] Right to erasure: Deletion works
  - [ ] Right to portability: Export is machine-readable
  - [ ] Right to withdraw consent: Happens immediately

---

## Deployment Readiness

### Pre-Production (Staging)

- [ ] **Legal documents in place**
  - [ ] Impressum, Datenschutz, AGB accessible from footer
  - [ ] All placeholders filled (emails, addresses)
  - [ ] No broken links

- [ ] **Backend endpoints implemented**
  - [ ] Data export: GET /api/users/:id/export
  - [ ] Data deletion: DELETE /api/users/:id
  - [ ] Consent management: POST /api/consents, PATCH /api/consents/:id
  - [ ] All endpoints tested and working

- [ ] **Security verified**
  - [ ] HTTPS/TLS 1.3 working
  - [ ] No secrets in codebase (gitleaks clean)
  - [ ] No high-severity vulnerabilities (npm audit clean)
  - [ ] Security headers present

- [ ] **Documentation ready**
  - [ ] SECURITY.md: How to report vulnerabilities
  - [ ] PRIVACY_POLICY.md or link in README
  - [ ] Architecture docs mention health data handling
  - [ ] Deployment docs mention encryption setup

### Production Launch

- [ ] **Monitoring enabled**
  - [ ] Error tracking (Sentry, Rollbar)
  - [ ] Uptime monitoring
  - [ ] Log aggregation (ELK, Datadog)
  - [ ] Alerts configured for critical errors

- [ ] **Backups verified**
  - [ ] Daily backups encrypted
  - [ ] Test restore (can recover a deleted user within 30 days)
  - [ ] Retention policy documented (30 days active, then delete)

- [ ] **DPIA completed (optional but recommended)**
  - [ ] Documented assessment of health data processing risks
  - [ ] Mitigations documented
  - [ ] Kept on file for 3 years

---

## Known Limitations & Upgrade Paths

| Limitation | Ceiling | Upgrade Path |
| ----------- | --------- | -------------- |
| **Photos deleted after AI analysis, no recovery** | User cannot request resend of photo for re-analysis | Optionally keep photo for 30 days if user opts in; implement in preferences |
| **Audit logs stored in same DB as user data** | If DB is breached, audit trail compromised | Extract audit logs to separate secure storage (e.g., S3 with versioning, append-only) |
| **No formal incident response plan** | No defined escalation for security breaches | Document incident response procedure in SECURITY.md |
| **Consent stored per-user, not versioned** | If T&Cs change, cannot track which version user consented to | Add `consent_version` field to track policy version per consent grant |

---

## Timeline

| Phase | Deliverables | Effort | Deadline |
| ------- | -------------- | -------- | ---------- |
| **1: Verification** | Audit existing legal pages, verify backend structure | 1–2 days | 2026-08-25 |
| **2: Backend Implementation** | Data export, deletion, consent tracking APIs | 5–7 days | 2026-09-01 |
| **3: Testing & Security** | E2E tests, security audit, penetration testing | 3–5 days | 2026-09-08 |
| **4: Documentation** | SECURITY.md, deployment runbook, DPIA | 2–3 days | 2026-09-13 |
| **5: Launch** | Production deployment, monitoring enabled | Ongoing | 2026-09-15+ |

---

## Status Summary

| Category | Status | Priority |
| ---------- | -------- | ---------- |
| **Legal Documents** | ✅ Complete | — |
| **Frontend (Footer, Cookies)** | ✅ Complete | — |
| **Backend (Export, Deletion)** | ❌ Missing | **CRITICAL** |
| **Consent Management** | ❌ Missing | **CRITICAL** |
| **Security (Encryption, Access Control)** | ⚠️ Partial | **HIGH** |
| **Photo Handling** | ⚠️ Verify | **HIGH** |
| **Audit Logging** | ⚠️ Verify | **MEDIUM** |
| **DPIA/Documentation** | ❌ Missing | **MEDIUM** |

---

**Critical Path:** Implement data export, deletion, and consent endpoints before full production launch.

**Next Step:** Review `apps/api/src/routes/users.routes.ts` and implement GDPR endpoints (Phase 2).
