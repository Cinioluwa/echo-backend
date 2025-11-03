const CONSUMER_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'protonmail.com',
  'gmx.com',
  'aol.com',
]);

export const normalizeDomain = (domain: string) => domain.trim().toLowerCase();

export const extractDomainFromEmail = (email: string) => {
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2 || !parts[1]) {
    throw new Error('INVALID_EMAIL');
  }
  return normalizeDomain(parts[1]);
};

export const isConsumerEmailDomain = (domain: string) =>
  CONSUMER_EMAIL_DOMAINS.has(normalizeDomain(domain));
