# Test Automation TODO List

## Completed ✅
- [x] Set up test tooling (Vitest, Supertest, Playwright)
- [x] Refactor app.ts for testability (createApp factory with disableRateLimiting)
- [x] Configure SQLite test database (test-schema.prisma, migrations)
- [x] Implement test database lifecycle (setup/teardown in testContainer.ts)
- [x] Write and validate auth register/login integration test
- [x] Fix validation issues (level >7 → level=1)
- [x] Fix provider mismatch (PostgreSQL client vs SQLite DB)
- [x] Install missing dependencies (@playwright/test)
- [x] Create test fixtures/factories (tests/fixtures/index.ts)
  - [x] Organization factory
  - [x] User factory
  - [x] Ping factory
  - [x] Wave factory
- [ ] Implement more integration tests
  - [ ] Organization isolation (cross-org access denied)
  - [ ] Ping CRUD operations
  - [ ] Wave CRUD operations
  - [ ] Admin routes
  - [ ] Representative routes
  - [ ] Announcement routes
- [ ] Implement unit tests
  - [ ] Middleware (authMiddleware, organizationMiddleware)
  - [ ] Utils (domain validation, password hashing)
  - [ ] Schemas (Zod validation)
  - [ ] Services (business logic)
- [ ] Implement E2E smoke tests (Playwright)
  - [ ] Full auth flow (stub OAuth)
  - [ ] Basic CRUD flows
  - [ ] Multitenancy verification

## Notes
- Test infrastructure is stable and ready for expansion
- SQLite provides fast, isolated test DB (switched from Docker PostgreSQL)
- App factory enables clean test isolation
- Auth flow validated end-to-end with mocks
- Next priority: Fixtures for test data, then more integration tests