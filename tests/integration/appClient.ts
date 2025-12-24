import supertest from 'supertest';
import type { CreateAppOptions } from '../../src/app.js';

export async function buildTestClient(options: CreateAppOptions = { disableRateLimiting: true }) {
  const { createApp } = await import('../../src/app.js');
  const app = createApp(options);
  return supertest(app);
}
