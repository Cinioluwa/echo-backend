# Backend Testing Standards

This project uses **Vitest** for testing and **Prisma** with a local SQLite database for integration tests.

## Core Philosophy
*   **Integration over Unit:** We prioritize integration tests that spin up the full Express app and hit the database. This gives us the highest confidence.
*   **Isolated Database:** Each test suite uses a unique SQLite database file created by `testContainer.ts`.
*   **Real Auth Flows:** We prefer logging in via `/api/users/login` to get a token rather than mocking the JWT service.

## The "Golden Pattern" for Integration Tests

Use this template for all new test files in `tests/integration/`.

### 1. Imports
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { buildTestClient } from './appClient.js';
import { getPrisma } from './testContainer.js';
import bcrypt from 'bcrypt';
```

### 2. Setup (`beforeAll`)
Use `beforeAll` (not `beforeEach`) for expensive setup like creating Organizations and Users. This prevents Unique Constraint errors and speeds up tests.

```typescript
describe('My Feature API', () => {
    let client: any; // Supertest client
    let token: string; // Auth token

    beforeAll(async () => {
        // 1. Build the App
        client = await buildTestClient();
        const prisma = getPrisma(); // Get the isolated DB client

        // 2. Setup Data (Organization is required for multitenancy)
        const org = await prisma.organization.create({
            data: { name: 'Test Org', domain: 'test.edu', status: 'ACTIVE' }
        });

        // 3. Create User & Login
        const password = 'password123';
        const hashedPassword = await bcrypt.hash(password, 10);
        
        await prisma.user.create({
            data: {
                email: 'admin@test.edu',
                password: hashedPassword,
                role: 'ADMIN',
                organizationId: org.id
            }
        });

        const loginRes = await client
            .post('/api/users/login')
            .send({ email: 'admin@test.edu', password });
            
        token = loginRes.body.token;
    });

    // ... tests ...
});
```

### 3. Writing Tests
Use `client` to make HTTP requests. Always include the `Authorization` header for protected routes.

```typescript
it('should return 200 OK', async () => {
    const res = await client
        .get('/api/my-endpoint')
        .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
});
```

## Common Pitfalls
1.  **Unique Constraints:** If you use `beforeEach` to create users/orgs, you MUST use random strings for emails/domains, or you will hit "Unique constraint failed" errors on the second test. **Fix:** Use `beforeAll` or helper functions that randomize inputs.
2.  **Prisma Client:** Never import the global `prisma` from `src/config/db.ts`. Always use `getPrisma()` from `./testContainer.ts`. The global one connects to the *production* DB (or fails if unreachable).
3.  **Authentication:** Don't try to mock `req.user`. It's brittle. Just log in...

## Running Tests
*   Run all: `npm run test`
*   Run single file: `npx vitest run tests/integration/my-file.test.ts`
