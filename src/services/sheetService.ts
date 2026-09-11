import Papa from 'papaparse';
import defaultItemsJson from '../data/defaultData.json';
import defaultProductionMap from '../data/productionMap.json';
import defaultQcData from '../data/qcData.json';
import defaultOverviewData from '../data/overviewStatusData.json';
import defaultOverviewItemMap from '../data/overviewItemMap.json';
import itemPdMap from '../data/itemPdMap.json';
import { DeliveryItem, MachineSummary, OverviewMeta } from '../types';
import { parseDate, isDateOverdue, isDateDueSoon, extractCustomer } from '../utils/dateUtils';

export const overviewStatusMap = defaultOverviewData as Record<string, OverviewMeta>;
export const overviewItemMap = defaultOverviewItemMap as {
  byItem: Record<string, OverviewMeta>;
  byProjItem: Record<string, OverviewMeta>;
};
export const qcStatusMap = defaultQcData as Record<string, QcMeta>;

export const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1l5FbiznQNUhIpUNuma9iivKzYvcaCTiL7Z_9mDcCijE/edit?gid=472754949#gid=472754949';
export const DEFAULT_PRODUCTION_URL = 'https://docs.google.com/spreadsheets/d/1YLgaxdeJR_MCHJhFkoAPAJfGmvUJB2K9GPgirYqlhPE/edit?gid=1308741309#gid=1308741309';
export const DEFAULT_QC_URL = 'https://docs.google.com/spreadsheets/d/1w8B0DyG7PEy_YLHM5HCI_eVU_nt4HvA8xHWShuLRL_8/edit?gid=1814251242#gid=1814251242';

const STORAGE_URL_KEY = 'pdtrack_sheet_url';
const STORAGE_PROD_URL_KEY = 'pdtrack_prod_sheet_url';
const STORAGE_QC_URL_KEY = 'pdtrack_qc_sheet_url';
const STORAGE_CACHE_KEY = 'pdtrack_cached_data_v3';
const STORAGE_TIMESTAMP_KEY = 'pdtrack_last_sync';

export interface ProductionMeta {
  actionTopic: string;
  ncrNo: string;
  week: string;
  targetRequested: string;
  requestDept: string;
  requesterName: string;
}

export interface QcMeta {
  pdNo: string;
  qcDate: string;
  inspector: string;
  qtyPass: string;
  qtyFail: string;
  action: string;
  remarks: string;
  topic: string;
  project: string;
}

export function getCsvExportUrl(url: string): string {
  try {
    const sheetIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!sheetIdMatch) return url;
    const sheetId = sheetIdMatch[1];

    const gidMatch = url.match(/gid=([0-9]+)/);
    const gid = gidMatch ? gidMatch[1] : '0';

    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  } catch (err) {
    console.error('Error generating CSV URL:', err);
    return url;
  }
}

export function getSavedSheetUrl(): string {
  return localStorage.getItem(STORAGE_URL_KEY) || DEFAULT_SHEET_URL;
}

export function saveSheetUrl(url: string): void {
  localStorage.setItem(STORAGE_URL_KEY, url.trim());
}

export function getSavedProdUrl(): string {
  return localStorage.getItem(STORAGE_PROD_URL_KEY) || DEFAULT_PRODUCTION_URL;
}

export function saveProdUrl(url: string): void {
  localStorage.setItem(STORAGE_PROD_URL_KEY, url.trim());
}

export function getSavedQcUrl(): string {
  return localStorage.getItem(STORAGE_QC_URL_KEY) || DEFAULT_QC_URL;
}

export function saveQcUrl(url: string): void {
  localStorage.setItem(STORAGE_QC_URL_KEY, url.trim());
}

export function getLastSyncTime(): string | null {
  return localStorage.getItem(STORAGE_TIMESTAMP_KEY);
}

function norm(s: string | null | undefined): string {
  if (!s) return '';
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Parses raw CSV text of File 2 (Record รับ - จ่าย Production) into lookup maps
 */
export function parseProductionCsv(csvText: string): {
  byDocItem: Record<string, ProductionMeta>;
  byDoc: Record<string, ProductionMeta>;
} {
  const parsed = Papa.parse<string[]>(csvText, { skipEmptyLines: true });
  const rows = parsed.data;
  if (!rows || rows.length < 3) {
    return { byDocItem: {}, byDoc: {} };
  }

  // Row 1 is actual headers
  const headers = rows[1].map(h => h.trim().replace(/\n/g, ' '));
  const findCol = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.toLowerCase().includes(k.toLowerCase())));

  const docRefIdx = findCol(['Document number', 'Reference']);
  const topicIdx = findCol(['หัวข้อแจ้งดำเนินการ', 'หัวข้อ']);
  const ncrIdx = findCol(['NCR', 'IPR']);
  const itemCodeIdx = findCol(['เลขที่ Item', 'Item Code']);
  const weekIdx = findCol(['Week']);
  const targetReqIdx = findCol(['เป้าหมายที่ต้องการ']);
  const deptIdx = findCol(['หน่วยงานที่แจ้งดำเนินการ', 'หน่วยงาน']);
  const reqIdx = findCol(['ชื่อผู้แจ้งดำเนินการ', 'ผู้แจ้ง']);

  const byDocItem: Record<string, ProductionMeta> = {};
  const byDoc: Record<string, ProductionMeta> = {};

  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;

    const getVal = (idx: number) => (idx >= 0 && idx < r.length ? r[idx].trim() : '');

    const doc = getVal(docRefIdx !== -1 ? docRefIdx : 0);
    const topic = getVal(topicIdx !== -1 ? topicIdx : 1);
    const ncr = getVal(ncrIdx !== -1 ? ncrIdx : 2);
    const itemCode = getVal(itemCodeIdx !== -1 ? itemCodeIdx : 7);
    const week = getVal(weekIdx !== -1 ? weekIdx : 13);
    const targetReq = getVal(targetReqIdx !== -1 ? targetReqIdx : 14);
    const dept = getVal(deptIdx !== -1 ? deptIdx : 15);
    const requester = getVal(reqIdx !== -1 ? reqIdx : 16);

    const meta: ProductionMeta = {
      actionTopic: topic,
      ncrNo: ncr,
      week,
      targetRequested: targetReq,
      requestDept: dept,
      requesterName: requester,
    };

    const docNorm = norm(doc);
    const itemNorm = norm(itemCode);

    if (docNorm && itemNorm) {
      byDocItem[`${docNorm}|${itemNorm}`] = meta;
    }
    if (docNorm && (dept || requester || topic)) {
      if (!byDoc[docNorm]) {
        byDoc[docNorm] = meta;
      }
    }
  }

  return { byDocItem, byDoc };
}

/**
 * Extracts all PD numbers from a production order string, including sequential ranges:
 * e.g. "PD2603618-PD2603636" -> ["PD2603618", ..., "PD2603636"]
 * e.g. "PD2603204-3207" -> ["PD2603204", "PD2603205", "PD2603206", "PD2603207"]
 */
export function extractPdNumbers(prodOrder: string): string[] {
  if (!prodOrder) return [];
  const pds: string[] = [];

  // Range matching: e.g. PD2603618-PD2603636 or PD2603204-3207
  const rangeMatch = prodOrder.match(/PD(\d+)\s*-\s*(?:PD)?(\d+)/i);
  if (rangeMatch) {
    const startStr = rangeMatch[1];
    const endStr = rangeMatch[2];
    const startNum = parseInt(startStr, 10);
    let endNum = parseInt(endStr, 10);
    if (endStr.length < startStr.length) {
      endNum = parseInt(startStr.slice(0, startStr.length - endStr.length) + endStr, 10);
    }
    if (!isNaN(startNum) && !isNaN(endNum) && endNum >= startNum && endNum - startNum <= 200) {
      for (let n = startNum; n <= endNum; n++) {
        pds.push(`PD${n}`);
      }
    }
  }

  // Also collect any discrete PD numbers
  const directMatches = prodOrder.match(/PD\d+/gi);
  if (directMatches) {
    directMatches.forEach(p => {
      const up = p.toUpperCase();
      if (!pds.includes(up)) pds.push(up);
    });
  }

  return pds;
}

/**
 * Parses raw CSV of Google Sheet 3 (QC Checklist: gid=1814251242)
 * Rule: If a PD No exists in this sheet, it is considered QC Passed!
 */
export function parseQcCsv(csvText: string): Record<string, QcMeta> {
  const parsed = Papa.parse<string[]>(csvText, { skipEmptyLines: true });
  const rows = parsed.data;
  if (!rows || rows.length < 2) return {};

  const headers = rows[0].map(h => h.trim().replace(/\n/g, ' '));
  const findCol = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.toLowerCase().includes(k.toLowerCase())));

  const pdIdx = findCol(['PD No', 'PD No.', 'PD']);
  const dateIdx = findCol(['วันที่ตรวจ']);
  const inspectorIdx = findCol(['ผู้ตรวจสอบ']);
  const passIdx = findCol(['ผ่าน']);
  const failIdx = findCol(['ไม่ผ่าน']);
  const actionIdx = findCol(['การดำเนินการ']);
  const remarkIdx = findCol(['หมายเหตุ', 'รายละเอียด']);
  const topicIdx = findCol(['หัวข้อการตรวจสอบ']);
  const projIdx = findCol(['เลขที่โครงการ']);

  const qcMap: Record<string, QcMeta> = {};

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length <= (pdIdx !== -1 ? pdIdx : 5)) continue;

    const pdVal = r[pdIdx !== -1 ? pdIdx : 5]?.trim();
    if (!pdVal) continue;

    const matches = pdVal.match(/PD\d+/gi);
    if (!matches) continue;

    const meta: QcMeta = {
      pdNo: matches[0].toUpperCase(),
      qcDate: dateIdx !== -1 && dateIdx < r.length ? r[dateIdx]?.trim() || '' : '',
      inspector: inspectorIdx !== -1 && inspectorIdx < r.length ? r[inspectorIdx]?.trim() || '' : '',
      qtyPass: passIdx !== -1 && passIdx < r.length ? r[passIdx]?.trim() || '' : '',
      qtyFail: failIdx !== -1 && failIdx < r.length ? r[failIdx]?.trim() || '' : '',
      action: actionIdx !== -1 && actionIdx < r.length ? r[actionIdx]?.trim() || '' : '',
      remarks: remarkIdx !== -1 && remarkIdx < r.length ? r[remarkIdx]?.trim() || '' : '',
      topic: topicIdx !== -1 && topicIdx < r.length ? r[topicIdx]?.trim() || '' : '',
      project: projIdx !== -1 && projIdx < r.length ? r[projIdx]?.trim() || '' : '',
    };

    matches.forEach(p => {
      qcMap[p.toUpperCase()] = meta;
    });
  }

  return qcMap;
}

/**
 * Look up Overview Status from the Overview Status Map for any given PD numbers
 */
export function getOverviewStatusForPds(pds: string[]): OverviewMeta | undefined {
  if (!pds || pds.length === 0) return undefined;
  for (const p of pds) {
    const clean = p.toUpperCase().trim();
    const meta = overviewStatusMap[clean];
    if (meta) return meta;
  }
  return undefined;
}

/**
 * Look up Overview Status prioritized by Item Code (เลขที่ Item), with fallback to PD Number
 */
export function getOverviewStatusForItem(
  itemCode?: string,
  projectCode?: string,
  pds?: string[]
): OverviewMeta | undefined {
  const cleanCode = itemCode?.trim().toUpperCase();
  const cleanProj = projectCode?.trim().toUpperCase();

  // 1. Primary: match by Project Code + Item Code (Most accurate for project-specific orders)
  if (cleanProj && cleanCode) {
    const projKey = `${cleanProj}|${cleanCode}`;
    const meta = overviewItemMap.byProjItem[projKey];
    if (meta) return meta;
  }

  // 2. Secondary: match by Item Code directly
  if (cleanCode) {
    const meta = overviewItemMap.byItem[cleanCode];
    if (meta) return meta;
  }

  // 3. Fallback: match by PD Number if available
  if (pds && pds.length > 0) {
    return getOverviewStatusForPds(pds);
  }

  return undefined;
}

/**
 * Parses File 1 (Check list ส่งมอบ) and joins with production and QC maps
 */
export function parseDeliveryCsvWithProduction(
  csvText: string,
  productionMap: { byDocItem: Record<string, ProductionMeta>; byDoc: Record<string, ProductionMeta> },
  qcMap?: Record<string, QcMeta>
): DeliveryItem[] {
  const parsed = Papa.parse<string[]>(csvText, { skipEmptyLines: true });
  const rows = parsed.data;
  if (!rows || rows.length < 2) {
    throw new Error('ข้อมูลในตารางว่างเปล่าหรือไม่ถูกต้อง');
  }

  const headers = rows[0].map(h => h.trim().replace(/\n/g, ' '));
  const findCol = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.toLowerCase().includes(k.toLowerCase())));

  const docRefIdx = findCol(['Document number', 'Reference', 'เอกสาร']);
  const projCodeIdx = findCol(['เลขที่โครงการ', 'Project No']);
  const projNameIdx = findCol(['ชื่อโครงการ', 'Project Name']);
  const docTypeIdx = findCol(['ประเภท', 'Doc Type']);
  const machineIdx = findCol(['ชื่อเครื่องจักร', 'Machine Name', 'Machine']);
  const itemCodeIdx = findCol(['เลขที่ Item', 'Item Code', 'Item No']);
  const itemNameIdx = findCol(['ชื่อ Item', 'Item Name', 'รายการ']);
  const qtyIdx = findCol(['จำนวน', 'Qty', 'Quantity']);
  const prodOrderIdx = findCol(['Production Order', 'Prod Order']);
  const pdActLineIdx = findCol(['จำนวนPD', 'Act Line']);
  const notifyDateIdx = findCol(['วันที่แจ้งดำเนินการ', 'Notify Date']);
  const target1Idx = findCol(['เป้าหมายส่งมอบ 1', 'เป้าหมาย 1']);
  const target2Idx = findCol(['เป้าหมายส่งมอบ 2', 'เป้าหมาย 2']);
  const target3Idx = findCol(['เป้าหมายส่งมอบ 3', 'เป้าหมาย 3']);
  const target4Idx = findCol(['เป้าหมายส่งมอบ 4', 'เป้าหมาย 4']);
  const target5Idx = findCol(['เป้าหมายส่งมอบ 5', 'เป้าหมาย 5']);
  const targetLatestIdx = findCol(['เป้าหมายล่าสุด', 'Target Latest']);
  const poPrIdx = findCol(['PO/PR', 'PO', 'PR']);
  const remarkIdx = findCol(['หมายเหตุ', 'Remark', 'Note']);
  const statusIdx = findCol(['สถานะ', 'Status']);
  const closedIdx = findCol(['Closed', 'ปิดงาน']);

  const items: DeliveryItem[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0 || r.every(cell => !cell.trim())) continue;

    const getVal = (idx: number) => (idx >= 0 && idx < r.length ? r[idx].trim() : '');

    const docRef = getVal(docRefIdx !== -1 ? docRefIdx : 0);
    const projectCode = getVal(projCodeIdx !== -1 ? projCodeIdx : 1);
    const projectName = getVal(projNameIdx !== -1 ? projNameIdx : 2);
    const docType = getVal(docTypeIdx !== -1 ? docTypeIdx : 3);
    const rawMachine = getVal(machineIdx !== -1 ? machineIdx : 4);
    const itemCode = getVal(itemCodeIdx !== -1 ? itemCodeIdx : 5);
    const itemName = getVal(itemNameIdx !== -1 ? itemNameIdx : 6);
    const qtyStr = getVal(qtyIdx !== -1 ? qtyIdx : 7);
    let prodOrder = getVal(prodOrderIdx !== -1 ? prodOrderIdx : 8);
    // If prodOrder is empty in the delivery sheet, look up matched PD from Week 37 Excel
    if (!prodOrder && itemCode) {
      const projItemKey = `${projectCode.trim()}|${itemCode.trim()}`;
      prodOrder = (itemPdMap.byProjItem as Record<string, string>)[projItemKey] || 
                  (itemPdMap.byItem as Record<string, string>)[itemCode.trim()] || '';
    }
    const pdActLine = getVal(pdActLineIdx !== -1 ? pdActLineIdx : 9);
    const notifyDate = getVal(notifyDateIdx !== -1 ? notifyDateIdx : 10);
    const target1 = getVal(target1Idx !== -1 ? target1Idx : 11);
    const target2 = getVal(target2Idx !== -1 ? target2Idx : 12);
    const target3 = getVal(target3Idx !== -1 ? target3Idx : 13);
    const target4 = getVal(target4Idx !== -1 ? target4Idx : 14);
    const target5 = getVal(target5Idx !== -1 ? target5Idx : 15);
    const rawTargetLatest = getVal(targetLatestIdx !== -1 ? targetLatestIdx : 16);
    const poPr = getVal(poPrIdx !== -1 ? poPrIdx : 17);
    const remark = getVal(remarkIdx !== -1 ? remarkIdx : 18);
    const rawStatus = getVal(statusIdx !== -1 ? statusIdx : 19);
    const closed = getVal(closedIdx !== -1 ? closedIdx : 20);

    const machineName = rawMachine || '(ไม่ระบุเครื่องจักร)';
    const targetLatest = rawTargetLatest || target5 || target4 || target3 || target2 || target1;

    let qty = 1;
    if (qtyStr) {
      const parsedQty = parseFloat(qtyStr.replace(/,/g, ''));
      if (!isNaN(parsedQty)) qty = parsedQty;
    }

    const isDelivered = rawStatus.includes('ส่ง') || rawStatus.toLowerCase().includes('deliv');

    // Link with Production Register
    const docNorm = norm(docRef);
    const itemNorm = norm(itemCode);
    const key = `${docNorm}|${itemNorm}`;

    let prodMeta: ProductionMeta | undefined = productionMap.byDocItem[key];
    if (!prodMeta && docNorm && productionMap.byDoc[docNorm]) {
      prodMeta = productionMap.byDoc[docNorm];
    }

    // Link with QC Sheet (If any PD in this item exists in QC Sheet, it passed QC)
    const itemPds = extractPdNumbers(prodOrder);
    const matchedQcPds = qcMap ? itemPds.filter(p => qcMap[p]) : [];
    const isQcPassed = matchedQcPds.length > 0;
    const firstQcMeta = isQcPassed && qcMap ? qcMap[matchedQcPds[0]] : undefined;

    // Link with Overview Status (Prioritized by Item Code)
    const overviewMeta = getOverviewStatusForItem(itemCode, projectCode, itemPds);
    if (!prodOrder && overviewMeta?.prodOrder) {
      prodOrder = overviewMeta.prodOrder;
    }

    items.push({
      id: `item-${i}`,
      docRef,
      projectCode,
      projectName,
      customer: extractCustomer(projectName),
      docType,
      machineName,
      hasMachine: Boolean(rawMachine),
      itemCode,
      itemName,
      qty,
      prodOrder,
      pdActLine,
      notifyDate,
      target1,
      target2,
      target3,
      target4,
      target5,
      targetLatest,
      poPr,
      remark,
      status: isDelivered ? 'ส่งแล้ว' : 'รอดำเนินการ',
      rawStatus,
      closed,
      // Joined production metadata
      actionTopic: prodMeta?.actionTopic || '',
      ncrNo: prodMeta?.ncrNo || '',
      requestDept: prodMeta?.requestDept || '',
      requesterName: prodMeta?.requesterName || '',
      targetRequested: prodMeta?.targetRequested || '',
      week: prodMeta?.week || '',
      // Joined QC metadata
      isQcPassed,
      qcDate: firstQcMeta?.qcDate || '',
      qcInspector: firstQcMeta?.inspector || '',
      qcPassedQty: firstQcMeta?.qtyPass || '',
      qcTopic: firstQcMeta?.topic || '',
      qcRemarks: firstQcMeta?.remarks || '',
      qcPdList: matchedQcPds,
      // Joined Overview metadata
      overviewStatus: overviewMeta?.status || '',
      overviewCustomer: overviewMeta?.customer || '',
      overviewProject: overviewMeta?.project || '',
      overviewItemCode: overviewMeta?.itemCode || '',
    });
  }

  return items;
}

/**
 * Fetch data connecting all 3 Google Sheets:
 * 1. Delivery Sheet 1 (Check list ส่งมอบ)
 * 2. Production Sheet 2 (Record รับ - จ่าย Production)
 * 3. QC Sheet 3 (QC Checklist ผ่านการตรวจสอบ)
 */
export async function fetchDeliveryData(
  customUrl?: string, 
  customProdUrl?: string,
  customQcUrl?: string
): Promise<{ items: DeliveryItem[]; fromLive: boolean; error?: string }> {
  const sheetUrl = customUrl || getSavedSheetUrl();
  const prodUrl = customProdUrl || getSavedProdUrl();
  const qcUrl = customQcUrl || getSavedQcUrl();

  const csvUrl1 = getCsvExportUrl(sheetUrl);
  const csvUrl2 = getCsvExportUrl(prodUrl);
  const csvUrl3 = getCsvExportUrl(qcUrl);

  try {
    // Fetch all 3 sheets in parallel
    const [res1, res2, res3] = await Promise.allSettled([
      fetch(csvUrl1, { method: 'GET', headers: { Accept: 'text/csv,text/plain,*/*' } }),
      fetch(csvUrl2, { method: 'GET', headers: { Accept: 'text/csv,text/plain,*/*' } }),
      fetch(csvUrl3, { method: 'GET', headers: { Accept: 'text/csv,text/plain,*/*' } }),
    ]);

    if (res1.status !== 'fulfilled' || !res1.value.ok) {
      throw new Error('ไม่สามารถดึงข้อมูลจาก Google Sheet 1 (Check list ส่งมอบ) ได้');
    }

    const csvText1 = await res1.value.text();

    // Production Sheet 2 map
    let prodMap = defaultProductionMap as { byDocItem: Record<string, ProductionMeta>; byDoc: Record<string, ProductionMeta> };
    if (res2.status === 'fulfilled' && res2.value.ok) {
      try {
        const csvText2 = await res2.value.text();
        const liveProdMap = parseProductionCsv(csvText2);
        if (Object.keys(liveProdMap.byDocItem).length > 0) {
          prodMap = liveProdMap;
        }
      } catch (prodErr) {
        console.warn('Could not parse live Sheet 2, using cached production map:', prodErr);
      }
    }

    // QC Sheet 3 map
    let qcMap = defaultQcData as Record<string, QcMeta>;
    if (res3.status === 'fulfilled' && res3.value.ok) {
      try {
        const csvText3 = await res3.value.text();
        const liveQcMap = parseQcCsv(csvText3);
        if (Object.keys(liveQcMap).length > 0) {
          qcMap = liveQcMap;
        }
      } catch (qcErr) {
        console.warn('Could not parse live QC Sheet, using cached QC data:', qcErr);
      }
    }

    const items = parseDeliveryCsvWithProduction(csvText1, prodMap, qcMap);

    // Save to cache
    try {
      localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(items));
      localStorage.setItem(STORAGE_TIMESTAMP_KEY, new Date().toISOString());
    } catch (storageErr) {
      console.warn('Cannot save to localStorage:', storageErr);
    }

    return { items, fromLive: true };
  } catch (err: any) {
    console.warn('Live fetch failed, falling back to local cache/bundled data:', err);

    // Check localStorage cache
    const cached = localStorage.getItem(STORAGE_CACHE_KEY);
    if (cached) {
      try {
        let cachedItems = JSON.parse(cached) as DeliveryItem[];
        // Enrich cached items with itemPdMap and re-evaluate QC
        cachedItems = cachedItems.map(item => {
          let prodOrder = item.prodOrder;
          if (!prodOrder && item.itemCode) {
            const projItemKey = `${item.projectCode?.trim()}|${item.itemCode?.trim()}`;
            prodOrder = (itemPdMap.byProjItem as Record<string, string>)[projItemKey] || 
                        (itemPdMap.byItem as Record<string, string>)[item.itemCode?.trim()] || '';
          }
          const itemPds = extractPdNumbers(prodOrder);
          const matchedQcPds = itemPds.filter(p => (defaultQcData as Record<string, QcMeta>)[p]);
          const isQcPassed = item.isQcPassed || matchedQcPds.length > 0;
          const firstQcMeta = matchedQcPds.length > 0 ? (defaultQcData as Record<string, QcMeta>)[matchedQcPds[0]] : undefined;

          const overviewMeta = getOverviewStatusForItem(item.itemCode, item.projectCode, itemPds);
          if (!prodOrder && overviewMeta?.prodOrder) {
            prodOrder = overviewMeta.prodOrder;
          }

          return {
            ...item,
            prodOrder,
            isQcPassed,
            qcDate: item.qcDate || firstQcMeta?.qcDate || '',
            qcInspector: item.qcInspector || firstQcMeta?.inspector || '',
            qcPassedQty: item.qcPassedQty || firstQcMeta?.qtyPass || '',
            qcTopic: item.qcTopic || firstQcMeta?.topic || '',
            qcRemarks: item.qcRemarks || firstQcMeta?.remarks || '',
            qcPdList: matchedQcPds.length > 0 ? matchedQcPds : item.qcPdList,
            overviewStatus: overviewMeta?.status || item.overviewStatus || '',
            overviewCustomer: overviewMeta?.customer || item.overviewCustomer || '',
            overviewProject: overviewMeta?.project || item.overviewProject || '',
            overviewItemCode: overviewMeta?.itemCode || item.overviewItemCode || '',
          };
        });

        return {
          items: cachedItems,
          fromLive: false,
          error: `ใช้ข้อมูลแคชสำรองที่บันทึกไว้ (${err.message})`,
        };
      } catch (parseErr) {
        // Fall through
      }
    }

    // Default bundled data joined with defaultProductionMap and defaultQcData
    const bundledItems = (defaultItemsJson as DeliveryItem[]).map(item => {
      const docNorm = norm(item.docRef);
      const itemNorm = norm(item.itemCode);
      const key = `${docNorm}|${itemNorm}`;
      const prodMeta = (defaultProductionMap.byDocItem as Record<string, ProductionMeta>)[key] ||
                       (defaultProductionMap.byDoc as Record<string, ProductionMeta>)[docNorm];

      let prodOrder = item.prodOrder;
      if (!prodOrder && item.itemCode) {
        const projItemKey = `${item.projectCode?.trim()}|${item.itemCode?.trim()}`;
        prodOrder = (itemPdMap.byProjItem as Record<string, string>)[projItemKey] || 
                    (itemPdMap.byItem as Record<string, string>)[item.itemCode?.trim()] || '';
      }

      const itemPds = extractPdNumbers(prodOrder);
      const matchedQcPds = itemPds.filter(p => (defaultQcData as Record<string, QcMeta>)[p]);
      const isQcPassed = matchedQcPds.length > 0;
      const firstQcMeta = isQcPassed ? (defaultQcData as Record<string, QcMeta>)[matchedQcPds[0]] : undefined;
      const overviewMeta = getOverviewStatusForItem(item.itemCode, item.projectCode, itemPds);
      if (!prodOrder && overviewMeta?.prodOrder) {
        prodOrder = overviewMeta.prodOrder;
      }

      return {
        ...item,
        prodOrder,
        customer: item.customer || extractCustomer(item.projectName),
        actionTopic: prodMeta?.actionTopic || '',
        ncrNo: prodMeta?.ncrNo || '',
        requestDept: prodMeta?.requestDept || '',
        requesterName: prodMeta?.requesterName || '',
        targetRequested: prodMeta?.targetRequested || '',
        week: prodMeta?.week || '',
        isQcPassed,
        qcDate: firstQcMeta?.qcDate || '',
        qcInspector: firstQcMeta?.inspector || '',
        qcPassedQty: firstQcMeta?.qtyPass || '',
        qcTopic: firstQcMeta?.topic || '',
        qcRemarks: firstQcMeta?.remarks || '',
        qcPdList: matchedQcPds,
        overviewStatus: overviewMeta?.status || item.overviewStatus || '',
        overviewCustomer: overviewMeta?.customer || item.overviewCustomer || '',
        overviewProject: overviewMeta?.project || item.overviewProject || '',
        overviewItemCode: overviewMeta?.itemCode || item.overviewItemCode || '',
      };
    });

    return {
      items: bundledItems,
      fromLive: false,
      error: `ใช้ข้อมูลสำรองในระบบ (เชื่อมโยงทั้ง 3 สเปรดชีตเรียบร้อย)`,
    };
  }
}

/**
 * Process raw items and build Machine-Indexed summaries with Production & QC context
 */
export function buildMachineSummaries(items: DeliveryItem[]): MachineSummary[] {
  const machineMap = new Map<string, DeliveryItem[]>();

  for (const item of items) {
    const key = item.machineName || '(ไม่ระบุเครื่องจักร)';
    if (!machineMap.has(key)) {
      machineMap.set(key, []);
    }

    const isOverdue = item.status !== 'ส่งแล้ว' && isDateOverdue(item.targetLatest);
    const isDueSoon = item.status !== 'ส่งแล้ว' && !isOverdue && isDateDueSoon(item.targetLatest, 7);

    let rescheduledCount = 0;
    if (item.target2) rescheduledCount++;
    if (item.target3) rescheduledCount++;
    if (item.target4) rescheduledCount++;
    if (item.target5) rescheduledCount++;

    item.isOverdue = isOverdue;
    item.isDueSoon = isDueSoon;
    item.rescheduledCount = rescheduledCount;
    item.parsedLatestDate = parseDate(item.targetLatest);

    machineMap.get(key)!.push(item);
  }

  const summaries: MachineSummary[] = [];

  for (const [name, machineItems] of machineMap.entries()) {
    const totalItems = machineItems.length;
    let deliveredItems = 0;
    let overdueItems = 0;
    let dueSoonItems = 0;
    let rescheduledItems = 0;
    let qcPassedItems = 0;
    let totalQty = 0;
    let deliveredQty = 0;

    const projectsSet = new Set<string>();
    const projectCodesSet = new Set<string>();
    const prodOrdersSet = new Set<string>();
    const deptsSet = new Set<string>();
    const topicsSet = new Set<string>();

    let earliestDate: Date | null = null;
    let latestDate: Date | null = null;

    for (const item of machineItems) {
      totalQty += item.qty;
      if (item.projectName) projectsSet.add(item.projectName);
      if (item.projectCode) projectCodesSet.add(item.projectCode);
      if (item.prodOrder) prodOrdersSet.add(item.prodOrder);
      if (item.requestDept) deptsSet.add(item.requestDept);
      if (item.actionTopic) topicsSet.add(item.actionTopic);

      if (item.status === 'ส่งแล้ว') {
        deliveredItems++;
        deliveredQty += item.qty;
      } else {
        if (item.isOverdue) overdueItems++;
        else if (item.isDueSoon) dueSoonItems++;
      }

      if ((item.rescheduledCount || 0) > 0) {
        rescheduledItems++;
      }

      if (item.isQcPassed) {
        qcPassedItems++;
      }

      if (item.parsedLatestDate) {
        if (!earliestDate || item.parsedLatestDate < earliestDate) {
          earliestDate = item.parsedLatestDate;
        }
        if (!latestDate || item.parsedLatestDate > latestDate) {
          latestDate = item.parsedLatestDate;
        }
      }
    }

    const pendingItems = totalItems - deliveredItems;
    const progressPercent = totalItems > 0 ? Math.round((deliveredItems / totalItems) * 100) : 0;

    let status: MachineSummary['status'] = 'in-progress';
    if (progressPercent === 100) {
      status = 'completed';
    } else if (overdueItems > 0) {
      status = 'overdue';
    } else if (dueSoonItems > 0) {
      status = 'due-soon';
    }

    summaries.push({
      name,
      hasMachine: name !== '(ไม่ระบุเครื่องจักร)',
      totalItems,
      deliveredItems,
      pendingItems,
      overdueItems,
      dueSoonItems,
      rescheduledItems,
      qcPassedItems,
      totalQty,
      deliveredQty,
      progressPercent,
      projects: Array.from(projectsSet),
      projectCodes: Array.from(projectCodesSet),
      productionOrders: Array.from(prodOrdersSet),
      requestDepts: Array.from(deptsSet),
      actionTopics: Array.from(topicsSet),
      earliestTarget: earliestDate ? earliestDate.toISOString() : null,
      latestTarget: latestDate ? latestDate.toISOString() : null,
      status,
      items: machineItems,
    });
  }

  summaries.sort((a, b) => {
    if (a.name === '(ไม่ระบุเครื่องจักร)') return 1;
    if (b.name === '(ไม่ระบุเครื่องจักร)') return -1;
    if (a.overdueItems > 0 && b.overdueItems === 0) return -1;
    if (b.overdueItems > 0 && a.overdueItems === 0) return 1;
    if (a.progressPercent !== b.progressPercent) return a.progressPercent - b.progressPercent;
    return a.name.localeCompare(b.name);
  });

  return summaries;
}
