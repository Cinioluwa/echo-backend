# Implement Post Reporting

This plan covers the backend work needed for the frontend's new "three-dot" post menu: the reporting mechanism, admin review workflow, and reporter notifications.

## User Review Required

> [!WARNING]
> Since we are adding a new `Report` table to handle cross-entity reporting (Pings, Waves, Comments), Prisma will generate a migration. We will run `npx prisma db push` to synchronize these database changes locally after you approve.

## Proposed Changes

---

### Database Schema (Prisma)

#### [MODIFY] [schema.prisma](file:///c:/Users/USER/Desktop/C.I.A/echo-backend/prisma/schema.prisma)
- Add `ReportStatus` enum (`PENDING`, `REVIEWED`, `RESOLVED`, `DISMISSED`)
- Append `POST_REPORTED` to `NotificationType` enum.
- Add new `Report` model. It will include:
  - `id`, `reason (String?)`
  - relations to `pingId`, `waveId`, `commentId`, `reporterId`, `organizationId`
  - `status (ReportStatus)`

---

### Endpoints and Logic

#### [NEW] [reportSchemas.ts](file:///c:/Users/USER/Desktop/C.I.A/echo-backend/src/schemas/reportSchemas.ts)
- Add validation schemas for creating a report and updating report status.

#### [NEW] [reportController.ts](file:///c:/Users/USER/Desktop/C.I.A/echo-backend/src/controllers/reportController.ts)
- Add `createReport`: Handles user submissions for reporting posts. This fires a `POST_REPORTED` notification to Admins.
- Add `getReports`: For admins to view all flagged posts globally across `Ping`, `Wave`, and `Comment`.
- Add `updateReportStatus`: For admins to review/dismiss reports. 

#### [NEW] [reportRoutes.ts](file:///c:/Users/USER/Desktop/C.I.A/echo-backend/src/routes/reportRoutes.ts)
- Set up `POST /api/reports` (requires authentication).
- Set up `GET /api/reports` (requires Admin or Super Admin).
- Set up `PATCH /api/reports/:id/status` (requires Admin or Super Admin).

#### [MODIFY] [app.ts](file:///c:/Users/USER/Desktop/C.I.A/echo-backend/src/app.ts)
- Register `reportRoutes` into the express app.

---

## Advice for Frontend Developer on Link Embeds

> [!IMPORTANT]
> **The embed feature is purely a frontend concern.** The backend already exposes all the data needed (title, content, media). The backend does NOT need to serve OG HTML tags.

Platforms like Telegram and LinkedIn send bots/crawlers to fetch page previews. These bots **do not execute JavaScript**, so a React SPA will return an empty `<head>` with no useful metadata.

**The fix depends on the frontend setup:**

- **Next.js (recommended)**: Use `generateMetadata()` in the `app/feed/[id]/page.tsx` route. This function runs server-side and can call the existing ping/wave API to read the title, content, and first media image before rendering the page. The `<meta property="og:..." />` tags are injected at build/request time. **No backend changes needed.**

- **React SPA (Vite/CRA)**: Next.js migration is the cleanest path. Alternatively, a Node.js prerender middleware (e.g., `prerender.io` or `rendertron`) can intercept bot requests and serve a pre-rendered version of the app. This is more complex to maintain.

The critical data the frontend needs for OG tags from the existing API:
- `title` (Ping) or the parent Ping's `title` (Wave)
- `content` (truncated to ~160 chars for description)
- `media[0].url` for the image preview
- The canonical URL `https://app.echo-ng.com/feed/:id`

## Verification Plan

### Automated Tests
- Run integration tests (if set up) to ensure new routes do not crash the app.
- Hit the embed endpoint via a mock request to see if raw HTML is returned perfectly. 
- Validate Prisma updates run properly.

### Manual Verification
- Ask the user to verify `npx prisma generate` runs smoothly.
- View the new routes in action locally via REST client.
