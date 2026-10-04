/**
 * Centralized Date & Time Formatter for POWER App
 * - Date Format: DD-MM-YYYY (e.g. 03-10-2026)
 * - Time Format: 12-hour with AM/PM (e.g. 02:15 PM or 02:15:30 PM)
 */

export function parseValidDate(val?: string | number | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  const str = String(val).trim();
  if (!str || str === 'undefined' || str === 'null' || str === '-' || str === 'N/A') return null;

  // Match DD-MM-YYYY or DD/MM/YYYY with optional time
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[,\s]+(.*))?$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    let hours = 0;
    let minutes = 0;
    let seconds = 0;
    if (dmyMatch[4]) {
      const tMatch = dmyMatch[4].trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
      if (tMatch) {
        hours = parseInt(tMatch[1], 10);
        minutes = parseInt(tMatch[2], 10);
        seconds = tMatch[3] ? parseInt(tMatch[3], 10) : 0;
        const mer = tMatch[4]?.toUpperCase();
        if (mer === 'PM' && hours < 12) hours += 12;
        if (mer === 'AM' && hours === 12) hours = 0;
      }
    }
    const d = new Date(year, month, day, hours, minutes, seconds);
    if (!isNaN(d.getTime())) return d;
  }

  // Match YYYY-MM-DD with optional time (non-ISO)
  const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    let hours = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
    const minutes = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
    const seconds = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;
    const mer = ymdMatch[7]?.toUpperCase();
    if (mer === 'PM' && hours < 12) hours += 12;
    if (mer === 'AM' && hours === 12) hours = 0;
    const d = new Date(year, month, day, hours, minutes, seconds);
    if (!isNaN(d.getTime())) return d;
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Formats any date into DD-MM-YYYY
 */
export function formatDateDDMMYYYY(val?: string | number | Date | null): string {
  if (!val) return '';
  const str = String(val).trim();
  const directMatch = str.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (directMatch) {
    return `${directMatch[1]}-${directMatch[2]}-${directMatch[3]}`;
  }
  const d = parseValidDate(val);
  if (!d) return str;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/**
 * Formats any date/time into 12-hour AM/PM format (e.g., 02:35 PM or 02:35:10 PM)
 */
export function formatTime12Hour(val?: string | number | Date | null, includeSeconds = false): string {
  if (!val) return '';
  const str = String(val).trim();
  // If already a time string with AM/PM
  const ampmMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (ampmMatch) {
    const hh = String(parseInt(ampmMatch[1], 10)).padStart(2, '0');
    const mm = ampmMatch[2];
    const ss = ampmMatch[3] || '00';
    const mer = ampmMatch[4].toUpperCase();
    return includeSeconds ? `${hh}:${mm}:${ss} ${mer}` : `${hh}:${mm} ${mer}`;
  }
  // If 24-hour time string HH:mm or HH:mm:ss
  const timeMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2];
    const seconds = timeMatch[3] || '00';
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const hh = String(hours).padStart(2, '0');
    return includeSeconds ? `${hh}:${minutes}:${seconds} ${ampm}` : `${hh}:${minutes} ${ampm}`;
  }

  const d = parseValidDate(val);
  if (!d) return str;
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hh = String(hours).padStart(2, '0');
  return includeSeconds ? `${hh}:${minutes}:${seconds} ${ampm}` : `${hh}:${minutes} ${ampm}`;
}

/**
 * Formats any date/time into "DD-MM-YYYY hh:mm AM/PM"
 */
export function formatDateTime12Hour(val?: string | number | Date | null, includeSeconds = false): string {
  if (!val) return '';
  const d = parseValidDate(val);
  if (!d) {
    return String(val).trim();
  }
  return `${formatDateDDMMYYYY(d)} ${formatTime12Hour(d, includeSeconds)}`;
}

/**
 * Returns current system date in DD-MM-YYYY
 */
export function getNowDateDDMMYYYY(): string {
  return formatDateDDMMYYYY(new Date());
}

/**
 * Returns current system time in 12-hour AM/PM
 */
export function getNowTime12Hour(includeSeconds = false): string {
  return formatTime12Hour(new Date(), includeSeconds);
}
