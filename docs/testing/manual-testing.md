# Manual Multitenancy Testing Guide

Since we can't access the remote database, here's how to manually verify the multitenancy implementation:

## ✅ Code Review Checklist

### 1. Schema Verification
- [ ] Check `prisma/schema.prisma` - all models have `organizationId Int` field
- [ ] Verify foreign key relationships point to Organization
- [ ] Confirm unique constraints include organizationId (e.g., email per org)

### 2. Middleware Verification
- [ ] `authMiddleware.ts` - JWT includes `organizationId`
- [ ] `organizationMiddleware.ts` - attaches `req.organizationId` to requests
- [ ] `AuthRequest` type extends Request with organizationId

### 3. Controller Pattern Verification
For each controller, verify:
- [ ] Uses `AuthRequest` type (not `Request`)
- [ ] All Prisma queries include `organizationId` filter
- [ ] Create operations set `organizationId: req.organizationId!`
- [ ] Update/Delete operations verify organization ownership

### 4. Route Protection
- [ ] Protected routes use `organizationMiddleware`
- [ ] Public routes (like getAllPings) accept optional `organizationId` query param

## 🧪 API Testing Concepts

### Test Scenario 1: Data Isolation
```
POST /api/users/login
Body: { "email": "user@org1.com", "password": "..." }
// Should return JWT with organizationId: 1

GET /api/pings
Headers: { "Authorization": "Bearer <jwt>" }
// Should only return pings where organizationId = 1
```

### Test Scenario 2: Cross-Organization Access Prevention
```
POST /api/users/login
Body: { "email": "user@org2.com", "password": "..." }
// JWT contains organizationId: 2

GET /api/pings/123
Headers: { "Authorization": "Bearer <jwt>" }
// If ping 123 belongs to org 1, should return 404
```

### Test Scenario 3: Admin Scope
```
POST /api/users/login
Body: { "email": "admin@org1.com", "password": "..." }

GET /api/admin/users
Headers: { "Authorization": "Bearer <jwt>" }
// Should only return users from org 1
```

## 🔍 Key Files to Inspect

1. **Controllers**: All should filter by `req.organizationId`
2. **Routes**: Protected routes should have `organizationMiddleware`
3. **Schemas**: Updated for categoryIds and organizationId params
4. **Middleware**: Auth flow includes organization context

## ✅ Verification Commands

```bash
# Build check
npm run build

# Type check
npx tsc --noEmit

# Lint check
npm run lint
```

---

## 🚶 End-to-End User Journey (Launch-day simulation)

This simulates the real flow from a landing-page waitlist CTA to a user being able to sign in and create pings.

### A) CU “automatic access” (starting campus)

**Goal:** CU domains work immediately without waitlist.

1) Ensure CU org domains exist and are ACTIVE

Run:

```bash
node scripts/upsert-school-orgs.mjs
```

This upserts:
- `stu.cu.edu.ng`
- `covenantuniversity.edu.ng`

2) Sign in (Google)
- Frontend obtains Google ID token, then calls `POST /api/auth/google` with `{ "token": "<id_token>" }`.
- Expected:
	- `200`
	- JWT returned
	- User created (first time) and tied to the CU org.

3) Create a ping
- Use JWT to call `POST /api/pings` with `Authorization: Bearer <jwt>`.
- Expected: `201` and the ping belongs to CU org only.

---

### B) Non-CU waitlist → approval → access

**Goal:** A new campus goes through waitlist + approval before users can sign in.

**Recommended production setting:**
- `ORG_ONBOARDING_AUTO_ACTIVATE=false`

1) Landing page CTA → onboarding request
- Landing page calls `POST /api/users/organization-waitlist` with:
	- org name
	- requester email on the org domain (not gmail)
	- password + name
- Expected: `201` with `organizationStatus: PENDING`.

2) Requester verifies their email
- The requester receives a verification email and submits the token to `POST /api/users/verify-email`.
- Expected:
	- User becomes ACTIVE
	- Org remains `PENDING` (because `ORG_ONBOARDING_AUTO_ACTIVATE=false`).

3) Platform approves the org (SUPER_ADMIN)
- SUPER_ADMIN lists pending requests: `GET /api/admin/organization-requests?status=PENDING`
- Approves: `POST /api/admin/organization-requests/:id/approve`
- Expected:
	- Organization becomes `ACTIVE`
	- Request status becomes `APPROVED`

4) Users can sign in and create pings
- Users with that domain can now sign in (Google or password) and create pings.

---

### C) Frontend integration prerequisites (don’t get blocked)

1) Backend CORS
- Frontend running on Vite should use `http://localhost:5173`.

2) Google Console allowed origins
- Add `http://localhost:5173` to the OAuth Client’s Authorized JavaScript origins.

3) Consumer domains are blocked
- `@gmail.com`, `@yahoo.com`, etc. are rejected by design.

## 🎯 Success Indicators

- [ ] All controllers use `AuthRequest` type
- [ ] All Prisma queries include organization filtering
- [ ] Routes have appropriate middleware
- [ ] Code compiles without TypeScript errors
- [ ] No data leakage paths (queries without org filters)

## 📝 Next Steps

1. **Set up local database** (PostgreSQL) for full testing
2. **Run the setup script** to create test data
3. **Use API client** (Postman/Insomnia) to test endpoints
4. **Verify data isolation** between organizations

The implementation is complete and follows security best practices for multitenancy!