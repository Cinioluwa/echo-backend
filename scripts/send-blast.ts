import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendEmail } from '../src/services/emailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from the root directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const connectionUrl = dbUrl 
    ? (dbUrl.includes('?') ? `${dbUrl}&connection_limit=2` : `${dbUrl}?connection_limit=2`)
    : undefined;

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: connectionUrl
        }
    }
});

// ============================================================================
// CONFIGURATION: Edit these values before running the script
// ============================================================================

const TARGET_ORGANIZATION_NAME = "Covenant University";

const EMAIL_SUBJECT = "43 down, 957 to go";

const EMAIL_HTML_CONTENT = `
    <p>Hey,</p>
    <p>Thank you for joining Echo or surging a ping. Genuinely. You didn't have to, and you did.</p>
    
    <p>Here's where things stand right now. These are the top 3 pings on the platform:</p>
    
    <ol style="margin-bottom: 24px;">
      <li style="margin-bottom: 8px;"><strong>Shuttles to Engineering Building</strong> — 43 surges<br/><a href="https://app.echo-ng.com/share/ping/93">https://app.echo-ng.com/share/ping/93</a></li>
      <li style="margin-bottom: 8px;"><strong>Let's Address the Elephant in the Room</strong> — 13 surges<br/><a href="https://app.echo-ng.com/share/ping/92">https://app.echo-ng.com/share/ping/92</a></li>
      <li style="margin-bottom: 8px;"><strong>WATER!!!</strong> — 14 surges<br/><a href="https://app.echo-ng.com/share/ping/95">https://app.echo-ng.com/share/ping/95</a></li>
    </ol>
    
    <p>43 surges on the shuttle ping is a start. But to get management to actually respond, we need around 1,000. Engineering faculty alone has more than that. If even half of engineering students surge this, it becomes impossible to ignore.</p>
    
    <p>Send the shuttle link to one person today. That's all. One coursemate, one friend, anyone who's felt this.</p>
    
    <p><a href="https://app.echo-ng.com/share/ping/93">https://app.echo-ng.com/share/ping/93</a></p>
    
    <p>They don't need to create an account. Just a school email to verify they're a CU student.</p>
    
    <p>The water and engagement pings are worth looking at too, by the way. Real issues, real students behind them.</p>
    
    <p>Let's get to 1,000.</p>
`;

const EMAIL_TEXT_CONTENT = `Hey,

Thank you for joining Echo or surging a ping. Genuinely. You didn't have to, and you did.

Here's where things stand right now. These are the top 3 pings on the platform:

1. Shuttles to Engineering Building — 43 surges
https://app.echo-ng.com/share/ping/93

2. Let's Address the Elephant in the Room — 13 surges
https://app.echo-ng.com/share/ping/92

3. WATER!!! — 14 surges
https://app.echo-ng.com/share/ping/95

43 surges on the shuttle ping is a start. But to get management to actually respond, we need around 1,000. Engineering faculty alone has more than that. If even half of engineering students surge this, it becomes impossible to ignore.

Send the shuttle link to one person today. That's all. One coursemate, one friend, anyone who's felt this.

https://app.echo-ng.com/share/ping/93

They don't need to create an account. Just a school email to verify they're a CU student.

The water and engagement pings are worth looking at too, by the way. Real issues, real students behind them.

Let's get to 1,000.`;

// ============================================================================

async function sendEmailBlast() {
    try {
        console.log(`Starting email blast for organization: "${TARGET_ORGANIZATION_NAME}"...\n`);

        // 1. Find the organization
        const org = await prisma.organization.findFirst({
            where: { name: TARGET_ORGANIZATION_NAME }
        });

        if (!org) {
            console.error(`❌ Organization "${TARGET_ORGANIZATION_NAME}" not found in the database.`);
            process.exit(1);
        }

        // 2. Fetch all users in this organization
        const usersToEmail = await prisma.user.findMany({
            where: {
                organizationId: org.id
            },
            select: { id: true, email: true }
        });

        if (usersToEmail.length === 0) {
            console.log('No users found in this organization who are opted in to emails.');
            process.exit(0);
        }

        console.log(`Found ${usersToEmail.length} users opted in to emails. Dispatching now...`);

        // 3. Send emails
        let successCount = 0;
        let failCount = 0;

        for (const user of usersToEmail) {
            try {
                await sendEmail({
                    to: user.email,
                    subject: EMAIL_SUBJECT,
                    html: EMAIL_HTML_CONTENT,
                    text: EMAIL_TEXT_CONTENT
                });
                successCount++;
                console.log(`[OK] Sent to ${user.email}`);
            } catch (err: any) {
                failCount++;
                console.error(`[FAIL] Could not send to ${user.email}:`, err.message);
            }
        }

        console.log(`\n✅ Email blast complete! Successfully sent: ${successCount}, Failed: ${failCount}`);

    } catch (error) {
        console.error('\n❌ An unexpected error occurred:', error);
    } finally {
        await prisma.$disconnect();
    }
}

sendEmailBlast();
