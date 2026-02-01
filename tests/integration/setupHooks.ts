import { beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb } from './testContainer.js';

beforeAll(async () => {
  // Set required environment variables for tests
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-integration-tests-minimum-32-chars';
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});
