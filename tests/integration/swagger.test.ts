import { describe, it, expect, beforeAll } from 'vitest';
import { buildTestClient } from './appClient.js';

describe('Swagger/OpenAPI Documentation', () => {
  let client: Awaited<ReturnType<typeof buildTestClient>>;

  beforeAll(async () => {
    client = await buildTestClient();
  });

  describe('GET /docs', () => {
    it('should serve Swagger UI HTML page', async () => {
      const res = await client.get('/docs');
      
      expect(res.status).toBe(301); // Redirect to /docs/
    });

    it('should serve Swagger UI at /docs/', async () => {
      const res = await client.get('/docs/');
      
      expect(res.status).toBe(200);
      expect(res.type).toMatch(/html/);
      expect(res.text).toContain('swagger-ui');
    });
  });

  describe('GET /docs/json', () => {
    it('should return OpenAPI specification as JSON', async () => {
      const res = await client.get('/docs/json');
      
      expect(res.status).toBe(200);
      expect(res.type).toMatch(/json/);
      expect(res.body).toHaveProperty('openapi');
      expect(res.body).toHaveProperty('info');
      expect(res.body).toHaveProperty('paths');
    });

    it('should have correct API metadata', async () => {
      const res = await client.get('/docs/json');
      
      expect(res.body.openapi).toBe('3.0.0');
      expect(res.body.info.title).toBe('Echo Backend API');
      expect(res.body.info.version).toBe('1.0.0');
    });

    it('should include documented endpoints', async () => {
      const res = await client.get('/docs/json');
      
      const paths = res.body.paths;
      
      // Check that key endpoints are documented
      expect(paths).toHaveProperty('/api/auth/google');
      expect(paths).toHaveProperty('/api/pings');
      expect(paths).toHaveProperty('/api/categories');
      expect(paths).toHaveProperty('/api/public/soundboard');
      expect(paths).toHaveProperty('/health');
      expect(paths).toHaveProperty('/healthz');
    });

    it('should include component schemas', async () => {
      const res = await client.get('/docs/json');
      
      const schemas = res.body.components?.schemas;
      
      expect(schemas).toHaveProperty('User');
      expect(schemas).toHaveProperty('Ping');
      expect(schemas).toHaveProperty('Category');
      expect(schemas).toHaveProperty('Error');
      expect(schemas).toHaveProperty('PaginationMeta');
    });

    it('should include security scheme for JWT', async () => {
      const res = await client.get('/docs/json');
      
      const securitySchemes = res.body.components?.securitySchemes;
      
      expect(securitySchemes).toHaveProperty('bearerAuth');
      expect(securitySchemes.bearerAuth.type).toBe('http');
      expect(securitySchemes.bearerAuth.scheme).toBe('bearer');
    });

    it('should have endpoints tagged appropriately', async () => {
      const res = await client.get('/docs/json');
      
      // Check that authentication endpoint has correct tag
      const googleAuthPost = res.body.paths['/api/auth/google']?.post;
      expect(googleAuthPost?.tags).toContain('Authentication');
      
      // Check that pings endpoint has correct tag
      const pingsGet = res.body.paths['/api/pings']?.get;
      expect(pingsGet?.tags).toContain('Pings');
      
      // Check that categories endpoint has correct tag
      const categoriesGet = res.body.paths['/api/categories']?.get;
      expect(categoriesGet?.tags).toContain('Categories');
    });
  });
});
