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

3. **Test Organizations**: The setup script creates:
   - **Org A**: University of Toronto (organizationId: test-org-a)
   - **Org B**: University of Waterloo (organizationId: test-org-b)

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
  "email": "newuser@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "organizationId": "test-org-a"
}
```

#### POST /api/users/login
**Purpose**: Login user and get JWT token
**Auth**: None required
**Body**:
```json
{
  "email": "studentA@testuniva.edu",
  "password": "password123",
  "organizationId": 1
}
```
**Expected Response**: JWT token with organizationId

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

#### GET /api/admin/stats/categories
**Purpose**: Get ping stats by category
**Auth**: Required (JWT) + Admin role

#### GET /api/admin/stats/levels
**Purpose**: Get pings by user level
**Auth**: Required (JWT) + Admin role

#### PATCH /api/admin/pings/:id/progress
**Purpose**: Update ping progress status
**Auth**: Required (JWT) + Admin role
**Params**: id (ping ID)
**Body**:
```json
{
  "progressStatus": "IN_PROGRESS"
}
```

## Testing Strategy

### 1. Authentication Testing
1. Register users for both organizations
2. Login and verify JWT tokens contain correct organizationId
3. Test that tokens from one org don't work for another org's data

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