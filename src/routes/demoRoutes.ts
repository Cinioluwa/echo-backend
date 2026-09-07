// src/routes/demoRoutes.ts
//
// Webhook receiver for the self-serve demo provisioning flow.
// Protected by a shared secret header (x-demo-secret), NOT by JWT auth.
// Mounted at /api/demo in app.ts.

import { Router } from 'express';
import { handleProvisionDemo } from '../controllers/demoController.js';

const router = Router();

/**
 * @openapi
 * /api/demo/provision:
 *   post:
 *     summary: Provision a self-serve demo environment for an institution
 *     description: |
 *       Called by the Supabase webhook after a demo request is submitted on the landing page.
 *       Creates an isolated Echo demo org, pre-seeded with realistic data, and emails credentials
 *       to the contact. Protected by a shared secret header — not exposed to end users.
 *
 *       **Security**: Requires `x-demo-secret` header matching DEMO_PROVISION_SECRET env var.
 *     tags:
 *       - Demo
 *     parameters:
 *       - in: header
 *         name: x-demo-secret
 *         required: true
 *         schema:
 *           type: string
 *         description: Shared secret matching DEMO_PROVISION_SECRET env var
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - institutionName
 *               - contactEmail
 *             properties:
 *               institutionName:
 *                 type: string
 *                 example: Pan-Atlantic University
 *               contactEmail:
 *                 type: string
 *                 format: email
 *                 example: dsa@pau.edu.ng
 *               contactName:
 *                 type: string
 *                 example: Chidi Okeke
 *     responses:
 *       201:
 *         description: Demo environment created successfully
 *       200:
 *         description: Demo already exists — returning existing credentials
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Missing or invalid x-demo-secret header
 *       503:
 *         description: Demo provisioning not configured on this server
 */
router.post('/provision', handleProvisionDemo);

export default router;
