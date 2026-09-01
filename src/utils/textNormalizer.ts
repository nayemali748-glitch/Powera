/**
 * Universal text and numeral normalizer for POWER Utility Management.
 * Solves cross-device keyboard, mobile font, and multilingual numeral issues
 * (Bengali ০-৯, Hindi/Devanagari ०-९, Arabic ٠-٩, Fullwidth, dashes, zero-width chars).
 */

export function normalizeUniversalText(input: string | null | undefined): string {
  if (input === null || input === undefined) return '';
  let s = String(input);

  // 1. Unicode Compatibility Decomposition (NFKC)
  try {
    s = s.normalize('NFKC');
  } catch {
    // ignore if not supported
  }

  // 2. Remove invisible zero-width characters, BOM, non-breaking spaces
  s = s.replace(/[\u200B-\u200D\uFEFF\u00A0\u200E\u200F\u180E\u202F\u205F\u3000\u00AD]/g, '');

  // 3. Convert Bengali numerals (০-৯: U+09E6 to U+09EF) -> 0-9
  s = s.replace(/[\u09E6-\u09EF]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) - 0x09E6 + 48);
  });

  // 4. Convert Devanagari / Hindi numerals (०-९: U+0966 to U+096F) -> 0-9
  s = s.replace(/[\u0966-\u096F]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) - 0x0966 + 48);
  });

  // 5. Convert Arabic-Indic numerals (٠-٩: U+0660 to U+0669) -> 0-9
  s = s.replace(/[\u0660-\u0669]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) - 0x0660 + 48);
  });

  // 6. Convert Eastern Arabic numerals (۰-۹: U+06F0 to U+06F9) -> 0-9
  s = s.replace(/[\u06F0-\u06F9]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) - 0x06F0 + 48);
  });

  // 7. Normalize all variations of dashes/hyphens to standard ASCII hyphen '-'
  // (e.g. en dash –, em dash —, minus sign −, fullwidth hyphen －)
  s = s.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-');

  // 8. Normalize multiple spaces into single space and trim
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

/**
 * Normalizes an ID for comparison or storage.
 * e.g. "LM-5239", "lm 5239", "LM–৫২৩৯" -> "lm-5239"
 */
export function normalizeId(id: string | null | undefined): string {
  const norm = normalizeUniversalText(id);
  return norm.toLowerCase();
}

/**
 * Normalizes password by converting numerals and trimming invisible whitespace,
 * while preserving character casing.
 */
export function normalizePassword(password: string | null | undefined): string {
  return normalizeUniversalText(password);
}

/**
 * Checks if an entered login ID matches a candidate user account.
 * Supports:
 * - Exact match
 * - Case-insensitive match
 * - Hyphen / space-insensitive match (e.g. "LM5239" == "LM-5239" == "lm 5239")
 * - Numeric-only match (e.g. "5239" matches "LM-5239")
 * - Phone number match (e.g. "8695716192" or "9830000000")
 * - Name match (e.g. "Jasim" or "Nayem")
 * - Bengali transliteration aliases (e.g. "এডমিন", "কর্মী", "লাইনম্যান")
 */
export function isUserMatch(
  input: string,
  user: { idNo?: string; id?: string; phone?: string; name?: string; role?: string }
): boolean {
  if (!input || !user) return false;

  const cleanInput = normalizeUniversalText(input).toLowerCase();
  if (!cleanInput) return false;

  const rawId = (user.idNo || '').toString();
  const cleanUserId = normalizeUniversalText(rawId).toLowerCase();
  const cleanIdInternal = (user.id || '').toString().toLowerCase();
  const cleanUserPhone = normalizeUniversalText(user.phone || '').replace(/[^0-9]/g, '');
  const cleanUserName = normalizeUniversalText(user.name || '').toLowerCase();
  const cleanRole = (user.role || '').toLowerCase();

  // 1. Direct or internal ID match
  if (cleanInput === cleanUserId || cleanInput === cleanIdInternal) return true;

  // 2. Alphanumeric match (stripping dashes, spaces, underscores)
  const inputAlphaNum = cleanInput.replace(/[^a-z0-9]/g, '');
  const userAlphaNum = cleanUserId.replace(/[^a-z0-9]/g, '');
  if (inputAlphaNum && userAlphaNum && inputAlphaNum === userAlphaNum) return true;

  // 3. Numeric ID match (e.g. user typed 5239 for LM-5239 or vice versa)
  const inputDigits = cleanInput.replace(/[^0-9]/g, '');
  const userDigits = cleanUserId.replace(/[^0-9]/g, '');
  if (inputDigits && userDigits && inputDigits.length >= 3 && inputDigits === userDigits) {
    return true;
  }

  // 4. Phone number match (10 digits)
  if (inputDigits && inputDigits.length >= 10 && cleanUserPhone && cleanUserPhone.includes(inputDigits)) {
    return true;
  }

  // 5. User Name match
  if (cleanUserName && (cleanUserName === cleanInput || cleanUserName.includes(cleanInput))) {
    return true;
  }

  // 6. Super Admin aliases
  const isAdminInput = ['admin', 'adm', 'administrator', 'এডমিন', 'প্রকৌশলী', '8695716192'].includes(cleanInput);
  if (isAdminInput && (cleanRole === 'admin' || cleanUserId === 'admin' || cleanUserId === '8695716192')) {
    return true;
  }

  // 7. Worker aliases
  const isWorkerInput = ['worker', 'workar', 'wrk', 'কর্মী', 'লাইনম্যান', 'lineman'].includes(cleanInput);
  if (isWorkerInput && (cleanRole === 'worker' || cleanUserId === 'worker' || cleanUserId === 'workar')) {
    return true;
  }

  return false;
}
