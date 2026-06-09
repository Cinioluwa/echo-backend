import crypto from 'crypto';
import bcrypt from 'bcrypt';
import type { Prisma, PrismaClient } from '@prisma/client';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient;

export const generateNumericOtp = (): string => {
  // Generate a 6-digit numeric OTP
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const hashOtp = async (code: string): Promise<string> => {
  // Use a lower cost factor for OTPs since they are short-lived
  return bcrypt.hash(code, 8);
};

export const verifyOtpHash = async (code: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(code, hash);
};

export const createGuestOtpSession = async (
  client: PrismaClientOrTx,
  email: string,
  guestUserId?: number
) => {
  // Delete any existing unused sessions for this email
  await client.guestOtpSession.deleteMany({
    where: { email, used: false },
  });

  const code = generateNumericOtp();
  const hashedCode = await hashOtp(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  const session = await client.guestOtpSession.create({
    data: {
      email,
      code: hashedCode,
      expiresAt,
      guestUserId,
    },
  });

  return { session, rawCode: code };
};

export const consumeGuestOtpSession = async (
  client: PrismaClientOrTx,
  email: string,
  code: string
) => {
  const session = await client.guestOtpSession.findFirst({
    where: {
      email,
      used: false,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!session) {
    throw new Error('No active OTP session found.');
  }

  if (session.expiresAt < new Date()) {
    throw new Error('OTP has expired.');
  }

  if (session.attempts >= MAX_ATTEMPTS) {
    throw new Error('Maximum verification attempts exceeded. Please request a new code.');
  }

  const isValid = await verifyOtpHash(code, session.code);

  if (!isValid) {
    // Increment attempts
    await client.guestOtpSession.update({
      where: { id: session.id },
      data: { attempts: { increment: 1 } },
    });
    throw new Error('Invalid OTP code.');
  }

  // Mark as used
  await client.guestOtpSession.update({
    where: { id: session.id },
    data: { used: true },
  });

  return session;
};
