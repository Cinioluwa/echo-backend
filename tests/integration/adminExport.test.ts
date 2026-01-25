import { describe, it, expect, beforeAll } from 'vitest';
import { buildTestClient } from './appClient.js';
import { getPrisma } from './testContainer.js';
import bcrypt from 'bcrypt';

describe('Admin Export API', () => {
    let client: any;
    let adminToken: string;
    let orgId: number;

    beforeAll(async () => {
        client = await buildTestClient();
        const prisma = getPrisma();

        // Setup Test Organization
        const org = await prisma.organization.create({
            data: {
                name: 'Export Test Org',
                domain: 'export.test.edu',
                status: 'ACTIVE'
            }
        });
        orgId = org.id;

        // Setup Admin User
        const password = 'password123';
        const hashedPassword = await bcrypt.hash(password, 10);

        const admin = await prisma.user.create({
            data: {
                email: 'admin@export.test.edu',
                firstName: 'Admin',
                lastName: 'Export',
                role: 'ADMIN',
                organizationId: org.id,
                password: hashedPassword,
                status: 'ACTIVE'
            }
        });

        // Login to get token
        const loginRes = await client
            .post('/api/users/login')
            .send({ email: 'admin@export.test.edu', password });

        adminToken = loginRes.body.token;

        // Setup Category
        const cat = await prisma.category.create({
            data: { name: 'Facilities', organizationId: org.id }
        });

        // Setup Data to Export
        // 1. Pending Ping
        await prisma.ping.create({
            data: {
                title: 'Broken Window',
                content: 'Dangerous glass',
                authorId: admin.id,
                organizationId: org.id,
                categoryId: cat.id,
                status: 'POSTED',
                surgeCount: 5,
                createdAt: new Date('2025-01-01')
            }
        });

        // 2. Resolved Ping
        const p2 = await prisma.ping.create({
            data: {
                title: 'Fixed Door',
                content: 'Door is fixed',
                authorId: admin.id,
                organizationId: org.id,
                categoryId: cat.id,
                status: 'APPROVED',
                surgeCount: 10,
                createdAt: new Date('2025-01-02'),
                resolvedAt: new Date('2025-01-04') // 2 days open
            }
        });

        await prisma.officialResponse.create({
            data: {
                content: 'Done',
                authorId: admin.id,
                pingId: p2.id,
                organizationId: org.id,
                isResolved: true
            }
        });
    });

    it('should download a CSV file with correct headers and rows', async () => {
        const response = await client
            .get('/api/admin/export/pings')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).toBe(200);
        expect(response.header['content-type']).toContain('text/csv');
        expect(response.header['content-disposition']).toContain('attachment; filename="pings_export_');

        const csv = response.text;
        const lines = csv.split('\n');

        // Header Check
        expect(lines[0].trim()).toBe('ID,Date,Category,Title,Status,Surge Count,Days Open,Resolved');

        // Row Check (Should have 2 rows + 1 header = 3 lines, but split adds empty string if ends with \n)
        expect(lines.length).toBeGreaterThanOrEqual(3);

        // Content Check
        expect(csv).toContain('Broken Window');
        expect(csv).toContain('Fixed Door');
        expect(csv).toContain(',5,'); // Surge count 5
        expect(csv).toContain(',2,true'); // 2 days open, resolved=true
    });

    it('should filter by date range', async () => {
        const response = await client
            .get('/api/admin/export/pings?startDate=2025-01-02&endDate=2025-01-05')
            .set('Authorization', `Bearer ${adminToken}`);

        const csv = response.text;
        expect(csv).toContain('Fixed Door');
        expect(csv).not.toContain('Broken Window'); // Was created on Jan 1
    });
});
