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

export const getDomainCandidates = (domain: string) => {
  const normalized = normalizeDomain(domain);
  const labels = normalized.split('.').filter(Boolean);

  // Need at least a.b to form a plausible domain.
  if (labels.length < 2) {
    return [normalized];
  }

  // Most specific -> least specific (but keep at least 2 labels).
  const candidates: string[] = [];
  for (let i = 0; i <= labels.length - 2; i++) {
    candidates.push(labels.slice(i).join('.'));
  }

  return candidates;
};

export const extractDomainFromEmail = (email: string) => {
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2 || !parts[1]) {
    throw new Error('INVALID_EMAIL');
  }
  return normalizeDomain(parts[1]);
};

export const isConsumerEmailDomain = (domain: string) =>
  CONSUMER_EMAIL_DOMAINS.has(normalizeDomain(domain));
