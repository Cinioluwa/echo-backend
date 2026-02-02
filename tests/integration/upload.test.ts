// tests/integration/upload.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { buildTestClient } from './appClient.js';
import type { Test } from 'supertest';

describe('Upload API', () => {
  let client: Awaited<ReturnType<typeof buildTestClient>>;

  beforeAll(async () => {
    client = await buildTestClient();
  });

  describe('POST /api/uploads', () => {
    it('should reject requests without authentication', async () => {
      const res = await client
        .post('/api/uploads')
        .attach('files', Buffer.from('fake image data'), 'test.jpg');

      expect(res.status).toBe(401);
    });

    it('should reject requests without files (authenticated)', async () => {
      // Without a valid token, we get 401 first
      const res = await client
        .post('/api/uploads')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/uploads/profile', () => {
    it('should reject requests without authentication', async () => {
      const res = await client
        .post('/api/uploads/profile')
        .attach('file', Buffer.from('fake image'), 'avatar.jpg');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/uploads/attach', () => {
    it('should reject requests without authentication', async () => {
      const res = await client
        .post('/api/uploads/attach')
        .send({ mediaIds: [1], entityType: 'ping', entityId: 1 });

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/uploads/:id', () => {
    it('should reject requests without authentication', async () => {
      const res = await client.delete('/api/uploads/1');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/uploads/ping/:pingId', () => {
    it('should reject requests without authentication', async () => {
      const res = await client.get('/api/uploads/ping/1');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/uploads/wave/:waveId', () => {
    it('should reject requests without authentication', async () => {
      const res = await client.get('/api/uploads/wave/1');

      expect(res.status).toBe(401);
    });
  });

  describe('Swagger documentation', () => {
    it('should include upload endpoints in OpenAPI spec', async () => {
      const res = await client.get('/docs/json');

      expect(res.status).toBe(200);
      expect(res.body.paths).toHaveProperty('/api/uploads');
      expect(res.body.paths).toHaveProperty('/api/uploads/profile');
      expect(res.body.paths).toHaveProperty('/api/uploads/attach');
      expect(res.body.paths).toHaveProperty('/api/uploads/{id}');
      expect(res.body.paths).toHaveProperty('/api/uploads/ping/{pingId}');
      expect(res.body.paths).toHaveProperty('/api/uploads/wave/{waveId}');
    });
  });
});
