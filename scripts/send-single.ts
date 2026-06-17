import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

// ============================================================================
// CONFIGURATION: Edit these values before running the script
// ============================================================================

const TARGET_EMAIL = "somtochukwuonyema02@gmail.com";
const EMAIL_SUBJECT = "Your organization is now on Echo!";
const FROM_EMAIL = "contact@echo-ng.com"; 

const EMAIL_HTML_CONTENT = `
    <p>Hi,</p>
    <p>Great news! Your request to add <strong>Achievers University</strong> has been approved, and the organization is now live on Echo.</p>
    <p>To get started, you and other students can sign up using your university email address (ending in <strong>@achievers.edu.ng</strong>).</p>
    <p><a href="https://app.echo-ng.com/signup">Click here to sign up</a></p>
    <p>Once you log in, you'll be able to:</p>
    <ul>
        <li>Post and view pings (issues or topics) within your university.</li>
        <li>Propose waves (solutions) to help resolve those issues.</li>
        <li>Surge pings and waves to show your support and get them noticed.</li>
    </ul>
    <p>Welcome to Echo!</p>
    <p>— The Echo Team</p>
`;

const EMAIL_TEXT_CONTENT = `Hi,

Great news! Your request to add Achievers University has been approved, and the organization is now live on Echo.

To get started, you and other students can sign up using your university email address (ending in @achievers.edu.ng).

Sign up here: https://app.echo-ng.com/signup

Once you log in, you'll be able to:
- Post and view pings (issues or topics) within your university.
- Propose waves (solutions) to help resolve those issues.
- Surge pings and waves to show your support and get them noticed.

Welcome to Echo!

— The Echo Team`;

// ============================================================================

// Delete Resend API Key to force SMTP fallback since Resend fetch is failing
delete process.env.RESEND_API_KEY;

if (FROM_EMAIL) {
    process.env.EMAIL_FROM = FROM_EMAIL;
}

// Dynamically import to ensure process.env changes are picked up if they affect the module
const { sendEmail } = await import('../src/services/emailService.js');

async function sendSingleEmail() {
    try {
        console.log(`Preparing to send email to: ${TARGET_EMAIL}`);
        console.log(`Subject: ${EMAIL_SUBJECT}`);
        console.log(`From: ${process.env.EMAIL_FROM || process.env.SMTP_USER}`);

        await sendEmail({
            to: TARGET_EMAIL,
            subject: EMAIL_SUBJECT,
            html: EMAIL_HTML_CONTENT,
            text: EMAIL_TEXT_CONTENT
        });

        console.log(`\n✅ Email successfully sent to ${TARGET_EMAIL}!`);

    } catch (error) {
        console.error('\n❌ An unexpected error occurred:', error);
    }
}

sendSingleEmail();
