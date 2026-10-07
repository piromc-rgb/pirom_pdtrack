/**
 * Parses date string in DD/MM/YYYY format, converting Thai Buddhist year (BE >= 2400) to Gregorian (CE).
 */
export function parseDate(dateStr: any): Date | null {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
  if (typeof dateStr === 'number') {
    if (dateStr > 30000 && dateStr < 60000) {
      const utcDays = dateStr - 25569;
      return new Date(utcDays * 86400 * 1000);
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof dateStr !== 'string') return null;

  // Convert Thai digits (๐-๙) to Arabic digits (0-9)
  const thaiDigits = ['๐','๑','๒','๓','๔','๕','๖','๗','๘','๙'];
  const clean = dateStr.trim().replace(/[๐-๙]/g, (ch: string) => thaiDigits.indexOf(ch).toString());
  if (!clean || clean === '-' || clean === 'N/A') return null;

  // Extract all digit groups (handles slashes, dashes, dots, spaces, commas, etc.)
  const numbers = clean.match(/\d+/g);
  if (!numbers || numbers.length < 2) {
    const fallback = new Date(clean);
    return isNaN(fallback.getTime()) ? null : fallback;
  }

  let day = 1;
  let month = 0;
  let year = new Date().getFullYear();

  if (numbers.length >= 3) {
    // If first part is a 4-digit year (YYYY-MM-DD or YYYY/MM/DD)
    if (numbers[0].length === 4 || parseInt(numbers[0], 10) > 1000) {
      year = parseInt(numbers[0], 10);
      month = parseInt(numbers[1], 10) - 1;
      day = parseInt(numbers[2], 10);
    } else {
      // D/M/Y or DD/MM/YYYY
      day = parseInt(numbers[0], 10);
      month = parseInt(numbers[1], 10) - 1;
      year = parseInt(numbers[2], 10);
    }
  } else if (numbers.length === 2) {
    // Only day and month provided (e.g. 6/10) -> assume current year 2026
    day = parseInt(numbers[0], 10);
    month = parseInt(numbers[1], 10) - 1;
    year = 2026;
  }

  if (isNaN(day) || isNaN(month) || isNaN(year) || month < 0 || month > 11 || day < 1 || day > 31) {
    return null;
  }

  // Convert Buddhist era to Gregorian if > 2400 (e.g. 2569 -> 2026)
  if (year >= 2400) {
    year -= 543;
  } else if (year < 100) {
    // 2-digit year: 60-99 -> Thai BE (e.g. 69 -> 2026), 0-59 -> CE (e.g. 26 -> 2026)
    if (year >= 60 && year <= 99) {
      year = (year + 2500) - 543;
    } else {
      year += 2000;
    }
  }

  const d = new Date(year, month, day);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formats a date string to Thai friendly display (e.g. 6 ต.ค. 26)
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
  const year2 = String(d.getFullYear()).slice(-2);

  return `${day} ${month} ${year2}`;
}

/**
 * Formats date as compact d/m/y (e.g. 6/10/26)
 */
export function formatCompactDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = parseDate(dateStr);
  if (!d) return dateStr;

  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = String(d.getFullYear()).slice(-2);

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

/**
 * Returns month key in 'YYYY-MM' format from a date string (e.g. '14/7/2026' -> '2026-07')
 */
export function getMonthKey(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const d = parseDate(dateStr);
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Formats a month key ('YYYY-MM') to full Thai month and Buddhist Era year (e.g. '2026-07' -> 'กรกฎาคม 2569')
 */
export function formatThaiMonth(monthKey: string | null | undefined): string {
  if (!monthKey || monthKey === 'no-date') return 'ไม่ระบุเดือน';
  const parts = monthKey.split('-');
  if (parts.length < 2) return monthKey;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const thaiMonthsFull = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const mName = thaiMonthsFull[m] || parts[1];
  const yearBE = (y >= 2400 ? y : y + 543);
  return `${mName} ${yearBE}`;
}

/**
 * Formats a month key ('YYYY-MM') to short Thai month and BE year (e.g. '2026-07' -> 'ก.ค. 2569')
 */
export function formatThaiMonthShort(monthKey: string | null | undefined): string {
  if (!monthKey || monthKey === 'no-date') return 'ไม่ระบุ';
  const parts = monthKey.split('-');
  if (parts.length < 2) return monthKey;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const thaiMonthsShort = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];
  const mName = thaiMonthsShort[m] || parts[1];
  const yearBE = (y >= 2400 ? y : y + 543);
  return `${mName} ${yearBE}`;
}

/**
 * Calculates days between two date strings: positive if date2 > date1
 */
export function getDaysBetweenDates(date1Str: string | null | undefined, date2Str: string | null | undefined): number | null {
  if (!date1Str || !date2Str) return null;
  const d1 = parseDate(date1Str);
  const d2 = parseDate(date2Str);
  if (!d1 || !d2) return null;

  const t1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate()).getTime();
  const t2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate()).getTime();
  const diffMs = t2 - t1;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Formats a date string (DD/MM/YYYY or Date) to HTML input date value (YYYY-MM-DD)
 */
export function formatDateToInput(dateVal: string | Date | null | undefined): string {
  if (!dateVal) return '';
  const d = parseDate(dateVal);
  if (!d) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats HTML input date value (YYYY-MM-DD) or any date string to d/m/y format (e.g. 6/10/26)
 */
export function formatInputToCompact(inputDateStr: string | null | undefined): string {
  if (!inputDateStr) return '';
  return formatCompactDate(inputDateStr);
}

/**
 * Adds N days to a date string and returns formatted DD/MM/YYYY
 */
export function addDaysToDate(dateVal: string | Date | null | undefined, days: number): string {
  const d = parseDate(dateVal) || new Date();
  const nextDate = new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
  return formatCompactDate(nextDate);
}
