# Swagger UI Visual Guide

## What You'll See at `/docs`

When you visit `http://localhost:3000/docs`, you'll see the Swagger UI interface with:

### 1. Header Section
```
Echo Backend API (1.0.0)
Backend API for Echo — a social feedback platform for university students with multitenancy support.

Servers: http://localhost:3000 (API Server)

[Authorize 🔓] Button in top-right
```

### 2. API Description
The documentation includes a comprehensive overview explaining:
- Features (Authentication, Multitenancy, Core Entities, Roles, Security)
- Authentication instructions (how to get JWT tokens)
- Multitenancy notes
- Rate limiting details

### 3. Endpoint Groups (Tags)

#### Authentication
- **POST /api/auth/google** - Authenticate with Google OAuth
  - Expandable section showing:
    - Request body schema (token: string)
    - All response codes (200, 400, 401, 403, 404, 500)
    - Example request/response JSON
    - "Try it out" button to test the endpoint

#### Pings
- **POST /api/pings** - Create a new ping (issue)
  - Shows required fields: title, content, categoryId
  - Optional fields: hashtag, isAnonymous
  - Authentication required (🔒 icon)
  
- **GET /api/pings** - List all pings with filters
  - Query parameters: page, limit, category, status
  - Paginated response with metadata

#### Categories
- **GET /api/categories** - Get all categories for user's organization
  - Optional query parameter: q (search)
  - Returns array of {id, name} objects

#### Public
- **GET /api/public/soundboard** - Public feed of pings
  - Query params: page, limit, sort, category
  - Organization-scoped
  
- **GET /api/public/stream** - Public feed of waves
  - Similar to soundboard
  
- **GET /api/public/resolution-log** - Resolved pings feed
  - Query param: days (1-365 or 'all')

#### Health
- **GET /health** - Deep health check (includes database)
- **GET /healthz** - Shallow health check

### 4. Schemas Section (at bottom)

Expandable component schemas:
- **User**: {id, email, firstName, lastName, role, organizationId, profilePicture}
- **Ping**: {id, title, content, category, hashtag, isAnonymous, status, author, _count}
- **Category**: {id, name}
- **Error**: {error, code?}
- **PaginationMeta**: {totalItems, totalPages, currentPage, itemsPerPage, hasNextPage, hasPreviousPage}

### 5. Interactive Features

#### Try It Out
1. Click "Try it out" button on any endpoint
2. Edit the request body/parameters
3. Click "Execute"
4. View the response with:
   - Response body (JSON)
   - Response headers
   - cURL command (for copying)
   - Request URL

#### Authentication
1. Click "Authorize" button (🔓) at top
2. Modal appears: "Available authorizations"
3. Enter: `Bearer <your-jwt-token>`
4. Click "Authorize" then "Close"
5. Lock icon changes to 🔒 (locked)
6. All protected endpoints now include your token

### 6. Example Endpoint View

```
POST /api/auth/google
Authenticate with Google OAuth

Sign in or sign up using a Google ID token. This endpoint:
- Verifies the Google token
- Finds or creates a user account
- Issues a JWT token for API access

New users are automatically created with email pre-verified.
Existing users can link their Google account on first Google sign-in.

Parameters: (no parameters)

Request body (required) *
application/json

{
  "token": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjE..."
}

[Try it out] [Execute]

Responses:

200 - Authentication successful
Example Value | Model
{
  "message": "Google authentication successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "student@cu.edu.ng",
    "firstName": "John",
    "lastName": "Doe",
    "role": "USER",
    "organizationId": 1,
    "profilePicture": "https://..."
  }
}

400 - Bad request
401 - Unauthorized
403 - Forbidden
404 - Not Found
500 - Internal server error
```

## Color Scheme

Swagger UI uses a professional blue/green color scheme:
- Primary actions: Blue
- Success: Green
- GET requests: Blue background
- POST requests: Green background
- DELETE requests: Red background
- PATCH/PUT: Orange background
- Headers: Dark gray
- Code blocks: Light gray with syntax highlighting

## Mobile Responsive

The Swagger UI is fully responsive and works on:
- Desktop (optimal experience)
- Tablets
- Mobile devices (with touch-friendly controls)

## Developer Experience

### Benefits
1. **Self-documenting API**: Documentation lives alongside code
2. **Always up-to-date**: Generated from actual route definitions
3. **Interactive testing**: No need for separate tools during development
4. **Type-safe**: TypeScript ensures accuracy
5. **Standards-based**: OpenAPI 3.0 - industry standard
6. **Tool integration**: Import into Postman, Insomnia, etc.

### Workflow
1. Write route handler
2. Add JSDoc comment with @openapi annotation
3. Restart dev server
4. Documentation automatically updates
5. Test directly in browser at /docs

## Production Tips

- Default: Publicly accessible (good for public APIs)
- Can restrict with middleware (see README)
- Can disable entirely in production
- Rate limiting applies to docs endpoint
- No performance impact (static spec generation)
