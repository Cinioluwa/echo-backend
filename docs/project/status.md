# Echo — Status, Differentiators, and Shipping Plan

## Why this doc exists
Peers/pitch feedback: foundations are solid (auth, multitenancy, core CRUD). Now the question is: **what features are we shipping that create a real wedge + measurable impact?**

This doc turns feature ideas into:
- **A prioritized roadmap**
- **Concrete MVP slices** we can ship without breaking existing APIs
- **Prod hardening checklist** (things we must not “leave experimental”)

---

## Differentiators (what Echo becomes known for)
1. **Anonymous, trusted reporting** (privacy + credibility)
2. **Institution response accountability** (SLAs + evidence + verification)
3. **Signal over noise** (surges/clustering, prioritization scores, crisis detection)
4. **Admin-grade analytics** (response time, category deep-dives, resolution rates, activity)

---

## Now / Next / Later (shipping-focused)

### NOW (Ship in 1–2 weeks)
**Goal:** deliver 1–2 features that visibly change the product story.

0) **Preseeded Organization Leadership Claim + Category Lock** ✅ DONE (Mar 6, 2026)
- Added claim lifecycle for preseeded organizations (`PENDING`, `APPROVED`, `REJECTED`) with super-admin review APIs.
- Enforced strict claim-domain matching (`requester email domain` must equal `Organization.domain`).
- Added duplicate pending-claim prevention while still allowing re-apply after rejection.
- Locked category customization until leadership claim is approved; category read remains available.
- Seeded default categories to ensure students can still post while organization leadership is unverified.

1) **Google Authentication & Frontend Handoff** ✅ DONE
- Backend: `google-auth-library` integration, JWT issuance, auto-registration.
- Infrastructure: Google Cloud Console setup, Railway env vars configured.
- Testing: Integration tests (mocked) + Manual verification (HTML client).
- Handoff: Updated README, Postman collection, and testing guides for Tomi.

2) **Response Time Tracking (Lifecycle timestamps + basic analytics)** ✅ DONE
- Track: `acknowledgedAt`, `resolvedAt` (plus existing workflow timestamps)
- Output: response-time analytics + admin endpoints (acknowledge/resolve)

3) **Wave Moderation (Statuses + Admin Approvals)** ✅ DONE
- Added `Wave.status` (same enum as Ping)
- Admin moderation endpoints:
  - `GET /api/admin/waves` (pagination + optional `status`)
  - `PATCH /api/admin/waves/:id/status`
- Product rule enforced: approving a wave resolves its parent ping

4) **Weekly Dashboard Windows + Active Users Metric** ✅ DONE
- Weekly time-window support (query: `weeks`, `offsetWeeks`) for:
  - `GET /api/admin/stats`
  - `GET /api/admin/analytics/by-level`
  - `GET /api/admin/analytics/by-category`
- New endpoint: `GET /api/admin/analytics/active-users`
- Handoff updates: README + Postman collection + Postman testing guide updated

5) **MVP Trending + Priority + Ping Sentiment (Admin analytics)** ✅ DONE
- Trending (week-over-week) endpoint:
  - `GET /api/admin/analytics/trending?weeks=1&offsetWeeks=0`
- Priority list endpoint:
  - `GET /api/admin/pings/priority?weeks=1&offsetWeeks=0&limit=20`
- Sentiment (pings-only; deterministic, no LLM) endpoint:
  - `GET /api/admin/analytics/sentiment?weeks=1&offsetWeeks=0`

6) **In-app Notifications + Best-effort Email (important updates)** ✅ DONE
- In-app notification feed endpoints (auth):
  - `GET /api/notifications` (query: `page`, `limit`, optional `unreadOnly=true`)
  - `GET /api/notifications/unread-count`
  - `PATCH /api/notifications/:id/read`
- Notification events (MVP):
  - `WAVE_APPROVED` (admin approves wave → notifies ping author)
  - `OFFICIAL_RESPONSE_POSTED` (rep posts official response → notifies ping author)
  - `ANNOUNCEMENT_POSTED` (admin posts announcement → notifies org users excluding author)
- Email sending is best-effort and depends on SMTP/Resend configuration.

3) **Evidence Uploads for “Resolved” + Reporter Verification Prompt**
- Admin must attach evidence to mark resolved
- After resolved: ask original reporter “Was this actually fixed?” (even if anonymous)

> Why now: This directly supports institutional trust + measurable “impact” metrics.

---

### NEXT (Ship in 2–4 weeks)
3) **Issue Prioritization Engine (v1)**
- Priority score and urgency classification (LOW/MEDIUM/HIGH/CRITICAL)
- Sort feeds by priority
- Simple transparent scoring explanation in API response

4) **Public Resolution Log** ✅ DONE
- Dedicated feed of resolved items (organization-scoped)
- Endpoint: `GET /api/public/resolution-log`

---

### LATER (Ship in 1–2 months)
5) **Crisis / Early Warning System**
- Spike detection (category surge growth)
- Keyword triggers (careful: avoid unsafe automation; treat as “review queue”)

6) **Mood Pulse / Sentiment (lightweight v1)**
- Basic keyword-based sentiment for last 24h (clearly labeled “beta”)

---

## Feature Specs (turn ideas into implementable scopes)

### 1) Anonymous Reporting System 🔒 (refine current behavior)
**MVP**
- Add `anonymousMode`/`isAnonymous` at ping creation (already exists) but ensure:
  - Author identity never leaks in responses
  - Reporter can still receive follow-ups (via a private channel token)

**Later**
- “Verified anonymous users”: store verification state separately from public identity.

**Acceptance criteria**
- When `isAnonymous=true`, all API reads return `author: null`.
- Reporter can still confirm resolution without exposing identity.

---

### 2) Issue Prioritization Engine 📊
**Score formula (v1)**
$$
\text{score} = (\text{surgeCount}) + 1.5 \cdot (\text{commentCount}) + 0.5 \cdot (\text{upvotes}) + (\text{categoryWeight})
$$

**MVP**
- Add computed fields on read: `priorityScore`, `urgency`
- Store `categoryWeight` in Category (default 0)

**Notes (scope control)**
- v1 should be explainable (no opaque ML score yet)
- Keep it additive: compute in queries/services first; only persist later if needed for sorting

**Non-breaking approach**
- Compute initially in query/service (no DB migration required for v1)
- Later: store score snapshots for faster sorting

---

### 3) Early Warning System 🚨
**MVP**
- Detect spikes: e.g. category count change > 300% in 1 hour
- Create internal “alerts” (admin-only list) — do not auto-publish

**Risk controls**
- Keyword triggers only route to review; do not label as “danger” automatically.

---

### 4) Sentiment Analysis 📉
**MVP**
- Keyword scoring (label clearly)
- Output: `moodPulse24h` per organization

**Path to “real” value (incremental, still safe)**
- v1: lightweight sentiment on Ping content + Comment content (store aggregate only)
- v2: category sentiment (per category per week)
- v3: topic/sentiment pairing (e.g., stability complaints rising)

---

### 5) Response Time Tracking ⏱️ (Top priority)
**Status: DONE (Jan 2, 2026)**

**Lifecycle timestamps**
- `submittedAt`: when ping enters review flow
- `acknowledgedAt`: when admin first views/acknowledges
- `resolvedAt`: when marked resolved

**MVP outputs**
- Avg resolution time per category
- % acknowledged within SLA (configurable)
- % resolved within SLA

---

### 6) Trust & Transparency ✅
**MVP**
- Resolution requires evidence
- Reporter verification prompt
- Public resolution log

---

### 7) Institution Dashboard Analytics 📈
**MVP**
- Executive snapshot: open issues, resolution rate (7d), avg response time
- Category deep-dive
- SLA compliance

**Status: PARTIALLY DONE**
- ✅ Response-time analytics endpoint exists
- ✅ Weekly windows + active users metric exist (supports week-over-week dashboard deltas)

---

## Execution Plan (systematic, minimizes breakage)

### Frontend integration handoff (for Tomilola)
**What to share from the repo**
- `README.md` (API overview + setup + auth rules)
- `postman_collection.json` (import into Postman; set `baseUrl` and `authToken`)
- `POSTMAN_TESTING_GUIDE.md` (how to test + seeded users)

**API contract rule while shipping**
- Keep changes additive for already-used endpoints: don’t remove/rename fields or paths; make new fields optional.
- If a breaking change is unavoidable, add a new endpoint/field and deprecate the old one.

**Google auth endpoint (docs standard)**
- Prefer: `POST /api/auth/google`
- Legacy alias: `POST /api/users/google`

### Branching / deployment hygiene
- Keep `main` stable for staging (Tomi integrates against it).
- Do feature work on branches (e.g., `feature/next-sprint`) and merge when tests pass and docs/Postman are updated.

### Phase 0 — Guardrails (1–2 days)
- Add a lightweight “feature flags” mechanism (env-based is fine for now).
- Keep changes **additive**: new columns nullable, new endpoints optional, no breaking response shapes.

### Phase 1 — Data model + migrations (additive only)
- Add new fields as nullable first (or with safe defaults).
- Backfill in a script only after deployment is stable.

### Phase 2 — Vertical slices (ship feature-by-feature)
For each feature:
1. Schema + migration (if needed)
2. Controller/service changes
3. Integration tests (Vitest)
4. E2E smoke for critical path (Playwright)
5. Rollout behind flag → enable for one org → enable globally

### Phase 3 — Stabilization + observability
- Add monitoring, error tracking, dashboards
- Implement CORS tightening & rate limiting **behind env flags**, keep relaxed for dev; enable only pre-prod.

---

## Pre-Production TODO (Hardening / Must-do before real scale)
Track items we should **implement now if convenient**, but **keep disabled or relaxed in dev** so we don’t make development hell.

**Rule of thumb:** build the switches early; flip them only when we’re approaching prod.

### Auth / Identity
- [x] Google sign-in: Backend verification, tests, and docs are DONE.
- [x] Dev unblock: frontend CORS includes Vite (`localhost:5173`).
- [ ] **Email verification link → activation (Frontend Integration Required)**
  - Backend route: `POST /api/users/verify-email` with body `{ "token": "..." }` activates the user (and can auto-activate org admins when `ORG_ONBOARDING_AUTO_ACTIVATE=true`).
  - Email link format is built from `APP_URL` as: `${APP_URL}/verify-email?token=...`.
  - Frontend should implement `/verify-email` page to read `token` from the URL and call the backend route, then show success/error.
  - If clicks “do nothing”, it’s usually because `APP_URL` points to a domain that doesn’t serve the frontend verify page (or is broken), so the backend never receives the POST.
- [ ] **Google Console MVP Transition (Required for Launch)**
  - **Publish App:** Switch OAuth consent screen from "Testing" to "Published" (removes 100-user limit).
  - **Verification:** Submit for verification if sensitive scopes are added (currently not needed for basic email/profile).
  - **Legal:** Add Privacy Policy and Terms of Service URLs to the consent screen.
  - **Domains:** Add production domain (e.g., `echo-app.com`) to "Authorized Domains" in Google Console.
- [x] Enforce org-domain scoping in Google auth (blocks consumer domains; requires org domain to exist).
- [x] Added org onboarding approval workflow (SUPER_ADMIN) + auto-activation switch
  - Env: `ORG_ONBOARDING_AUTO_ACTIVATE` (dev default true; set false in prod for manual approval)
  - Endpoints:
    - `GET /api/admin/organization-requests?status=PENDING`
    - `POST /api/admin/organization-requests/:id/approve`
    - `POST /api/admin/organization-requests/:id/reject`
  - Staging helper: `node scripts/upsert-school-orgs.mjs` (upserts `stu.cu.edu.ng`, `covenantuniversity.edu.ng` as ACTIVE)
  - Manual rehearsal: follow the “End-to-End User Journey (Launch-day simulation)” section in `MANUAL_TESTING_GUIDE.md`
- [ ] **Onboarding anti-abuse + cleanup (reduce “junk” PENDING rows)**
  - Problem: anyone with an org email (e.g., a student) can submit onboarding and create `PENDING` org/user/request rows.
  - MVP mitigation: keep `ORG_ONBOARDING_AUTO_ACTIVATE=false` in prod so nothing goes live without SUPER_ADMIN approval.
  - [x] Implemented a stale-request cleanup script (auto-rejects old `PENDING` org requests): `node scripts/cleanup-stale-org-requests.mjs --days=30` (use `--dry-run` to preview).
  - Decision (for now): keep this as an ad-hoc script (no scheduled job in prod yet).
  - Add later: stricter onboarding validation (DNS TXT proof, staff-only email patterns, etc.).

- [x] **Join policy enforcement + open-domain lock (Mar 2026)**
  - Added `Organization.joinPolicy` with `OPEN` and `REQUIRES_APPROVAL`.
  - Added open-domain support (`Organization.domain` nullable) and immutable lock behavior for open-domain orgs.
  - Domain match now identifies org only; access still respects join policy.
  - Added `OrganizationJoinRequest` queue with admin approve/reject flows.
  - Added admin endpoints:
    - `GET /api/admin/organization/settings`
    - `PATCH /api/admin/organization/join-policy`
    - `GET /api/admin/organization/join-requests`
    - `POST /api/admin/organization/join-requests/:id/approve`
    - `POST /api/admin/organization/join-requests/:id/reject`

### Observability
- [ ] Sentry (API errors + performance traces)
- [ ] Request tracing (requestId propagation, latency per route)
  - Status: requestId + request/response duration logs already exist.
- [ ] Monitoring/analysis for prod (logs → metrics → alerts)
  - Status: production logger uses structured JSON; still needs log shipping + dashboards/alerts.

### Configuration / Secrets
- [ ] JWT secret hardening
  - Status: `JWT_SECRET` is validated but currently only requires 4 characters, and some code paths read `process.env.JWT_SECRET` directly.

**Railway / env notes (email links + frontend hosting)**
- `APP_URL` should be the *frontend* base URL that serves `/verify-email` (e.g., Vercel domain) once the frontend is deployed.
- When frontend domain changes (e.g., staging → prod), update `APP_URL` accordingly so emails point to the right place.
- Add the frontend domain to backend CORS allowlist (`allowedOrigins` in `src/app.ts`) so the verify page can call the API.
  - Pre-prod: require a strong secret (e.g., 32+ bytes) and use the validated `env.JWT_SECRET` consistently.

### Security
- [ ] CORS: make allowed origins configurable per environment
  - Status: currently enforced via a hard-coded allowlist (includes localhost + 2 prod domains).
  - Pre-prod: move allowlist to env config; keep dev permissive for local frontend ports.
- [ ] Rate limiting: Redis-backed in multi-instance prod
  - Status: `express-rate-limit` is implemented.
  - ✅ Redis store: if `REDIS_URL` is set, rate limiting uses Redis (safe for multi-instance).
  - Fallback: if `REDIS_URL` is not set, rate limiting uses in-memory store (OK for single instance).
- [ ] Redis (scaling): not integrated yet
  - Status: Redis is now used for rate limiting when `REDIS_URL` is present.
  - Still TODO: caching layer (only if/when needed).
- [ ] Audit logging for admin actions (who changed what/when)

### Reliability
- [ ] Background jobs (email retries, alert generation) if needed
- [ ] Safe migrations + rollback plan
- [ ] Email deliverability (verification + password reset)
  - Status: emails are skipped if SMTP env vars are not configured.
  - Pre-prod: configure SMTP + set `APP_URL` correctly so links work.

### Storage (only needed once we ship evidence/uploads)
- [ ] Evidence uploads: choose object storage + upload strategy
  - Status: no file upload/storage integration exists yet.
  - Pre-prod: prefer object storage + signed URLs; avoid storing large blobs in Postgres.

### Dev-only knobs (keep off in prod)
- [ ] `REQUEST_FILE_LOG` / `DEBUG_ROUTE_LOG` should remain disabled in prod.

### Testing / CI
- [ ] Smoke tests in CI for critical endpoints
- [ ] Migration checks + schema drift checks

---

## Notes / Open Questions
- What is “resolved” vs “progressStatus”? Define canonical workflow and enforce it.
- Evidence storage: S3-like bucket vs DB blob (prefer object storage).
- Reporter verification UX: one-click confirm/deny with signed token.