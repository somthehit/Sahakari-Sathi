/**
 * Organization Code Generator
 *
 * Rules:
 *  - Derived from shortName (preferred) or organizationName (fallback)
 *  - Strip non-alpha characters, uppercase
 *  - Target length: 4–8 chars
 *  - Strategy:
 *      1. Use shortName words → take first letter of each word, up to 8 chars
 *      2. If too short (<4), take first N chars of the cleaned name
 *      3. Pad with numeric suffix if a collision is detected
 *
 * Examples:
 *  "Everest Savings & Credit Cooperative" → "ESCC"
 *  "Pragati Bachat Tatha Rin" → "PBTR"
 *  "Softlab Solutions"        → "SOFTLAB" (short name provided)
 *  "ABC"                      → "ABC1" (too short, pad)
 *
 * Registration Number Format: {TYPE_PREFIX}-{BS_YEAR}-{SEQUENCE}
 *  e.g. COP-2083-0001, SACCOS-2083-0003, NGO-2083-0002
 */

// ── Type prefix map ───────────────────────────────────────────────────────────
const TYPE_PREFIXES: Record<string, string> = {
  'Cooperative': 'COP',
  'SACCOS':      'SACCOS',
  'School':      'SCH',
  'College':     'COL',
  'NGO':         'NGO',
  'Hospital':    'HOS',
  'Business':    'BUS',
  'Other':       'ORG',
};

/**
 * Get the registration number prefix for a given org type.
 */
export function getRegNoPrefix(organizationType: string): string {
  return TYPE_PREFIXES[organizationType] ?? 'ORG';
}

/**
 * Build a registration number candidate given prefix, BS year, and sequence.
 * Format: COP-2083-0001
 */
export function buildRegNo(organizationType: string, bsYear: number, sequence: number): string {
  const prefix = getRegNoPrefix(organizationType);
  const seq = String(sequence).padStart(4, '0');
  return `${prefix}-${bsYear}-${seq}`;
}

/**
 * Parse BS year from a BS date string "YYYY-MM-DD".
 */
export function getBsYear(bsDateStr: string): number {
  return parseInt(bsDateStr.split('-')[0], 10);
}

/**
 * Generate a candidate org code from a name string.
 * Does NOT check for uniqueness — pass to the collision resolver for that.
 */
export function generateOrgCodeCandidate(
  shortName: string | undefined | null,
  organizationName: string,
): string {
  const source = (shortName?.trim() || organizationName?.trim() || '').toUpperCase();

  // Remove everything except A-Z and spaces
  const cleaned = source.replace(/[^A-Z\s]/g, '').trim();

  if (!cleaned) return 'ORG';

  const words = cleaned.split(/\s+/).filter(Boolean);

  let code: string;

  if (words.length >= 2) {
    // Multi-word: take first letter of each word, up to 8
    code = words.map(w => w[0]).join('').slice(0, 8);
  } else {
    // Single word: take up to 8 chars directly
    code = words[0].slice(0, 8);
  }

  // Ensure minimum length of 4 by taking more chars from first word
  if (code.length < 4) {
    code = words[0].slice(0, 4);
  }

  // Still too short? pad with 'ORG'
  if (code.length < 4) {
    code = (code + 'ORG').slice(0, 4);
  }

  return code;
}

/**
 * Resolve a unique org code by appending a numeric suffix if the candidate is taken.
 * Pass an `isTaken` async function that checks the DB.
 *
 * @param shortName     - Organization short name (preferred source)
 * @param orgName       - Full organization name (fallback source)
 * @param isTaken       - Async function that returns true if the code is already in use
 * @param maxAttempts   - Safety limit (default 99)
 */
export async function resolveUniqueOrgCode(
  shortName: string | undefined | null,
  orgName: string,
  isTaken: (code: string) => Promise<boolean>,
  maxAttempts = 99,
): Promise<string> {
  const base = generateOrgCodeCandidate(shortName, orgName);

  // Try base first
  if (!(await isTaken(base))) return base;

  // Try with numeric suffixes: BASE1, BASE2 … BASE99
  for (let i = 1; i <= maxAttempts; i++) {
    const candidate = `${base.slice(0, 10)}${i}`; // keep within 12 char limit
    if (!(await isTaken(candidate))) return candidate;
  }

  // Absolute fallback: timestamp suffix
  const ts = Date.now().toString().slice(-4);
  return `${base.slice(0, 8)}${ts}`;
}
