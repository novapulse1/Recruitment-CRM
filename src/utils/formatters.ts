/**
 * NovaPulse CRM - Central Formatters and Calculations
 *
 * Provides robust currency and IST date calculations across Billing,
 * Candidates, Dashboard, and Reports modules.
 */

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

/**
 * Safely parse currency values with symbols, commas, or strings.
 * Returns valid number or null.
 */
export function parseCurrency(val: any): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    return isNaN(val) ? null : val;
  }
  const str = String(val).replace(/₹|,|\s/g, '').trim();
  if (!str) return null;
  const num = Number(str);
  return isNaN(num) ? null : num;
}

/**
 * Formats a value as Indian Rupee (INR) currency.
 * Never outputs '₹ NaN' or 'NaN'.
 */
export function formatINR(val: any, fallback: string = 'Fee not set'): string {
  const num = parseCurrency(val);
  if (num === null) return fallback;
  return `₹ ${num.toLocaleString('en-IN')}`;
}

/**
 * Parses dates into a Date object supporting dd-MMM-yyyy, YYYY-MM-DD, dd/mm/yyyy.
 */
export function parseDateIST(dateStr: string | null | undefined): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const cleaned = dateStr.trim();
  if (!cleaned || cleaned === '-' || cleaned.toLowerCase() === 'null') return null;

  // Format: dd-MMM-yyyy (e.g. 16-Oct-2026, 24-Nov-2026)
  const dMmmY = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(cleaned);
  if (dMmmY) {
    const day = parseInt(dMmmY[1], 10);
    const month = MONTH_MAP[dMmmY[2].toLowerCase()];
    const year = parseInt(dMmmY[3], 10);
    if (month !== undefined && !isNaN(day) && !isNaN(year)) {
      return new Date(Date.UTC(year, month, day));
    }
  }

  // Format: YYYY-MM-DD
  const yMd = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(cleaned);
  if (yMd) {
    const year = parseInt(yMd[1], 10);
    const month = parseInt(yMd[2], 10) - 1;
    const day = parseInt(yMd[3], 10);
    return new Date(Date.UTC(year, month, day));
  }

  // Format: dd/MM/yyyy or dd-MM-yyyy
  const dMy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(cleaned);
  if (dMy) {
    const day = parseInt(dMy[1], 10);
    const month = parseInt(dMy[2], 10) - 1;
    const year = parseInt(dMy[3], 10);
    return new Date(Date.UTC(year, month, day));
  }

  // Fallback to Date.parse
  const timestamp = Date.parse(cleaned);
  return isNaN(timestamp) ? null : new Date(timestamp);
}

/**
 * Returns today's midnight UTC date aligned to Asia/Kolkata (IST).
 */
export function getTodayIST(): Date {
  const now = new Date();
  // IST is UTC + 5:30 (330 minutes)
  const istOffset = 330 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  return new Date(Date.UTC(istTime.getUTCFullYear(), istTime.getUTCMonth(), istTime.getUTCDate()));
}

/**
 * Returns formatted date string in dd-MMM-yyyy (e.g. 24-Nov-2026).
 */
export function formatDateIST(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? parseDateIST(date) : date;
  if (!d || isNaN(d.getTime())) return '-';

  const day = String(d.getUTCDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Calculate difference in whole days between two dates.
 */
export function getDaysDifference(fromDate: string | Date | null | undefined, toDate: string | Date | null | undefined): number {
  const from = typeof fromDate === 'string' ? parseDateIST(fromDate) : fromDate;
  const to = typeof toDate === 'string' ? parseDateIST(toDate) : toDate;
  if (!from || !to) return 0;
  const diffMs = to.getTime() - from.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Replacement Period calculations for Joinings & Billing.
 */
export function getReplacementMetrics(joiningDateStr: string | null | undefined, replacementDays: number | string = 90) {
  const joiningDate = parseDateIST(joiningDateStr);
  const repDays = Number(replacementDays) || 90;
  if (!joiningDate) {
    return {
      replacementEndDate: null,
      remainingDays: 0,
      isExpired: false,
      statusLabel: 'Not Set',
      badgeClass: 'bg-muted text-muted-foreground'
    };
  }

  const replacementEndDate = new Date(joiningDate.getTime() + repDays * 24 * 60 * 60 * 1000);
  const today = getTodayIST();
  const remainingDays = getDaysDifference(today, replacementEndDate);

  if (remainingDays < 0) {
    return {
      replacementEndDate,
      remainingDays: 0,
      isExpired: true,
      statusLabel: 'Expired',
      badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
    };
  }

  if (remainingDays <= 15) {
    return {
      replacementEndDate,
      remainingDays,
      isExpired: false,
      statusLabel: `${remainingDays}d left`,
      badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
    };
  }

  return {
    replacementEndDate,
    remainingDays,
    isExpired: false,
    statusLabel: `${remainingDays}d active`,
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
  };
}

/**
 * Normalizes phone numbers: strips +91, 0, spaces, hyphens, brackets, non-digits.
 * Returns clean 10-digit phone string for duplicate checks and storage.
 */
export function normalizePhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    cleaned = cleaned.slice(2);
  }
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  return cleaned.slice(-10);
}

/**
 * Calculates interview time bucket using Asia/Kolkata (IST).
 */
export function calculateInterviewTimeBucket(
  interviewDateStr: string | null | undefined,
  interviewStatus?: string
): 'Today' | 'Tomorrow' | 'This Week' | 'Overdue' | 'Upcoming' | 'Past' {
  if (!interviewDateStr || interviewDateStr.trim() === '-' || interviewDateStr.trim() === '') {
    return 'Overdue';
  }
  const d = parseDateIST(interviewDateStr);
  if (!d) return 'Overdue';

  const today = getTodayIST();
  const diffDays = getDaysDifference(today, d);

  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays <= 7) return 'This Week';
  return 'Upcoming';
}

