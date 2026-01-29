import nodemailer, { type Transporter } from 'nodemailer';
import { Resend } from 'resend';
import logger from '../config/logger.js';
import { env } from '../config/env.js';

type EmailPayload = {
	to: string;
	subject: string;
	html: string;
	text?: string;
};

let transporter: Transporter | null = null;
let resendClient: Resend | null = null;

const isResendConfigured = () => Boolean(env.RESEND_API_KEY);

const getResendClient = () => {
	if (!isResendConfigured()) {
		return null;
	}
	if (resendClient) {
		return resendClient;
	}
	resendClient = new Resend(env.RESEND_API_KEY);
	return resendClient;
};

const isSmtpConfigured = () =>
	Boolean(
		env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS
	);

const getTransporter = () => {
	if (!isSmtpConfigured()) {
		logger.warn('SMTP is not configured. Email will not be sent.');
		return null;
	}

	if (transporter) {
		return transporter;
	}

	transporter = nodemailer.createTransport({
		host: env.SMTP_HOST,
		port: env.SMTP_PORT,
		secure: Number(env.SMTP_PORT) === 465,
		// On 587 we expect STARTTLS.
		requireTLS: Number(env.SMTP_PORT) === 587,
		// Avoid requests hanging for ~1min+ if SMTP is unreachable/misconfigured.
		connectionTimeout: 10_000,
		greetingTimeout: 10_000,
		socketTimeout: 15_000,
		tls: {
			servername: env.SMTP_HOST,
		},
		auth: {
			user: env.SMTP_USER,
			pass: env.SMTP_PASS,
		},
	});

	return transporter;
};

export const sendEmail = async ({ to, subject, html, text }: EmailPayload) => {
	const resend = getResendClient();
	if (resend) {
		try {
			const from = env.EMAIL_FROM ?? env.SMTP_USER ?? 'onboarding@resend.dev';
			const result = await resend.emails.send({
				from,
				to,
				subject,
				html,
				text,
			});

			// The SDK may return a structured { data, error } response.
			const anyResult = result as any;
			if (anyResult?.error) {
				logger.error('Failed to send email (resend)', {
					to,
					subject,
					from,
					message:
						anyResult.error?.message ??
						JSON.stringify(anyResult.error),
				});
				throw new Error(
					anyResult.error?.message ?? 'Resend email send failed'
				);
			}

			logger.info('Email dispatched (resend)', {
				to,
				subject,
				from,
				resendId: anyResult?.data?.id,
			});
			return;
		} catch (error) {
			const err = error as Error;
			logger.error('Failed to send email (resend)', {
				to,
				subject,
				from: env.EMAIL_FROM ?? env.SMTP_USER ?? 'onboarding@resend.dev',
				message: err.message,
			});
			throw err;
		}
	}

	const mailer = getTransporter();

	if (!mailer) {
		logger.info('Skipped email send because SMTP is not configured', {
			to,
			subject,
		});
		return;
	}

	try {
		await mailer.sendMail({
			from: env.EMAIL_FROM ?? env.SMTP_USER,
			to,
			subject,
			html,
			text,
		});
		logger.info('Email dispatched (smtp)', { to, subject });
	} catch (error) {
		const err = error as Error;
		logger.error('Failed to send email (smtp)', {
			to,
			subject,
			message: err.message,
		});
		throw err;
	}
};

const sanitizeAppUrl = () => env.APP_URL.replace(/\/$/, '');

export const buildVerificationEmail = (
	token: string,
	recipientFirstName?: string | null
) => {
	const verifyUrl = `${sanitizeAppUrl()}/login?token=${token}`;
	const greeting = recipientFirstName ? `Hi ${recipientFirstName},` : 'Hi,';

	return {
		subject: 'Verify your Echo account',
		html: `
			<p>${greeting}</p>
			<p>Welcome to Echo! Please verify your email address to activate your account.</p>
			<p><a href="${verifyUrl}">Click here to verify your email</a>.</p>
			<p>If the button above does not work, copy and paste this link into your browser:</p>
			<p>${verifyUrl}</p>
			<p>This link expires in 24 hours.</p>
			<p>— The Echo Team</p>
		`,
		text: `${greeting}

Welcome to Echo! Please verify your email address to activate your account.

Verification link: ${verifyUrl}

This link expires in 24 hours.

— The Echo Team`,
	};
};

export const buildPasswordResetEmail = (token: string) => {
	const resetUrl = `${sanitizeAppUrl()}/reset-password?token=${token}`;

	return {
		subject: 'Reset your Echo password',
		html: `
			<p>We received a request to reset your Echo password.</p>
			<p><a href="${resetUrl}">Click here to reset your password</a>.</p>
			<p>If the button above does not work, copy and paste this link into your browser:</p>
			<p>${resetUrl}</p>
			<p>If you did not request this change, please ignore this email.</p>
			<p>This link expires in 60 minutes.</p>
			<p>— The Echo Team</p>
		`,
		text: `We received a request to reset your Echo password.

Password reset link: ${resetUrl}

If you did not request this change, you can ignore this email. This link expires in 60 minutes.

— The Echo Team`,
	};
};

export const buildOrganizationRequestEmail = (
	organizationName: string,
	domain: string
) => {
	const dashboardUrl = `${sanitizeAppUrl()}/admin/organization-requests`;

	return {
		subject: `New organization request: ${organizationName}`,
		html: `
			<p>A new organization has requested access to Echo.</p>
			<p><strong>Organization:</strong> ${organizationName}</p>
			<p><strong>Domain:</strong> ${domain}</p>
			<p>Sign in to the Echo admin dashboard to review and approve this request.</p>
			<p><a href="${dashboardUrl}">Open admin dashboard</a></p>
		`,
		text: `A new organization has requested access to Echo.

Organization: ${organizationName}
Domain: ${domain}

Review in the admin dashboard: ${dashboardUrl}`,
	};
};
