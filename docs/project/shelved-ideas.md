# Shelved Ideas & Future Concepts

This document serves as a repository for feature ideas and architectural pivots that were discussed but explicitly **shelved** to preserve the core scope and direction of Echo. 

These ideas are preserved here so they are not lost, ensuring we can revisit them if the product strategy shifts.

---

## 1. Non-Institutional Organizations (CSV / Invite-Only)
**Date Shelved:** 2026-01-26
**Context:** Supporting organizations that do not have a corporate email domain (e.g., NGOs, clubs, local communities using Gmail/Yahoo).

### The Concept
- **Mechanism:** Instead of domain matching (`@example.com` -> Org), allow Admins to upload a CSV of emails or generate an Invite Link.
- **Identity:** Users can use personal emails (Gmail, etc.).
- **Security:** Membership is validated by the "Invite List" rather than the email domain.

### Why it was Shelved
- **Focus:** Echo's core differentiator is "Safe, Verified Walled Gardens" for large institutions.
- **Scope Creep:** "Invite-only" groups overlap with general chat apps (Discord/Whatsapp).
- **Technical Cost:** Requires making `domain` optional on Organizations and significant changes to Auth logic.

---

## 2. Notification System & Ad System (Featured Waves)
**Date Shelved:** 2026-01-24
**Context:** Planned during future feature roadmap discussions.

### The Concept
- **Notification System:**
  - **Transactional Emails:** Integration with Resend/SendGrid to send "Ping Resolved" and other lifecycle emails.
  - **Web Push Notifications:** Service Workers for browser-based push alerts.
- **Ad System ("Featured Waves"):**
  - **Super Admin Tools:** Manual promotion endpoints/UI for specific waves.
  - **Database Schema:** `isPromoted` flag on Wave model.

### Why it was Shelved
- **Prioritization:** Focus restricted to Core MVP features (Auth, Response Time, Anonymity) and "Impact" metrics.

---

## 3. Talent Engine (Recruiter/Skills Platform)
**Date Shelved:** 2026-01-26
**Context:** Originally detailed in "Revenue Primitives".
**Original Goal:** Monetize high-performing students by connecting them with recruiters.

### The Concept
- **Data Aggregation:** `isOpenToWork` flags and `verifiedSkills` based on activity.
- **Monetization:** Selling "Top Solvers" lists to recruiters (B2B).
- **Headless Operation:** Manual SQL extraction of top users.

### Why it was Shelved
- **Market Fit:** Needs a critical mass of active users before "talent" data is statistically significant.
- **Privacy:** High risk of looking like we are "selling student data" without explicit, robust consent flows.

---

## 4. Campus Bulletin (Vendor System)
**Date Shelved:** 2026-01-26
**Context:** Originally detailed in "Revenue Primitives".
**Original Goal:** Local ad revenue from campus vendors.

### The Concept
- **Models:** `Vendor`, `BulletinPost`, `ViewLog`.
- **API:** Admin endpoints to manually manage ads.
- **Headless Operation:** Selling "future slots" to vendors.

### Why it was Shelved
- **Distraction:** Distracts from the core "Feedback Loop" value proposition.
- **Operational Overhead:** Requires a sales team/effort to populate, which the current team lacks.

---

## 5. Real-Time Updates (WebSockets / SSE)
**Date Shelved:** 2026-02-04
**Context:** User feedback on stale data and the need for immediate visibility of new content.

### The Concept
- **Real-Time Push:** Implement WebSockets (Socket.io) or Server-Sent Events (SSE) so clients receive instant updates without polling.
- **"New Ping" / "New Wave" Indicators:** When new content is posted in the user's org, push an event to connected clients.
- **UI Enhancements (Frontend):**
  - Toast notifications (e.g., "New Ping posted!").
  - Bold/accent category labels in the sidebar when new content arrives in that category.
  - Optional sound notification for new content.
- **Cache Invalidation Sync:** Real-time events could also signal frontend to invalidate local caches.

### Current State
- A **notification system exists** (database-backed, REST API at `/api/notifications`), but it requires the client to **poll** for updates.
- **No WebSocket/SSE infrastructure** is in place on the backend.

### Why it was Shelved
- **Complexity:** Adding Socket.io or SSE requires session management, authentication handshake, scaling considerations (Redis pub/sub for multi-instance), and deployment changes.
- **MVP Focus:** Polling every 30-60 seconds is sufficient for the current user base. Real-time can be revisited once scale demands it.
- **Frontend Dependency:** The UI indicators (bold labels, toasts, sounds) are entirely frontend work.

---

