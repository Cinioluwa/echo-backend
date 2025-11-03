import crypto from 'crypto';
import type { Prisma, PrismaClient } from '@prisma/client';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 60 minutes

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient;

const generateToken = () => crypto.randomBytes(48).toString('hex');

export const createEmailVerificationToken = async (
  client: PrismaClientOrTx,
  userId: number
) => {
  await client.emailVerificationToken.deleteMany({ where: { userId } });

  const token = generateToken();
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

  // Cast to any to avoid transient type mismatch before prisma generate runs
  const record = await (client as any).emailVerificationToken.create({
    data: { token, expiresAt, userId },
  });

  return record;
};

export const createPasswordResetToken = async (
  client: PrismaClientOrTx,
  userId: number
) => {
  await client.passwordResetToken.deleteMany({ where: { userId } });

  const token = generateToken();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

  // Cast to any to avoid transient type mismatch before prisma generate runs
  const record = await (client as any).passwordResetToken.create({
    data: { token, expiresAt, userId },
  });

  return record;
};

export const markEmailVerificationTokenUsed = async (
  client: PrismaClientOrTx,
  tokenId: number
) => {
  // Cast to any to avoid transient type mismatch before prisma generate runs
  await (client as any).emailVerificationToken.update({
    where: { id: tokenId },
    data: { used: true },
  });
};

export const markPasswordResetTokenUsed = async (
  client: PrismaClientOrTx,
  tokenId: number
) => {
  // Cast to any to avoid transient type mismatch before prisma generate runs
  await (client as any).passwordResetToken.update({
    where: { id: tokenId },
    data: { used: true },
  });
};
