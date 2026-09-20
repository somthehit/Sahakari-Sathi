/**
 * Generate a strong random one-time / temporary password.
 * Guarantees at least one lowercase, uppercase, digit and special character.
 */
const CHARS = {
  lower: 'abcdefghjkmnpqrstuvwxyz',
  upper: 'ABCDEFGHJKMNPQRSTUVWXYZ',
  digit: '23456789',
  special: '!@#$%&*?',
};

const pick = (set: string): string => set[Math.floor(Math.random() * set.length)];

export function generatePassword(length = 12): string {
  const groups = [CHARS.lower, CHARS.upper, CHARS.digit, CHARS.special];
  const chars: string[] = groups.map(pick);

  const pool = groups.join('');
  while (chars.length < Math.max(8, length)) {
    chars.push(pick(pool));
  }

  // Shuffle (Fisher–Yates)
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}
