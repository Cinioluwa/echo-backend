// src/constants/reservedKeywords.ts
// Exhaustive list of reserved display name keywords to prevent impersonation.
// All comparisons are case-insensitive and strip common letter substitutions.

export const RESERVED_KEYWORDS: string[] = [
  // Administrative titles
  'admin',
  'administrator',
  'sysadmin',
  'system',
  'moderator',
  'mod',
  'staff',
  'support',
  'helpdesk',
  'official',
  'verified',

  // Platform / app identity
  'echo',
  'echobot',
  'echoapp',
  'echoofficial',

  // Academic / organization hierarchy
  'dean',
  'chancellor',
  'provost',
  'rector',
  'registrar',
  'bursar',
  'hod', // head of department
  'director',
  'president',
  'vicepresident',
  'vp',
  'chairman',
  'chairperson',

  // Corporate / authority titles
  'ceo',
  'cto',
  'coo',
  'cfo',
  'hr',
  'humanresources',
  'manager',
  'supervisor',
  'principal',

  // Trust / security signals
  'trustworthy',
  'legitimate',
  'real',
  'authentic',
  'genuine',
  'security',
];

/**
 * Normalises a string for blocklist comparison:
 * - lowercase
 * - strips spaces and underscores
 * - replaces common leet substitutions (0→o, 1→i/l, 3→e, @→a, $→s)
 */
export function normaliseForBlocklist(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+|_|-/g, '')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/5/g, 's')
    .replace(/!/g, 'i')
    .replace(/\+/g, 't');
}

/**
 * Returns true if the display name contains a reserved keyword after normalisation.
 */
export function containsReservedKeyword(displayName: string): boolean {
  const normalised = normaliseForBlocklist(displayName);
  return RESERVED_KEYWORDS.some((keyword) => normalised.includes(keyword));
}
