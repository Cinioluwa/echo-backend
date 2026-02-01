// src/routes/swaggerRoutes.ts
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../config/swagger.js';

const router = Router();

/**
 * Serve Swagger UI at /docs
 * This provides an interactive API documentation interface
 */
router.use('/docs', swaggerUi.serve);
router.get('/docs', swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Echo API Documentation',
}));

/**
 * Serve raw OpenAPI spec as JSON at /docs/json
 * Useful for importing into other tools (Postman, Insomnia, etc.)
 */
router.get('/docs/json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

export default router;
