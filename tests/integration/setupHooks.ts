import { beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb } from './testContainer.js';

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await teardownTestDb();
});
