# Echo Backend API

Backend server for the Echo application — a social feedback platform for university students.

## What’s inside
- Auth with JWT (register, login, profile, update, delete)
- Pings (issues), Waves (solutions), Comments, Surges (likes)
- Announcements and Official Responses
- Roles: USER, REPRESENTATIVE, ADMIN with protected routes
- Security: validation (Zod), rate limiting, CORS, Helmet, structured logging

## Tech stack
- Runtime: Node.js + TypeScript (ES modules)
- Framework: Express 5
- Database: PostgreSQL
- ORM: Prisma
- Dev tooling: tsx watch, ESLint (flat), Prettier, Nodemon
- Local DB: Docker Compose

## Quick start (local)

1) Install dependencies

```powershell
npm install
```

2) Start PostgreSQL with Docker (optional but recommended for local)

```powershell
docker-compose up -d
```

This spins up Postgres 15 with defaults from `docker-compose.yml`:
- user: `myuser`
- password: `mypassword`
- database: `mydb`
- host: `localhost:5432`

3) Create `.env`

Create a `.env` file in the project root with at least the following variables:

```env
# Required
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/mydb?schema=public"
JWT_SECRET="replace_with_a_strong_random_secret"

# Optional
PORT=3000
NODE_ENV=development
```

4) Apply Prisma migrations and generate client

```powershell
npx prisma migrate dev
npx prisma generate
```

5) Run the API (dev)

```powershell
npm run dev
```

The server listens on `http://localhost:${PORT}` (default `3000`). Health check: `GET /healthz` → `{ status: "ok" }`.

## Available scripts

- `npm run dev` — Run dev server with hot reload (tsx watch)
- `npm run build` — TypeScript build to `dist/`
- `npm start` — Run compiled app (`dist/server.js`)
- `npm run prisma:migrate` — `prisma migrate dev`
- `npm run prisma:generate` — Generate Prisma Client
- `npm run lint` / `npm run lint:fix` — ESLint checks / autofix
- `npm run format` / `npm run format:check` — Prettier format / check

## Project structure

```
echo-backend/
├── src/
│   ├── server.ts                # App entry (Express + middlewares + routes)
│   ├── config/                  # env, db (Prisma), logger (Winston)
│   ├── controllers/             # Route handlers
│   ├── middleware/              # auth, admin/rep guards, validation, errors, request logger
│   ├── routes/                  # Express routers (users, pings, waves, comments, surges, admin, announcements)
│   ├── schemas/                 # Zod schemas (validation + pagination)
│   └── types/                   # Shared TS types
├── prisma/
│   ├── schema.prisma            # Prisma schema (User, Ping, Wave, Comment, Surge, OfficialResponse, Announcement)
│   └── migrations/              # Migration history
├── logs/                        # Winston log files (error.log, combined.log in prod)
├── docker-compose.yml           # Local Postgres service
├── package.json                 # Scripts and deps
└── tsconfig.json                # TS config (NodeNext)
```

## Environment variables

Validated at startup via Zod (`src/config/env.ts`). Required unless noted.

| Variable     | Required | Description                                | Example |
|--------------|----------|--------------------------------------------|---------|
| DATABASE_URL | Yes      | PostgreSQL connection string               | `postgresql://myuser:mypassword@localhost:5432/mydb?schema=public` |
| JWT_SECRET   | Yes      | Secret key for JWT signing                 | `a_really_strong_random_string` |
| PORT         | No       | Port Express listens on (default 3000)     | `3000` |
| NODE_ENV     | No       | `development` | `production` | `test`      | `development` |

## API overview

All JSON bodies are validated with Zod. Many list endpoints accept optional pagination: `?page=<number>&limit=<number>`.

### Auth — `/api/users`
- `POST /register` — Register (email, password, firstName, lastName, level?)
- `POST /login` — Login, returns JWT
- `GET /me` — Current user profile (Authorization: Bearer token)
- `PATCH /me` — Update profile: firstName, lastName, level (auth)
- `DELETE /me` — Delete account (auth)
- `GET /me/surges` — My surges (auth)
- `GET /me/comments` — My comments (auth)

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

### Comments
- `GET /api/pings/:pingId/comments` — Comments for a ping
- `POST /api/pings/:pingId/comments` — Add a comment to a ping (auth)
- `GET /api/waves/:waveId/comments` — Comments for a wave
- `POST /api/waves/:waveId/comments` — Add a comment to a wave (auth)

### Surges (likes)
- `POST /api/pings/:pingId/surge` — Toggle surge for a ping (auth)
- `POST /api/waves/:waveId/surge` — Toggle surge for a wave (auth)

### Official Responses
- `POST /api/pings/:pingId/official-response` — Create official response (representative only)

### Announcements
- `GET /api/announcements` — Public announcements with optional filters: `college`, `hall`, `level`, `gender`
- `POST /api/admin/announcements` — Create announcement (admin only)
- `PATCH /api/admin/announcements/:id` — Update announcement (admin only)
- `DELETE /api/admin/announcements/:id` — Delete announcement (admin only)

### Admin — `/api/admin`
- `GET /stats` — Platform stats (admin)
- `GET /pings` — List all pings with filters/pagination (admin)
- `DELETE /pings/:id` — Delete any ping (admin)
- `GET /users` — List users (admin)
- `GET /users/:id` — Get user by id (admin)
- `PATCH /users/:id/role` — Update user role (ADMIN | REPRESENTATIVE | USER) (admin)
- `GET /analytics/by-level` — Pings grouped by level (admin)
- `GET /analytics/by-category` — Pings grouped by category (admin)

### Health check
- `GET /healthz` — `{ status: "ok" }`

## Security and middleware
- CORS enabled (configure origins for production)
- Helmet HTTP headers
- Rate limiting:
  - Global: 500 req / 15 min
  - Auth endpoints `/api/users/register`, `/api/users/login`: 5 attempts / 15 min (successful logins don’t count)
  - Create/update operations (POST/PATCH/DELETE): 30 ops / 15 min
- Centralized error handler with safe logging

## Database schema (Prisma)
Models: `User`, `Ping`, `Wave`, `Comment`, `Surge`, `OfficialResponse`, `Announcement` with enums `Role`, `Status`, `WaveCategory` and helpful indexes for query performance. See `prisma/schema.prisma`.

Common operations:

```powershell
# Create/refresh dev DB and apply migrations interactively
npx prisma migrate dev

# Apply migrations in production
npx prisma migrate deploy

# Open Prisma Studio (optional)
npx prisma studio
```

## Logging
- Human-readable colored logs in development
- JSON structured logs in production
- Files: `logs/error.log` (always), `logs/combined.log` (production)

## Deployment notes
- Set all environment variables in your platform (DATABASE_URL, JWT_SECRET, etc.)
- Run `npx prisma migrate deploy` before starting the app
- Start the compiled server (`npm run build` then `npm start`)

## Contributing
1. Fork repository and create a feature branch
2. Develop with `npm run dev`
3. Lint/format before committing: `npm run lint && npm run format`
4. Open a Pull Request

## License
Private and proprietary

---

Built with ❤️ for university students
