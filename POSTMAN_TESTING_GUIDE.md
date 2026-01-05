# Echo Backend API Testing Guide

This guide provides comprehensive testing instructions for the Echo backend API with multitenancy support. All routes are organization-scoped, meaning users can only access data from their own organization.

## Prerequisites

1. **Database Setup**: Run the multitenancy test setup script:
   ```bash
   node setup-multitenancy-tests.js
   ```
   This creates test organizations and users for testing data isolation.

2. **Authentication**: All protected routes require a JWT token in the `Authorization` header:
   ```
   Authorization: Bearer <your-jwt-token>
   ```

3. **Test Organizations**: The setup script creates domains you can target by email:
  - **Covenant University** – domain: `cu.edu.ng`
  - **Test University A** – domain: `testuniva.edu`
  - **Test University B** – domain: `testunivb.edu`

> ℹ️ Registration and login now infer the organization from the email domain. As long as the domain is pre-registered and active, the user will be placed in the correct tenant automatically.

## Test Users

### Organization A (Test University A)
- **Admin**: adminA@testuniva.edu / password123
- **Regular User**: studentA@testuniva.edu / password123

### Organization B (Test University B)
- **Admin**: adminB@testunivb.edu / password123
- **Regular User**: studentB@testunivb.edu / password123

## API Endpoints

### Authentication Routes

#### POST /api/users/register
**Purpose**: Register a new user
**Auth**: None required
**Body**:
```json
{
  "email": "student@cu.edu.ng",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```
**Notes**: The backend derives the organization from the email domain. The user receives a verification email before the account becomes active.

#### POST /api/users/login
**Purpose**: Login user and get JWT token
**Auth**: None required
**Body**:
```json
{
  "email": "studentA@testuniva.edu",
  "password": "password123"
}
```
**Expected Response**: JWT token containing `organizationId` and `role` claims.

#### POST /api/auth/google
**Purpose**: Sign in via Google OAuth (auto-registers on first login)
**Auth**: Google ID token
**Body**:
```json
{
  "token": "<google-id-token>"
}
```
**Notes**:
- The verified email returned by Google determines the organization.
- A legacy alias exists at `POST /api/users/google` for backwards compatibility.

#### POST /api/users/verify-email
**Purpose**: Activate a newly registered account
**Auth**: None required
**Body**:
```json
{
  "token": "<verification-token-from-email>"
}
```

#### POST /api/users/forgot-password
**Purpose**: Request a password reset link
**Auth**: None required
**Body**:
```json
{
  "email": "student@cu.edu.ng"
}
```

#### PATCH /api/users/reset-password
**Purpose**: Complete password reset
**Auth**: None required
**Body**:
```json
{
  "token": "<reset-token-from-email>",
  "password": "newSecurePassword123"
}
```

#### POST /api/users/organization-waitlist
**Purpose**: Request onboarding for a new organization (creates pending org + admin user)
**Auth**: None required
**Body**:
```json
{
  "organizationName": "New University",
  "email": "founder@newuni.edu",
  "firstName": "Founder",
  "lastName": "Person",
  "password": "password123",
  "metadata": {
    "notes": "Interested in early access"
  }
}
```

### User Management Routes

#### GET /api/users/me
**Purpose**: Get current user profile
**Auth**: Required (JWT)
**Expected**: Returns user data for authenticated user's organization

#### PATCH /api/users/me
**Purpose**: Update user profile
**Auth**: Required (JWT)
**Body**:
```json
{
  "firstName": "Updated",
  "lastName": "Name"
}
```

#### DELETE /api/users/me
**Purpose**: Delete user account
**Auth**: Required (JWT)

#### GET /api/users/me/surges
**Purpose**: Get user's surges (likes)
**Auth**: Required (JWT)
**Query**: ?page=1&limit=20

#### GET /api/users/me/comments
**Purpose**: Get user's comments
**Auth**: Required (JWT)
**Query**: ?page=1&limit=20

### Ping Routes

#### GET /api/pings
**Purpose**: Get all pings in organization
**Auth**: None required (public read)
**Query**: ?page=1&limit=20&category=GENERAL&status=POSTED

#### POST /api/pings
**Purpose**: Create a new ping
**Auth**: Required (JWT) + Organization membership
**Body**:
```json
{
  "title": "Test Ping",
  "content": "This is a test ping",
  "categoryId": 1,
  "hashtag": "test"
}
```

#### GET /api/pings/search
**Purpose**: Search pings by hashtag or text
**Auth**: None required
**Query**: ?hashtag=test or ?q=calculus

#### GET /api/pings/me
**Purpose**: Get current user's pings
**Auth**: Required (JWT)
**Query**: ?page=1&limit=20

#### GET /api/pings/:id
**Purpose**: Get specific ping by ID
**Auth**: None required (organization-scoped)
**Params**: id (ping ID)

#### PATCH /api/pings/:id
**Purpose**: Update a ping
**Auth**: Required (JWT) - ping author only
**Params**: id (ping ID)
**Body**:
```json
{
  "title": "Updated Title",
  "content": "Updated content"
}
```

#### DELETE /api/pings/:id
**Purpose**: Delete a ping
**Auth**: Required (JWT) - ping author only
**Params**: id (ping ID)

#### PATCH /api/pings/:id/status
**Purpose**: Update ping status (admin only)
**Auth**: Required (JWT) + Admin role
**Params**: id (ping ID)
**Body**:
```json
{
  "status": "RESOLVED"
}
```

#### PATCH /api/pings/:id/submit
**Purpose**: Submit ping for official response (representative only)
**Auth**: Required (JWT) + Representative role
**Params**: id (ping ID)

### Wave Routes (Solutions)

#### GET /api/pings/:pingId/waves
**Purpose**: Get all waves for a ping
**Auth**: None required (organization-scoped)
**Params**: pingId
**Query**: ?page=1&limit=20

#### POST /api/pings/:pingId/waves
**Purpose**: Create a wave (solution) for a ping
**Auth**: Required (JWT) + Organization membership
**Params**: pingId
**Body**:
```json
{
  "solution": "This is my solution to the ping"
}
```

#### GET /api/waves/:id
**Purpose**: Get specific wave by ID
**Auth**: None required (organization-scoped)
**Params**: id (wave ID)

### Comment Routes

#### GET /api/pings/:pingId/comments
**Purpose**: Get all comments for a ping
**Auth**: None required (organization-scoped)
**Params**: pingId
**Query**: ?page=1&limit=20

#### POST /api/pings/:pingId/comments
**Purpose**: Create comment on a ping
**Auth**: Required (JWT) + Organization membership
**Params**: pingId
**Body**:
```json
{
  "content": "This is my comment on the ping"
}
```

#### GET /api/waves/:waveId/comments
**Purpose**: Get all comments for a wave
**Auth**: None required (organization-scoped)
**Params**: waveId
**Query**: ?page=1&limit=20

#### POST /api/waves/:waveId/comments
**Purpose**: Create comment on a wave
**Auth**: Required (JWT) + Organization membership
**Params**: waveId
**Body**:
```json
{
  "content": "This is my comment on the wave"
}
```

### Surge Routes (Like/Unlike)

#### POST /api/pings/:pingId/surge
**Purpose**: Toggle surge (like/unlike) on a ping
**Auth**: Required (JWT) + Organization membership
**Params**: pingId

#### POST /api/waves/:waveId/surge
**Purpose**: Toggle surge (like/unlike) on a wave
**Auth**: Required (JWT) + Organization membership
**Params**: waveId

### Official Response Routes

#### GET /api/pings/:pingId/official-response
**Purpose**: Get official response for a ping
**Auth**: None required (organization-scoped)
**Params**: pingId

#### POST /api/pings/:pingId/official-response
**Purpose**: Create/update official response (representative only)
**Auth**: Required (JWT) + Representative role
**Params**: pingId
**Body**:
```json
{
  "content": "This is the official response from administration"
}
```

### Announcement Routes

#### GET /api/announcements
**Purpose**: Get all announcements for organization
**Auth**: Required (JWT)
**Query**: ?college=ARTS&hall=RESIDENCE&level=UNDERGRAD&gender=MALE

#### POST /api/admin/announcements
**Purpose**: Create announcement (admin only)
**Auth**: Required (JWT) + Admin role
**Body**:
```json
{
  "title": "Important Announcement",
  "content": "This is an important announcement for all students",
  "targetCollege": "ARTS",
  "targetHall": "RESIDENCE",
  "targetLevel": "UNDERGRAD",
  "targetGender": "ALL"
}
```

### Admin Routes

#### GET /api/admin/pings
**Purpose**: Get all pings in organization (admin view)
**Auth**: Required (JWT) + Admin role
**Query**: ?page=1&limit=20&status=PENDING

#### DELETE /api/admin/pings/:id
**Purpose**: Delete any ping (admin only)
**Auth**: Required (JWT) + Admin role
**Params**: id (ping ID)

#### GET /api/admin/users
**Purpose**: Get all users in organization
**Auth**: Required (JWT) + Admin role
**Query**: ?page=1&limit=20

#### GET /api/admin/users/:id
**Purpose**: Get specific user by ID
**Auth**: Required (JWT) + Admin role
**Params**: id (user ID)

#### PATCH /api/admin/users/:id/role
**Purpose**: Update user role
**Auth**: Required (JWT) + Admin role
**Params**: id (user ID)
**Body**:
```json
{
  "role": "REPRESENTATIVE"
}
```

#### GET /api/admin/stats
**Purpose**: Get platform statistics
**Auth**: Required (JWT) + Admin role

**Optional Query (weekly windows)**:
- `weeks`: number of weeks (1–52)
- `offsetWeeks`: number of weeks back from “now” (0 = current window)

Example:
`GET /api/admin/stats?weeks=1&offsetWeeks=0`

#### GET /api/admin/analytics/by-category
**Purpose**: Get ping stats by category
**Auth**: Required (JWT) + Admin role
**Optional Query (weekly windows)**: `weeks`, `offsetWeeks`

#### GET /api/admin/analytics/by-level
**Purpose**: Get pings by user level
**Auth**: Required (JWT) + Admin role
**Optional Query (weekly windows)**: `weeks`, `offsetWeeks`

#### GET /api/admin/analytics/active-users
**Purpose**: Count distinct active users in a weekly window
**Auth**: Required (JWT) + Admin role
**Query**: `weeks`, `offsetWeeks`

#### PATCH /api/admin/pings/:id/progress-status
**Purpose**: Update ping progress status
**Auth**: Required (JWT) + Admin role
**Params**: id (ping ID)
**Body**:
```json
{
  "status": "IN_PROGRESS"
}
```

#### GET /api/admin/waves
**Purpose**: List waves for moderation
**Auth**: Required (JWT) + Admin role
**Query**: `page`, `limit`, optional `status`

#### PATCH /api/admin/waves/:id/status
**Purpose**: Update a wave status (approving a wave resolves its parent ping)
**Auth**: Required (JWT) + Admin role
**Body**:
```json
{ "status": "APPROVED" }
```

---

## End-to-End Journey (Postman rehearsal)

This is the same “launch-day simulation” flow, but expressed as Postman steps.

### Environment variables to create
- `base_url`: `http://localhost:3000` (or your Railway URL)
- `auth_token`: user JWT (set after login/google)
- `super_admin_token`: SUPER_ADMIN JWT (only needed for manual approval)
- `google_id_token`: Google ID token from the frontend or `test-google-auth.html`
- `org_request_id`: set after listing pending org requests

### A) CU “automatic access” (org already ACTIVE)

1) Ensure CU org domain exists and is ACTIVE
- Local dev: `node setup-multitenancy-tests.js` seeds test orgs.
- Launch/staging: run `node scripts/upsert-school-orgs.mjs` against the target DB to activate CU domains.

2) Google sign-in
- Request: `POST {{base_url}}/api/auth/google`
- Body:
```json
{ "token": "{{google_id_token}}" }
```
- Save the returned JWT into `auth_token`.

3) Create a ping
- Request: `POST {{base_url}}/api/pings`
- Header: `Authorization: Bearer {{auth_token}}`

### B) Non-CU waitlist → approval → access

1) Submit waitlist request
- Request: `POST {{base_url}}/api/users/organization-waitlist`
- Expected: org created as `PENDING`.

2) Verify email
- Request: `POST {{base_url}}/api/users/verify-email`
- Note: you’ll need the verification token from the email/logs.

3) SUPER_ADMIN approves (production-style)
- List pending: `GET {{base_url}}/api/admin/organization-requests?status=PENDING`
  - Header: `Authorization: Bearer {{super_admin_token}}`
  - Pick the relevant request `id` and store in `org_request_id`.
- Approve: `POST {{base_url}}/api/admin/organization-requests/{{org_request_id}}/approve`
  - Header: `Authorization: Bearer {{super_admin_token}}`

4) Google sign-in + create ping
- Repeat steps A2 and A3 (now the org is ACTIVE so Google auth succeeds).

## Testing Strategy

### 1. Authentication Testing
1. Register users for both organizations using valid domains
2. Call `POST /api/users/verify-email` with the email token to activate the accounts
3. Login and verify JWT tokens contain the correct `organizationId` and `role`
4. Test that tokens from one org don't work for another org's data

### 2. Data Isolation Testing
1. Create content (pings, waves, comments) as users from Org A
2. Verify Org B users cannot see Org A's content
3. Verify Org A users cannot see Org B's content
4. Test cross-organization access attempts return 404/403

### 3. Role-Based Access Testing
1. Test admin-only routes with regular users (should fail)
2. Test representative-only routes with regular users (should fail)
3. Test admin routes with admin users (should succeed)
4. Test representative routes with representative users (should succeed)

### 4. CRUD Operations Testing
1. Create, read, update, delete operations within organization
2. Verify users can only modify their own content
3. Test pagination and filtering work correctly

### 5. Public Access Testing
1. Test that public read routes work without authentication
2. Verify public routes still respect organization boundaries
3. Test search functionality within organization scope

## Expected Test Results

### ✅ Successful Operations
- Users can access all data from their organization
- Admins can perform admin operations within their organization
- Representatives can create official responses within their organization
- Public read access works for organization-scoped data

### ❌ Failed Operations (Expected)
- Users cannot access data from other organizations (404 Not Found)
- Regular users cannot perform admin operations (403 Forbidden)
- Regular users cannot create official responses (403 Forbidden)
- Invalid JWT tokens are rejected (401 Unauthorized)

## Postman Collection Setup

1. Create a new collection called "Echo Backend API"
2. Create environment variables:
   - `base_url`: `http://localhost:3000`
   - `token_org_a`: JWT token for Org A user
   - `token_org_b`: JWT token for Org B user
   - `ping_id_org_a`: ID of a ping created by Org A user
   - `ping_id_org_b`: ID of a ping created by Org B user

3. Add tests to verify response codes and data isolation
4. Use the test scripts to automatically set environment variables for created resources</content>
<parameter name="filePath">c:\Users\USER\Desktop\C.I.A⚡\echo-backend\POSTMAN_TESTING_GUIDE.md