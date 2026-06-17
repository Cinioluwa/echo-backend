import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

// Override EMAIL_FROM for this script before importing email service
process.env.EMAIL_FROM = 'contact@echo-ng.com';

const { sendEmail } = await import('../src/services/emailService.js');

const dbUrl = process.env.DIRECT_URL;
const connectionUrl = dbUrl 
    ? (dbUrl.includes('?') ? `${dbUrl}&connection_limit=1&pool_timeout=0` : `${dbUrl}?connection_limit=1&pool_timeout=0`)
    : undefined;

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: connectionUrl
        }
    }
});

async function run() {
    try {
        console.log("Resolving organization request...");
        
        const orgName = "Achievers University";
        const orgDomain = "achievers.edu.ng";
        const requesterEmail = "somtochukwuonyema02@gmail.com";
        const requestId = 14;

        // 1. Create or find Organization
        let org = await prisma.organization.findUnique({
            where: { name: orgName }
        });

        if (!org) {
            org = await prisma.organization.create({
                data: {
                    name: orgName,
                    domain: orgDomain,
                    status: "ACTIVE"
                }
            });
            console.log("Created Organization:", org.name);
        } else {
            console.log("Organization already exists:", org.name);
            if (org.status !== 'ACTIVE') {
                org = await prisma.organization.update({
                    where: { id: org.id },
                    data: { status: 'ACTIVE' }
                });
                console.log("Set Organization status to ACTIVE");
            }
        }

        // 2. Add OrganizationDomain
        const existingDomain = await prisma.organizationDomain.findUnique({
            where: { domain: orgDomain }
        });
        
        if (!existingDomain) {
            await prisma.organizationDomain.create({
                data: {
                    domain: orgDomain,
                    organizationId: org.id
                }
            });
            console.log("Created OrganizationDomain:", orgDomain);
        } else {
            console.log("OrganizationDomain already exists.");
        }

        // 3. Resolve Request
        const request = await prisma.organizationRequest.findUnique({
            where: { id: requestId }
        });

        if (request && request.status !== 'APPROVED') {
            await prisma.organizationRequest.update({
                where: { id: requestId },
                data: {
                    status: 'APPROVED',
                    resolvedAt: new Date(),
                    organizationId: org.id
                }
            });
            console.log(`Resolved Request #${requestId}`);
        } else if (!request) {
            console.log(`Request #${requestId} not found.`);
        } else {
            console.log(`Request #${requestId} already approved.`);
        }

        // 4. Send email
        const appUrl = (process.env.APP_URL || 'https://app.echo-ng.com').replace(/\/$/, '');
        const signupUrl = `${appUrl}/signup`;

        const subject = "Your organization is now on Echo!";
        const html = `
            <p>Hi,</p>
            <p>Great news! Your request to add <strong>${orgName}</strong> has been approved, and the organization is now live on Echo.</p>
            <p>To get started, you and other students can sign up using your university email address (ending in <strong>@${orgDomain}</strong>).</p>
            <p><a href="${signupUrl}">Click here to sign up</a></p>
            <p>Once you log in, you'll be able to:</p>
            <ul>
                <li>Post and view pings (issues or topics) within your university.</li>
                <li>Propose waves (solutions) to help resolve those issues.</li>
                <li>Surge pings and waves to show your support and get them noticed.</li>
            </ul>
            <p>Welcome to Echo!</p>
            <p>— The Echo Team</p>
        `;
        const text = `Hi,

Great news! Your request to add ${orgName} has been approved, and the organization is now live on Echo.

To get started, you and other students can sign up using your university email address (ending in @${orgDomain}).

Sign up here: ${signupUrl}

Once you log in, you'll be able to:
- Post and view pings (issues or topics) within your university.
- Propose waves (solutions) to help resolve those issues.
- Surge pings and waves to show your support and get them noticed.

Welcome to Echo!

— The Echo Team`;
        
        console.log("Sending email to:", requesterEmail);
        console.log("From:", process.env.EMAIL_FROM);
        
        await sendEmail({
            to: requesterEmail,
            subject,
            html,
            text
        });

        console.log("Email dispatched successfully.");

    } catch (err) {
        console.error("An error occurred:", err);
    } finally {
        await prisma.$disconnect();
    }
}

run();
