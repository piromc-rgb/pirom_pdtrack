/**
 * Parses date string in DD/MM/YYYY format, converting Thai Buddhist year (BE >= 2400) to Gregorian (CE).
 */
export function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.trim();
  if (!clean || clean === '-' || clean === 'N/A') return null;

  // Match DD/MM/YYYY or DD-MM-YYYY
  const parts = clean.split(/[/\-.]/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed
    let year = parseInt(parts[2], 10);

    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

    // Convert Buddhist era to Gregorian if > 2400 (e.g. 2569 -> 2026)
    if (year >= 2400) {
      year -= 543;
    } else if (year < 100) {
      // e.g. 26 -> 2026 or 69 -> 2026 (2569 BE)
      if (year >= 60 && year <= 80) {
        year = (year + 2500) - 543;
      } else {
        year += 2000;
      }
    }

    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  const parsed = new Date(clean);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Formats a date string to Thai friendly display (e.g. 14 ก.ค. 2026)
 */
export function formatThaiDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = parseDate(dateStr);
  if (!d) return dateStr;

  const thaiMonthsShort = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];

  const day = d.getDate();
  const month = thaiMonthsShort[d.getMonth()];
  const year = d.getFullYear() + 543; // Display in Buddhist era for Thai standard or Christian era

  return `${day} ${month} ${year} (${d.getFullYear()})`;
}

/**
 * Formats date as compact DD/MM/YY
 */
export function formatCompactDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = parseDate(dateStr);
  if (!d) return dateStr;

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Check if target date is overdue relative to reference date (defaults to current date)
 */
export function isDateOverdue(dateStr: string | null | undefined, refDate: Date = new Date()): boolean {
  if (!dateStr) return false;
  const d = parseDate(dateStr);
  if (!d) return false;

  // Reset time parts to midnight for pure date comparison
  const targetDateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const refDateOnly = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate()).getTime();

  return targetDateOnly < refDateOnly;
}

/**
 * Check if target date is within the next N days (e.g. within 7 days)
 */
export function isDateDueSoon(dateStr: string | null | undefined, days: number = 7, refDate: Date = new Date()): boolean {
  if (!dateStr) return false;
  const d = parseDate(dateStr);
  if (!d) return false;

  const targetDateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const refDateOnly = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate()).getTime();
  const maxDateOnly = refDateOnly + (days * 24 * 60 * 60 * 1000);

  return targetDateOnly >= refDateOnly && targetDateOnly <= maxDateOnly;
}

/**
 * Returns days difference: positive = days remaining, negative = days overdue
 */
export function getDaysDiff(dateStr: string | null | undefined, refDate: Date = new Date()): number | null {
  if (!dateStr) return null;
  const d = parseDate(dateStr);
  if (!d) return null;

  const targetDateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const refDateOnly = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate()).getTime();

  const diffMs = targetDateOnly - refDateOnly;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Formats full Thai Day of Week and date (e.g. วันศุกร์ที่ 11 กันยายน 2569)
 */
export function formatThaiDayOfWeek(dateStr: string | null | undefined): string {
  if (!dateStr) return 'ไม่ระบุวันที่';
  const d = parseDate(dateStr);
  if (!d) return dateStr;

  const thaiDays = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
  const thaiMonthsFull = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  const dayName = thaiDays[d.getDay()];
  const day = d.getDate();
  const monthName = thaiMonthsFull[d.getMonth()];
  const yearBE = d.getFullYear() + 543;

  return `${dayName}ที่ ${day} ${monthName} ${yearBE}`;
}

/**
 * Extracts a clean customer name from project name or string
 * e.g. "BDM Dohome DC 23/12/2568-22/12/2569" -> "Dohome DC"
 * e.g. "BDM AAI 1/01/2569 - 31/12/2569" -> "AAI"
 * e.g. "DH บุรีรัมย์" -> "DH บุรีรัมย์"
 */
export function extractCustomer(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return '-';
  let c = name.trim();
  // Remove leading project prefix codes e.g. BDM, MA, SR, WM, SO, RS, TS
  c = c.replace(/^(BDM|MA|SR|WM|SO|RS|TS)\s+/i, '');
  // Remove trailing date ranges e.g. 1/01/2569 - 31/12/2569 or 16/8/2568-15/8/2570 or เริ่ม...
  c = c.replace(/\s*(เริ่ม)?\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}.*$/i, '');
  c = c.replace(/\s*(เริ่ม)?\s*\d{1,2}\.\d{1,2}\.\d{2,4}.*$/i, '');
  c = c.replace(/\s*\(.*\)$/, '');
  const res = c.trim();
  return res || name;
}

