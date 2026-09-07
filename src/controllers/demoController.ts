// src/controllers/demoController.ts

import { Request, Response } from 'express';
import { z } from 'zod';
import { provisionDemo } from '../services/demoProvisioningService.js';
import { env } from '../config/env.js';
import logger from '../config/logger.js';

const provisionSchema = z.object({
  institutionName: z.string().min(2).max(120),
  contactEmail: z.string().email(),
  contactName: z.string().max(80).optional(),
});

export async function handleProvisionDemo(req: Request, res: Response): Promise<void> {
  // ── Secret header guard ─────────────────────────────────────────────────────
  const secret = env.DEMO_PROVISION_SECRET;
  if (!secret) {
    res.status(503).json({ error: 'Demo provisioning is not configured on this server' });
    return;
  }

  const provided = req.headers['x-demo-secret'];
  if (!provided || provided !== secret) {
    logger.warn('Demo provision attempt with invalid secret', {
      ip: req.ip,
      provided: typeof provided === 'string' ? provided.slice(0, 6) + '...' : '(none)',
    });
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // ── Validate body ───────────────────────────────────────────────────────────
  const parsed = provisionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', issues: parsed.error.issues });
    return;
  }

  const { institutionName, contactEmail, contactName } = parsed.data;

  try {
    const result = await provisionDemo({ institutionName, contactEmail, contactName });

    logger.info('Demo provisioned via API', {
      orgId: result.orgId,
      slug: result.slug,
      alreadyExisted: result.alreadyExisted,
    });

    res.status(result.alreadyExisted ? 200 : 201).json({
      success: true,
      alreadyExisted: result.alreadyExisted,
      orgId: result.orgId,
      orgName: result.orgName,
      adminEmail: result.adminEmail,
      studentEmail: result.studentEmail,
      expiresAt: result.expiresAt.toISOString(),
    });
  } catch (err) {
    logger.error('Demo provisioning failed', {
      institutionName,
      contactEmail,
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ error: 'Demo provisioning failed. Please try again.' });
  }
}
