/**
 * Identity Verification and Normalization Utilities for CredVidhi
 *
 * Implements deterministic matching for borrower recovery:
 * - Timezone-safe Date of Birth parsing & comparison across formats (YYYY-MM-DD, DD/MM/YYYY, etc.)
 * - Mobile number normalization (stripping spaces, country codes, matching last 10 digits)
 * - Name matching (whitespace/case normalization, token-set comparison)
 * - Email matching (case-insensitive optional validation)
 */

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

/**
 * Parses date string in common Indian / ISO formats to numeric year, month, day.
 * Avoids JavaScript `new Date()` timezone conversions that cause 1-day shifts.
 */
export function parseDateParts(dateStr?: string | null): DateParts | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.trim().split('T')[0].trim();

  // Pattern 1: YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
  const ymdMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10);
    const d = parseInt(ymdMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100) {
      return { year: y, month: m, day: d };
    }
  }

  // Pattern 2: DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100) {
      return { year: y, month: m, day: d };
    }
  }

  return null;
}

/**
 * Compares two dates deterministically.
 * If record has no recorded DOB (e.g. pre-KYC), a valid adult DOB satisfies identity proof.
 */
export function isDobMatching(inputDobStr: string, recordDobStr?: string | null): boolean {
  const inParts = parseDateParts(inputDobStr);
  if (!inParts) return false;

  // Verify applicant is at least 18 years old and not futuristic
  const currentYear = new Date().getFullYear();
  if (inParts.year > currentYear - 18 || inParts.year < 1920) {
    return false;
  }

  // If record has no DOB stored, valid adult DOB input satisfies verification
  if (!recordDobStr || !recordDobStr.trim()) {
    return true;
  }

  const recParts = parseDateParts(recordDobStr);
  if (!recParts) {
    // Fallback digit match if record was stored with unexpected separators
    const inDigits = `${inParts.year}${String(inParts.month).padStart(2, '0')}${String(inParts.day).padStart(2, '0')}`;
    const recDigits = recordDobStr.replace(/\D/g, '');
    return recDigits.length >= 8 && recDigits === inDigits;
  }

  return (
    inParts.year === recParts.year &&
    inParts.month === recParts.month &&
    inParts.day === recParts.day
  );
}

/**
 * Normalizes phone number to last 10 digits for Indian standard MSISDNs.
 */
export function normalizePhoneDigits(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * Checks if input phone number matches record phone number.
 */
export function isPhoneMatching(inputPhone: string, recordPhone?: string | null): boolean {
  const inDigits = normalizePhoneDigits(inputPhone);
  const recDigits = normalizePhoneDigits(recordPhone);
  if (inDigits.length < 8 || recDigits.length < 8) return false;
  return inDigits === recDigits || recDigits.endsWith(inDigits) || inDigits.endsWith(recDigits);
}

/**
 * Normalizes name tokens for case and whitespace insensitivity.
 */
export function normalizeNameTokens(name?: string | null): string[] {
  if (!name) return [];
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Matches names with support for token ordering ("Aarav Sharma" vs "Sharma Aarav").
 */
export function isNameMatching(inputName: string, recordName?: string | null): boolean {
  const inTokens = normalizeNameTokens(inputName);
  const recTokens = normalizeNameTokens(recordName);
  if (inTokens.length === 0 || recTokens.length === 0) return false;

  const inStr = inTokens.join(' ');
  const recStr = recTokens.join(' ');
  if (inStr === recStr) return true;

  const inSet = new Set(inTokens);
  const recSet = new Set(recTokens);

  // Exact token set equality
  if (inTokens.length === recTokens.length && inTokens.every((t) => recSet.has(t))) {
    return true;
  }

  // Subset containment when at least first and last name present
  if (inTokens.length >= 2 && inTokens.every((t) => recSet.has(t))) {
    return true;
  }
  if (recTokens.length >= 2 && recTokens.every((t) => inSet.has(t))) {
    return true;
  }

  return false;
}

/**
 * Optional email matching (case-insensitive).
 */
export function isEmailMatching(inputEmail?: string | null, recordEmail?: string | null): boolean {
  if (!inputEmail || !inputEmail.trim()) return true;
  if (!recordEmail || !recordEmail.trim()) return true;
  return inputEmail.trim().toLowerCase() === recordEmail.trim().toLowerCase();
}
