import { DeliveryItem } from '../types';
import { getQcWarehouseStatus, isOverviewCompletedOrClosed } from '../services/sheetService';

export interface ParsedDocRef {
  isDocRefPattern: boolean;
  docRef: string;
  group1?: string;
  group2?: string;
  yearBE?: string;
}

/**
 * Parses user input in format like '47-9(26-09-77)' into 'EN 69-9-47'.
 *
 * Rules:
 * - 47 is group 1 (เลขกลุ่มแรก)
 * - 9 is group 2 (เลขกลุ่มที่ 2)
 * - 26 is year in CE (converted to BE: 2026 -> 2569 -> 69)
 * - If year is already BE (e.g. 69 or 2569), preserves 69
 * - Target format: 'EN <yearBE>-<group2>-<group1>'
 */
export function parseDocRefSearch(input: string): ParsedDocRef {
  const trimmed = input.trim();
  if (!trimmed) {
    return { isDocRefPattern: false, docRef: '' };
  }

  // Regex pattern matching: <group1>-<group2>(<year>...)
  // Handles optional spaces and optional closing parenthesis while typing
  const match = trimmed.match(/^([A-Za-z0-9_-]+?)\s*-\s*([A-Za-z0-9_-]+?)\s*[\(\[]\s*(\d{2,4})(?:[^\)\]]*)?[\)\]]?$/);
  if (match) {
    const group1 = match[1].trim();
    const group2 = match[2].trim();
    const rawYear = parseInt(match[3], 10);
    let yearBE = rawYear;

    if (rawYear >= 2500) {
      yearBE = rawYear % 100;
    } else if (rawYear >= 2000) {
      yearBE = (rawYear + 543) % 100;
    } else if (rawYear < 50) {
      // 2-digit CE (e.g. 26 -> 2026 -> 2569 BE -> 69)
      yearBE = rawYear + 43;
    } else {
      // 2-digit BE (e.g. 69)
      yearBE = rawYear;
    }

    const yearBEStr = String(yearBE).padStart(2, '0');
    const docRef = `EN ${yearBEStr}-${group2}-${group1}`;
    return {
      isDocRefPattern: true,
      docRef,
      group1,
      group2,
      yearBE: yearBEStr,
    };
  }

  return {
    isDocRefPattern: false,
    docRef: trimmed,
  };
}

/**
 * Checks if a DeliveryItem matches the quick search / document number search query.
 */
export function matchItemWithQuickSearch(item: DeliveryItem, quickSearch: string | undefined | null): boolean {
  if (!quickSearch) return true;
  const rawTerm = quickSearch.trim();
  if (!rawTerm) return true;

  const parsed = parseDocRefSearch(rawTerm);
  if (parsed.isDocRefPattern) {
    const targetClean = parsed.docRef.replace(/\s+/g, '').toLowerCase();
    const itemDocClean = (item.docRef || '').replace(/\s+/g, '').toLowerCase();
    // Also allow matching if group1 had leading zero e.g. 04 vs 4
    if (itemDocClean.includes(targetClean)) return true;
    if (parsed.group1 && parsed.group2 && parsed.yearBE) {
      const altTargetClean1 = `en${parsed.yearBE}-${parsed.group2}-${parsed.group1.replace(/^0+/, '')}`;
      if (itemDocClean.includes(altTargetClean1)) return true;
    }
    return false;
  }

  const term = rawTerm.toLowerCase();
  const cleanTerm = term.replace(/\s+/g, '');
  const itemDocClean = (item.docRef || '').replace(/\s+/g, '').toLowerCase();

  // 1. Match Document Reference (Column A)
  if (itemDocClean.includes(cleanTerm) || (item.docRef || '').toLowerCase().includes(term)) {
    return true;
  }

  // 2. Match standard quick search fields
  if (item.itemName.toLowerCase().includes(term)) return true;
  if (item.itemCode.toLowerCase().includes(term)) return true;
  if (item.machineName.toLowerCase().includes(term)) return true;
  if (item.prodOrder.toLowerCase().includes(term)) return true;
  if (item.projectName.toLowerCase().includes(term) || item.projectCode.toLowerCase().includes(term)) return true;
  if (item.requestDept && item.requestDept.toLowerCase().includes(term)) return true;
  if (item.poPr && item.poPr.toLowerCase().includes(term)) return true;
  if (item.customer && item.customer.toLowerCase().includes(term)) return true;

  // 3. Match QC status
  const whStatus = item.qcWarehouseStatus || getQcWarehouseStatus(item.qcAction);
  if (
    (whStatus && whStatus.toLowerCase().includes(term)) ||
    (item.qcAction && item.qcAction.toLowerCase().includes(term)) ||
    (item.qcInspector && item.qcInspector.toLowerCase().includes(term)) ||
    (item.isQcPassed && ('ผ่าน qc'.includes(term) || 'qc passed'.includes(term)))
  ) {
    return true;
  }

  // 4. Match Operation / Overview status
  if (item.readyOp && item.readyOp.toLowerCase().includes(term)) return true;
  if (item.readyOpDesc && item.readyOpDesc.toLowerCase().includes(term)) return true;
  if (item.activeOp && item.activeOp.toLowerCase().includes(term)) return true;
  if (item.activeOpDesc && item.activeOpDesc.toLowerCase().includes(term)) return true;

  const isOvDone = isOverviewCompletedOrClosed(item.overviewStatus);
  if (item.overviewStatus && item.overviewStatus.toLowerCase().includes(term)) return true;
  if (isOvDone && ('เสร็จแล้ว'.includes(term) || term.includes('เสร็จ'))) return true;

  return false;
}

/**
 * Checks if a DeliveryItem's docRef matches the searchDocRef query,
 * supporting pattern conversion like '47-9(26-09-77)' -> 'EN 69-9-47'.
 */
export function matchDocRefFilter(itemDocRef: string | undefined | null, searchDocRef: string | undefined | null): boolean {
  if (!searchDocRef) return true;
  const raw = searchDocRef.trim();
  if (!raw) return true;

  const parsed = parseDocRefSearch(raw);
  const cleanItem = (itemDocRef || '').replace(/\s+/g, '').toLowerCase();

  if (parsed.isDocRefPattern) {
    const cleanTarget = parsed.docRef.replace(/\s+/g, '').toLowerCase();
    if (cleanItem.includes(cleanTarget)) return true;
    if (parsed.group1 && parsed.group2 && parsed.yearBE) {
      const altTarget = `en${parsed.yearBE}-${parsed.group2}-${parsed.group1.replace(/^0+/, '')}`.toLowerCase();
      if (cleanItem.includes(altTarget)) return true;
    }
    return false;
  }

  const cleanRaw = raw.replace(/\s+/g, '').toLowerCase();
  return cleanItem.includes(cleanRaw) || (itemDocRef || '').toLowerCase().includes(raw.toLowerCase());
}

