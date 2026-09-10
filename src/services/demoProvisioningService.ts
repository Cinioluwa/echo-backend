// src/services/demoProvisioningService.ts
//
// Provisions a self-contained Echo demo environment for an institution.
// Idempotent — calling it twice for the same slug returns the existing record.

import bcrypt from 'bcrypt';
import prisma from '../config/db.js';
import { env } from '../config/env.js';
import { sendEmail } from './emailService.js';
import logger from '../config/logger.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DemoProvisionInput {
  institutionName: string;
  contactEmail: string;
  contactName?: string;
}

export interface DemoProvisionResult {
  orgId: number;
  orgName: string;
  slug: string;
  adminEmail: string;
  studentEmail: string;
  expiresAt: Date;
  alreadyExisted: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts an institution name to a URL/email-safe slug.
 * e.g. "Pan-Atlantic University" -> "pan-atlantic-university"
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 30)
    .replace(/^-|-$/g, '');
}

const DEMO_PASSWORD = 'EchoDemo2026!';
const DEMO_EMAIL_DOMAIN = 'demo.echo-ng.com';

// ─── Main service ─────────────────────────────────────────────────────────────

export async function provisionDemo(input: DemoProvisionInput): Promise<DemoProvisionResult> {
  const { institutionName, contactEmail, contactName } = input;
  const slug = slugify(institutionName);
  const orgName = `${institutionName} - Echo Demo`;
  const adminEmail = `admin@${slug}.${DEMO_EMAIL_DOMAIN}`;
  const studentEmail = `student@${slug}.${DEMO_EMAIL_DOMAIN}`;

  const ttlDays = env.DEMO_TTL_DAYS ?? 14;
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  // ── Idempotency check ───────────────────────────────────────────────────────
  const existing = await prisma.organization.findUnique({ where: { demoSlug: slug } });
  if (existing) {
    logger.info('Demo already exists — returning existing credentials', {
      slug,
      orgId: existing.id,
    });
    return {
      orgId: existing.id,
      orgName: existing.name,
      slug,
      adminEmail,
      studentEmail,
      expiresAt: existing.expiresAt ?? expiresAt,
      alreadyExisted: true,
    };
  }

  logger.info('Provisioning demo environment', { slug, institutionName });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ── Wrap in a transaction so we never have partial state ────────────────────
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create demo organisation
    const org = await tx.organization.create({
      data: {
        name: orgName,
        domain: `${slug}.${DEMO_EMAIL_DOMAIN}`,
        domains: {
          create: [{ domain: `${slug}.${DEMO_EMAIL_DOMAIN}` }],
        },
        status: 'ACTIVE',
        isDemo: true,
        demoSlug: slug,
        expiresAt,
        isClaimVerified: false,
        categoryCustomizationLocked: false,
        joinPolicy: 'OPEN',
      },
    });

    // 2. Create categories
    const categoryNames = ['General', 'Academics', 'Facilities', 'Finance', 'Student Welfare'];
    const categories: Record<string, number> = {};
    for (const name of categoryNames) {
      const cat = await tx.category.create({
        data: { name, organizationId: org.id },
      });
      categories[name] = cat.id;
    }

    // 3. Create admin user
    const admin = await tx.user.create({
      data: {
        email: adminEmail,
        firstName: 'Demo',
        lastName: 'Admin',
        password: passwordHash,
        role: 'ADMIN',
        organizationId: org.id,
        isVerified: true,
        status: 'ACTIVE',
      },
    });

    // 4. Create student user
    const student = await tx.user.create({
      data: {
        email: studentEmail,
        firstName: 'Demo',
        lastName: 'Student',
        password: passwordHash,
        role: 'USER',
        organizationId: org.id,
        isVerified: true,
        status: 'ACTIVE',
        level: 2,
        department: 'Computer Science',
      },
    });

    const student2 = await tx.user.create({
      data: {
        email: `student2@${slug}.${DEMO_EMAIL_DOMAIN}`,
        firstName: 'Demo',
        lastName: 'Student 2',
        password: passwordHash,
        role: 'USER',
        organizationId: org.id,
        isVerified: true,
        status: 'ACTIVE',
        level: 3,
        department: 'Electrical Engineering',
      },
    });

    // 5. Seed pings — representative mix showing the Resolution Loop in action

    // Ping A: POSTED with a wave — active community discussion
    await tx.ping.create({
      data: {
        title: 'WiFi cuts out in the library during peak hours',
        content:
          'Between 2-5 PM the connection drops every 10-15 minutes. This is affecting everyone trying to submit assignments.',
        authorId: student.id,
        organizationId: org.id,
        categoryId: categories['Facilities']!,
        status: 'POSTED',
        surgeCount: 38,
        waves: {
          create: [
            {
              solution:
                'Restarting the router on Floor 2 temporarily fixes it. ICT should look at the DHCP lease table.',
              authorId: student2.id,
              organizationId: org.id,
              surgeCount: 12,
              comments: {
                create: [
                  {
                    content: 'This worked for me yesterday! But it drops again after an hour.',
                    authorId: student.id,
                    organizationId: org.id,
                    surgeCount: 3,
                  },
                ],
              },
            },
            {
              solution: 'Connect to the Eduroam network instead, it seems more stable.',
              authorId: admin.id,
              organizationId: org.id,
              surgeCount: 25,
            },
          ],
        },
      },
    });

    // Ping B: APPROVED + ACKNOWLEDGED — admin has seen it
    await tx.ping.create({
      data: {
        title: 'Incorrect course codes on the portal for 300-level students',
        content:
          'The portal shows last semester course codes for several 300-level programs. Registration is blocked.',
        authorId: student2.id,
        organizationId: org.id,
        categoryId: categories['Academics']!,
        status: 'APPROVED',
        progressStatus: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        surgeCount: 61,
        waves: {
          create: [
            {
              solution: 'The departmental office said they are updating it by tomorrow afternoon.',
              authorId: student.id,
              organizationId: org.id,
              surgeCount: 42,
            },
          ],
        },
        comments: {
          create: [
            {
              content: 'Does this apply to all departments or just Engineering?',
              authorId: student.id,
              organizationId: org.id,
              surgeCount: 5,
            },
          ],
        },
      },
    });

    // Ping C: RESOLVED — full Resolution Loop, with official response
    const resolvedPing = await tx.ping.create({
      data: {
        title: 'Broken water dispenser on the second floor',
        content: 'The main water dispenser near the staircase has been leaking for a week.',
        authorId: student.id,
        organizationId: org.id,
        categoryId: categories['Facilities']!,
        status: 'APPROVED',
        progressStatus: 'RESOLVED',
        resolvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        acknowledgedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        surgeCount: 24,
        waves: {
          create: [
            {
              solution: 'Can facilities please bring a replacement unit from the ground floor?',
              authorId: student2.id,
              organizationId: org.id,
              surgeCount: 15,
            },
          ],
        },
      },
    });

    await tx.officialResponse.create({
      data: {
        content:
          'The dispenser has been repaired by the facilities team. A backup unit has been installed on the first floor in the meantime. Thank you for raising this.',
        authorId: admin.id,
        organizationId: org.id,
        pingId: resolvedPing.id,
        isResolved: true,
      },
    });

    // Ping D: Finance — high surge, unanswered — shows urgency signalling
    await tx.ping.create({
      data: {
        title: 'Late fee charges applied despite on-time payment',
        content:
          'Many students paid school fees before the deadline but are still seeing late fee charges on the portal. Finance department, please look into this.',
        authorId: student2.id,
        organizationId: org.id,
        categoryId: categories['Finance']!,
        status: 'POSTED',
        surgeCount: 94,
        waves: {
          create: [
            {
              solution:
                'Print your payment receipt and take it to the bursary physically. They clear it immediately.',
              authorId: student.id,
              organizationId: org.id,
              surgeCount: 88,
              comments: {
                create: [
                  {
                    content: 'I did this and it worked. Make sure you go before 2 PM.',
                    authorId: student2.id,
                    organizationId: org.id,
                    surgeCount: 12,
                  },
                ],
              },
            },
          ],
        },
      },
    });

    // Ping E: Anonymous — shows the anonymity feature
    await tx.ping.create({
      data: {
        title: 'Hostel allocation process is not transparent',
        content:
          'Students with lower GPAs seem to get better rooms. There should be a clear, published criterion for hostel allocation.',
        authorId: student.id,
        organizationId: org.id,
        categoryId: categories['Student Welfare']!,
        status: 'POSTED',
        isAnonymous: true,
        anonymousAlias: 'CuriousBadger42',
        surgeCount: 17,
        comments: {
          create: [
            {
              content: 'Exactly! We need a point-based system visible on the portal.',
              authorId: student2.id,
              organizationId: org.id,
              isAnonymous: true,
              anonymousAlias: 'SilentObserver',
              surgeCount: 10,
            },
          ],
        },
      },
    });

    // Ping F: In progress — admin is working on it
    await tx.ping.create({
      data: {
        title: 'Request for a campus map in the student app',
        content:
          'Many new students struggle to find buildings. An interactive map in the app would help enormously.',
        authorId: student.id,
        organizationId: org.id,
        categoryId: categories['General']!,
        status: 'APPROVED',
        progressStatus: 'IN_PROGRESS',
        acknowledgedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        surgeCount: 45,
        waves: {
          create: [
            {
              solution: 'Embed a Google Maps iframe with custom markers for now.',
              authorId: student2.id,
              organizationId: org.id,
              surgeCount: 22,
            },
            {
              solution: 'We should build a custom interactive SVG map. It looks much better.',
              authorId: student.id,
              organizationId: org.id,
              surgeCount: 30,
            },
          ],
        },
      },
    });

    return { org, admin, student };
  });

  logger.info('Demo environment provisioned', {
    orgId: result.org.id,
    slug,
    adminEmail,
    studentEmail,
  });

  // ── Send welcome email (non-fatal) ──────────────────────────────────────────
  const appUrl = env.DEMO_APP_URL ?? env.APP_URL;
  await sendDemoWelcomeEmail({
    to: contactEmail,
    contactName: contactName ?? 'there',
    institutionName,
    adminEmail,
    studentEmail,
    password: DEMO_PASSWORD,
    appUrl,
    expiresAt,
  }).catch((err) => {
    logger.error('Failed to send demo welcome email', {
      contactEmail,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  return {
    orgId: result.org.id,
    orgName,
    slug,
    adminEmail,
    studentEmail,
    expiresAt,
    alreadyExisted: false,
  };
}

// ─── Welcome email ─────────────────────────────────────────────────────────────

interface WelcomeEmailInput {
  to: string;
  contactName: string;
  institutionName: string;
  adminEmail: string;
  studentEmail: string;
  password: string;
  appUrl: string;
  expiresAt: Date;
}

async function sendDemoWelcomeEmail(input: WelcomeEmailInput): Promise<void> {
  const {
    to,
    contactName,
    institutionName,
    adminEmail,
    studentEmail,
    password,
    appUrl,
    expiresAt,
  } = input;

  const expiryStr = expiresAt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background-color:#FAEEDA;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background-color:#FAEEDA; margin:0; padding:0;">
  <tr><td align="center" style="background-color:#FAEEDA; padding:48px 16px;">
    <!-- Card (white, rounded, outlined) -->
    <table width="600" cellpadding="0" cellspacing="0" border="0"
           style="width:600px; max-width:100%; background-color:#FFFFFF; border:1px solid #D1C0A9; border-radius:20px; overflow:hidden;">
      <tr><td align="center" style="padding:36px 40px 28px;">
        <img src="https://echo-ng.com/assets/Email/Echo%20Logo%20(Coloured).png" width="120" alt="Echo">
      </td></tr>
      <tr><td style="padding:0 40px 40px 40px; font-family:'Poppins', Arial, Helvetica, sans-serif; font-size:15px; line-height:1.7; color:#060B13;">
        
        <h2 style="margin:0 0 20px; font-size:22px; font-weight:700; color:#E8911A;">You're in.</h2>
        
        <p style="margin:0 0 16px;">
          <strong>\${institutionName}</strong> is now an Echo Founding Partner.
        </p>
        
        <p style="margin:0 0 32px;">
          Your Founding Partner Pilot begins today, unless another start date has been agreed with Echo. The Pilot runs for approximately one academic semester, is provided at no cost, and there is no setup or onboarding fee.
        </p>

        <div style="background:#f9f9f9; border:1px solid #eaeaea; border-radius:12px; padding:24px; margin:0 0 32px;">
          <h3 style="margin:0 0 16px; font-size:16px; font-weight:700;">Your Pilot Access Credentials</h3>
          
          <div style="margin-bottom:20px;">
            <p style="margin:0 0 4px; font-size:14px; font-weight:600;">Student View</p>
            <p style="margin:0 0 2px; font-size:14px; font-family:monospace; color:#444;">Email: <a href="mailto:\${studentEmail}" style="color:#E8911A; text-decoration:none;">\${studentEmail}</a></p>
            <p style="margin:0; font-size:14px; font-family:monospace; color:#444;">Password: \${password}</p>
          </div>

          <div>
            <p style="margin:0 0 4px; font-size:14px; font-weight:600;">Admin View</p>
            <p style="margin:0 0 2px; font-size:14px; font-family:monospace; color:#444;">Email: <a href="mailto:\${adminEmail}" style="color:#E8911A; text-decoration:none;">\${adminEmail}</a></p>
            <p style="margin:0; font-size:14px; font-family:monospace; color:#444;">Password: \${password}</p>
          </div>
          
          <div style="margin-top:24px; text-align:center;">
            <a href="\${appUrl}" style="display:inline-block; background-color:#E8911A; color:#FFFFFF; text-decoration:none; font-weight:700; padding:14px 34px; border-radius:999px; font-size:14px;">Enter the Pulse</a>
          </div>
        </div>

        <h3 style="margin:0 0 16px; font-size:18px; font-weight:700;">What happens next</h3>
        <ul style="margin:0 0 32px; padding-left:20px;">
          <li style="margin-bottom:8px;">Echo confirms your pilot details.</li>
          <li style="margin-bottom:8px;">Your institutional administrator setup begins.</li>
          <li style="margin-bottom:8px;">Your team receives access and onboarding information.</li>
          <li style="margin-bottom:8px;">Students can begin joining once your institutional rollout is ready.</li>
        </ul>

        <p style="margin:0;">
          A confirmation email with the accepted agreement version has been sent to your institutional email address.
        </p>

      </td></tr>
      <!-- Footer band: solid orange, white text -->
      <tr><td align="center" style="background-color:#E8911A; padding:24px; font-family:'Poppins', Arial, Helvetica, sans-serif;">
        <p style="color:#FFFFFF; font-size:12px; margin:0 0 8px 0;">Questions about your request? Reply to this email or write to <a href="mailto:hello@mail.echo-ng.com" style="color:#FFFFFF; text-decoration:underline;">hello@mail.echo-ng.com</a></p>
        <p style="color:#FFFFFF; font-size:12px; margin:0;">Copyright &copy;2026 echo-ng.com</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = `Hi ${contactName},

Your Echo demo environment for ${institutionName} is ready.

STUDENT LOGIN
Email: ${studentEmail}
Password: ${password}

ADMIN LOGIN
Email: ${adminEmail}
Password: ${password}

Open Echo: ${appUrl}

Suggested flow:
1. Start as a student - browse the Soundboard, create a Ping.
2. Switch to admin - see the Ping Index, respond, mark resolved.
3. Watch the Resolution Loop in action.

This demo is active until ${expiryStr}.
`;

  await sendEmail({
    to,
    subject: `Your Echo demo for ${institutionName} is ready`,
    html,
    text,
  });
}
