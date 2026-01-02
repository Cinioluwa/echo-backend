# Echo Backend API

Backend server for the Echo application — a social feedback platform for university students with multitenancy support.

## What's inside
- Auth with JWT (register, login, Google OAuth, profile management)
- Multitenancy: Organization-scoped data isolation (pings, waves, comments, surges, announcements)
- Pings (issues), Waves (solutions), Comments, Surges (likes), Official Responses
- Roles: USER, REPRESENTATIVE, ADMIN with protected routes
- Security: Validation (Zod), rate limiting, CORS, Helmet, structured logging
- Testing: Unit, integration, and E2E suites (Vitest, Supertest, Playwright)

## Tech stack
- Runtime: Node.js + TypeScript (ES modules)
- Framework: Express 5
- Database: PostgreSQL (Neon) with Prisma ORM
- Auth: JWT + Google OAuth (google-auth-library)
- Dev tooling: tsx watch, ESLint (flat), Prettier, Nodemon
- Testing: Vitest (unit/integration), Playwright (E2E)
- Container: Dockerfile (optional for app image)

## Quick start (local)

1) Install dependencies

```powershell
npm install
```

2) Connect to Neon (Postgres-as-a-service)

- Create a project and database in Neon
- Copy the connection string
- Ensure TLS is required (Neon uses SSL); include `sslmode=require` in the URL

Example `DATABASE_URL` (replace placeholders):

```env
postgresql://<user>:<password>@<neon-host>/<database>?sslmode=require
```

3) Create `.env`

Create a `.env` file in the project root with at least the following variables:

```env
# Required
DATABASE_URL="postgresql://<user>:<password>@<neon-host>/<database>?sslmode=require"
JWT_SECRET="replace_with_a_strong_random_secret"

# Optional
PORT=3000
NODE_ENV=development
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
```

4) Apply Prisma migrations and generate client

```powershell
npx prisma migrate dev
npx prisma generate
```

Note: For production, use `npx prisma migrate deploy`.

4b) Optional — seed multitenancy test data (recommended for trying features)

```powershell
node setup-multitenancy-tests.js
```

Details and test credentials are listed in the "Multitenancy: seed test data" section below.

5) Run the API (dev)

```powershell
npm run dev
```

The server listens on `http://localhost:${PORT}` (default `3000`). Health check: `GET /healthz` → `{ status: "ok" }`.

6) Optional — Run tests

```powershell
# Unit and integration tests
npm run test

# E2E tests (requires seeded data)
npm run test:e2e
```

## Available scripts

- `npm run dev` — Run dev server with hot reload (tsx watch)
- `npm run build` — TypeScript build to `dist/`
- `npm start` — Run compiled app (`dist/server.js`)
- `npm run prisma:migrate` — `prisma migrate dev`
- `npm run prisma:generate` — Generate Prisma Client
- `npm run lint` / `npm run lint:fix` — ESLint checks / autofix
- `npm run format` / `npm run format:check` — Prettier format / check
- `npm run test` — Run unit and integration tests (Vitest)
- `npm run test:unit` — Run unit tests only
- `npm run test:integration` — Run integration tests
- `npm run test:e2e` — Run E2E tests (Playwright)

## Project structure

```
echo-backend/
├── src/
│   ├── server.ts                # App entry (Express + middlewares + routes)
│   ├── app.ts                   # Express app factory (for testing)
│   ├── config/                  # env, db (Prisma), logger (Winston)
│   ├── controllers/             # Route handlers (auth, pings, waves, admin, etc.)
│   ├── middleware/              # auth, admin/rep guards, validation, errors, request logger, organization context
│   ├── routes/                  # Express routers (users, pings, waves, comments, surges, admin, announcements, public)
│   ├── schemas/                 # Zod schemas (validation + pagination)
│   ├── services/                # Business logic (email, Google auth, tokens)
│   ├── types/                   # Shared TS types (AuthRequest, etc.)
│   └── utils/                   # Utility functions
├── prisma/
│   ├── schema.prisma            # Prisma schema (User, Ping, Wave, Comment, Surge, OfficialResponse, Announcement, Organization)
│   ├── test-schema.prisma       # Test schema (SQLite)
│   └── migrations/              # Migration history
├── tests/
│   ├── unit/                    # Unit tests
│   ├── integration/             # Integration tests (with SQLite DB)
│   ├── e2e/                     # E2E tests (Playwright, API-only)
│   ├── fixtures/                # Test data factories
│   ├── vitest.config.ts         # Vitest config
│   └── playwright.config.ts     # Playwright config
├── logs/                        # Winston log files (error.log, combined.log in prod)
├── Dockerfile                   # Build a production image (connects to Neon)
├── setup-multitenancy-tests.js  # Seed script for test data
├── package.json                 # Scripts and deps
├── tsconfig.json                # TS config (NodeNext)
└── tsconfig.build.json          # TS config for production builds
```

## Environment variables

Validated at startup via Zod (`src/config/env.ts`). Required unless noted.

| Variable          | Required | Description                                      | Example |
|-------------------|----------|--------------------------------------------------|---------|
| DATABASE_URL      | Yes      | PostgreSQL connection string (Neon)              | `postgresql://user:pass@neon-host/db?sslmode=require` |
| JWT_SECRET        | Yes      | Secret key for JWT signing                       | `a_really_strong_random_string` |
| GOOGLE_CLIENT_ID  | No       | Google OAuth Client ID (for Google Sign-In)      | `123456789.apps.googleusercontent.com` |
| PORT              | No       | Port Express listens on (default 3000)           | `3000` |
| NODE_ENV          | No       | `development` / `production` / `test`            | `development` |
| APP_URL           | No       | Base URL for the app (default localhost:3000)    | `https://yourapp.com` |
| SMTP_HOST         | No       | SMTP host for email (optional for email features)| `smtp.gmail.com` |
| SMTP_PORT         | No       | SMTP port                                        | `587` |
| SMTP_USER         | No       | SMTP username                                    | `your-email@gmail.com` |
| SMTP_PASS         | No       | SMTP password                                    | `your-app-password` |

**📝 Note**: See `GOOGLE_AUTH_IMPLEMENTATION.md` and `GOOGLE_AUTH_TESTING_GUIDE.md` for Google OAuth setup. Email is optional but required for password resets and organization requests.

## Base URL and auth

- Base URL for APIs: `/api`
- Protected routes require `Authorization: Bearer <JWT>`
- Pagination: `?page=<number>&limit=<number>` on most list endpoints
- Multitenancy: All data is scoped to the user's organization (inferred from email domain)

## API overview

All JSON bodies are validated with Zod. Many list endpoints accept optional pagination.

### Auth — `/api/users` & `/api/auth`
- `POST /api/users/register` — Register (email, password, firstName, lastName, level?)
- `POST /api/users/login` — Login, returns JWT
- `POST /api/auth/google` — **Google OAuth Sign-In/Sign-Up** (body: { idToken }) **(preferred)**
- `POST /api/users/google` — Google OAuth Sign-In/Sign-Up (body: { idToken }) (legacy alias)
- `POST /api/users/verify-email` — Verify email with token from registration
- `POST /api/users/forgot-password` — Request password reset (sends email)
- `PATCH /api/users/reset-password` — Reset password with token from email
- `POST /api/users/organization-waitlist` — Request new organization onboarding
- `GET /api/users/me` — Current user profile (Authorization: Bearer token)
- `PATCH /api/users/me` — Update profile: firstName, lastName, level (auth)
- `DELETE /api/users/me` — Delete account (auth)
- `GET /api/users/me/surges` — My surges (auth)
- `GET /api/users/me/comments` — My comments (auth)

### Pings — `/api/pings`
- `GET /` — List pings with optional filters: `category`, `status`, plus pagination
- `GET /search` — Search by `hashtag` or `q` (text), plus pagination
- `GET /me` — List my pings (auth, with pagination)
- `GET /:id` — Get ping by id
- `POST /` — Create ping (auth)
- `PATCH /:id` — Update ping (auth)
- `DELETE /:id` — Delete own ping (auth)
- `PATCH /:id/status` — Update status (admin only)
- `PATCH /:id/submit` — Mark ping as submitted (representative only)

### Waves — nested and standalone
- `GET /api/pings/:pingId/waves` — Waves for a ping (pagination)
- `POST /api/pings/:pingId/waves` — Create wave for a ping (auth)
- `GET /api/waves/:id` — Get wave by id (standalone)
- `PATCH /api/waves/:id` — Update wave (auth, author only)
- `DELETE /api/waves/:id` — Delete wave (auth, author only)

### Comments
- `GET /api/pings/:pingId/comments` — Comments for a ping
- `POST /api/pings/:pingId/comments` — Add a comment to a ping (auth)
- `GET /api/waves/:waveId/comments` — Comments for a wave
- `POST /api/waves/:waveId/comments` — Add a comment to a wave (auth)

### Surges (likes)
- `POST /api/pings/:pingId/surge` — Toggle surge for a ping (auth)
- `POST /api/waves/:waveId/surge` — Toggle surge for a wave (auth)

### Official Responses
- `GET /api/pings/:pingId/official-response` — Get official response for a ping
- `POST /api/pings/:pingId/official-response` — Create official response (representative only)

### Announcements
- `GET /api/announcements` — Public announcements with optional filters: `college`, `hall`, `level`, `gender`
- `POST /api/admin/announcements` — Create announcement (admin only)
- `PATCH /api/admin/announcements/:id` — Update announcement (admin only)
- `DELETE /api/admin/announcements/:id` — Delete announcement (admin only)

### Representatives — `/api/representatives`
- `GET /pings/submitted` — Pings marked as submitted (rep-only; pagination)
- `GET /waves/top` — Top waves for review (rep-only)
- `POST /waves/forward` — Forward waves for admin review (rep-only)

### Admin — `/api/admin`
- `GET /stats` — Platform stats (admin)
- `GET /pings` — List all pings with filters/pagination (admin)
- `DELETE /pings/:id` — Delete any ping (admin)
- `PATCH /pings/:id/progress-status` — Update ping progress status (admin)
- `POST /pings/:id/acknowledge` — Mark ping as acknowledged (admin)
- `POST /pings/:id/resolve` — Mark ping as resolved (admin)
- `GET /users` — List users (admin)
- `GET /users/:id` — Get user by id (admin)
- `PATCH /users/:id/role` — Update user role (ADMIN | REPRESENTATIVE | USER) (admin)
- `GET /analytics/by-level` — Pings grouped by level (admin)
- `GET /analytics/by-category` — Pings grouped by category (admin)
- `GET /analytics/response-times` — Response-time analytics (admin) (query: `days`, default 30)
- `POST /announcements` — Create announcement (admin)
- `PATCH /announcements/:id` — Update announcement (admin)
- `DELETE /announcements/:id` — Delete announcement (admin)

### Public
- `GET /api/public/soundboard` — Public pings (organization-scoped)
- `GET /api/public/stream` — Public waves (organization-scoped)

### Categories — `/api/categories`
- `GET /api/categories` — Get all categories for user's organization (auth, optional search: `?q=text`)

### Health check
- `GET /healthz` — `{ status: "ok" }`

## Security and middleware
- CORS enabled (configure origins for production)
- Helmet HTTP headers
- Rate limiting:
  - Global: 500 req / 15 min
  - Auth endpoints `/api/users/register`, `/api/users/login`: 5 attempts / 15 min (successful logins don't count)
  - Create/update operations (POST/PATCH/DELETE): 30 ops / 15 min
- Centralized error handler with safe logging
- Multitenancy middleware: `organizationMiddleware` attaches `req.organizationId` from JWT

## Database schema (Prisma)
Models: `User`, `Organization`, `Ping`, `Wave`, `Comment`, `Surge`, `OfficialResponse`, `Announcement` with enums `Role`, `Status`, `WaveCategory`, `ProgressStatus` and helpful indexes for query performance. See `prisma/schema.prisma`.

Common operations:

```powershell
# Create/refresh dev DB and apply migrations interactively (Neon OK)
npx prisma migrate dev

# Apply migrations in production
npx prisma migrate deploy

# Open Prisma Studio (optional)
npx prisma studio
```

## Testing
- **Unit tests**: Logic in services, middleware, schemas (Vitest)
- **Integration tests**: API endpoints with SQLite DB (Vitest + Supertest)
- **E2E tests**: Full workflows via API (Playwright, API-only)
- Run with seeded data for multitenancy tests. See `TEST_TODO.md` for coverage details.

## Logging
- Human-readable colored logs in development
- JSON structured logs in production
- Files: `logs/error.log` (always), `logs/combined.log` (production)

## Docker (optional)

You can containerize the app with the provided `Dockerfile` and connect it to Neon via `DATABASE_URL`.

```powershell
# Build image
docker build -t echo-backend .

# Run container (pass env vars; example with PowerShell)
docker run -p 3000:3000 `
  -e DATABASE_URL="postgresql://<user>:<pass>@<neon-host>/<db>?sslmode=require" `
  -e JWT_SECRET="<your-secret>" `
  -e NODE_ENV=production `
  echo-backend
```

In production, run migrations prior to starting the containerized app:

```powershell
npx prisma migrate deploy
```

## Multitenancy: seed test data

If you want to quickly try multitenancy flows and organization-scoped APIs, run the provided seed script after applying migrations.

Prerequisites:
- `.env` has a valid `DATABASE_URL`
- You have run `npx prisma migrate dev` (or `deploy` in prod)

Seed command:

```powershell
node setup-multitenancy-tests.js
```

What it does:
- Creates 3 organizations: Covenant University (cu.edu.ng), Test University A (testuniva.edu), Test University B (testunivb.edu)
- Upserts categories per organization
- Creates users in each org with roles ADMIN / REPRESENTATIVE / USER

Test credentials (password for all: `password123`):
- Covenant University: `admin@cu.edu.ng`, `rep@cu.edu.ng`, `student@cu.edu.ng`
- Test University A: `adminA@testuniva.edu`, `studentA@testuniva.edu`
- Test University B: `adminB@testunivb.edu`, `studentB@testunivb.edu`

Notes:
- The script uses upserts, so it's safe to re-run.
- Organization membership is determined by the email domain in your flows. Use the above domains for testing isolation.
- See `MULTITENANCY_TESTING.md` for a checklist and test ideas.

## Pre-deploy: Redis rate limiting (for scaling)

You only need this when running multiple app instances (e.g., AWS Fargate). For single-instance dev, the in-memory limiter is fine.

Steps to enable later:
1) Install packages

```powershell
npm install ioredis rate-limit-redis
```

2) Configure `REDIS_URL` (local or ElastiCache in prod). Example for local:

```env
REDIS_URL=redis://localhost:6379
```

3) In `src/server.ts`, there is a PRE-DEPLOY comment block with a ready-to-uncomment Redis-backed limiter. Uncomment that block and apply it (replace the in-memory limiter).

Optional: Local Redis via docker-compose (if you use compose)

```yaml
services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

volumes:
  redis-data:
```

In production, point `REDIS_URL` to your Amazon ElastiCache endpoint.

## Contributing
1. Fork repository and create a feature branch
2. Develop with `npm run dev`
3. Lint/format before committing: `npm run lint && npm run format`
4. Run tests: `npm run test && npm run test:e2e`
5. Open a Pull Request

## License
Private and proprietary

---

Built with ❤️ for university students
