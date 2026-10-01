import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import defaultItemsJson from '../data/defaultData.json';
import defaultProjectItemsJson from '../data/defaultProjectItems.json';
import defaultProductionMap from '../data/productionMap.json';
import defaultQcData from '../data/qcData.json';
import defaultOverviewData from '../data/overviewStatusData.json';
import defaultOverviewItemMap from '../data/overviewItemMap.json';
import itemPdMap from '../data/itemPdMap.json';
import { DeliveryItem, MachineSummary, OverviewMeta } from '../types';
import { parseDate, isDateOverdue, isDateDueSoon, extractCustomer } from '../utils/dateUtils';

// Initialize with bundled data, or restore cached live overview if available
let initialOverviewStatusMap = defaultOverviewData as Record<string, OverviewMeta>;
let initialOverviewItemMap = defaultOverviewItemMap as {
  byItem: Record<string, OverviewMeta>;
  byProjItem: Record<string, OverviewMeta>;
};

const STORAGE_OVERVIEW_CACHE_KEY = 'pdtrack_cached_overview_v3';
export const STORAGE_OVERVIEW_FILENAME_KEY = 'pdtrack_overview_filename';
try {
  const cachedOverview = localStorage.getItem(STORAGE_OVERVIEW_CACHE_KEY);
  if (cachedOverview) {
    const parsedCache = JSON.parse(cachedOverview);
    if (parsedCache.byPd && Object.keys(parsedCache.byPd).length > 0) {
      initialOverviewStatusMap = { ...defaultOverviewData, ...parsedCache.byPd };
    }
    if (parsedCache.byItem && parsedCache.byProjItem) {
      initialOverviewItemMap = {
        byItem: { ...defaultOverviewItemMap.byItem, ...parsedCache.byItem },
        byProjItem: { ...defaultOverviewItemMap.byProjItem, ...parsedCache.byProjItem },
      };
    }
  }
} catch (e) {
  // ignore storage error
}

export let overviewStatusMap = initialOverviewStatusMap;
export let overviewItemMap = initialOverviewItemMap;
export const qcStatusMap = defaultQcData as Record<string, QcMeta>;

export const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1l5FbiznQNUhIpUNuma9iivKzYvcaCTiL7Z_9mDcCijE/edit?gid=472754949#gid=472754949';
export const DEFAULT_PRODUCTION_URL = 'https://docs.google.com/spreadsheets/d/1YLgaxdeJR_MCHJhFkoAPAJfGmvUJB2K9GPgirYqlhPE/edit?gid=1308741309#gid=1308741309';
export const DEFAULT_QC_URL = 'https://docs.google.com/spreadsheets/d/1w8B0DyG7PEy_YLHM5HCI_eVU_nt4HvA8xHWShuLRL_8/edit?gid=1814251242#gid=1814251242';
export const DEFAULT_OVERVIEW_URL = '';
export const DEFAULT_OVERVIEW_FOLDER_URL = 'https://drive.google.com/drive/folders/1Yt8drFmq0END9fAEWUy0No6sZ76H1dtA?usp=drive_link';
export const DEFAULT_OVERVIEW_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzLDxqPOnJAC8aRVyr8-_oNLWLdXEbSvJqbGSh-5W-zFVo_cwdVhsQPISjUUF3NSpJJFg/exec';

const STORAGE_URL_KEY = 'pdtrack_sheet_url';
const STORAGE_PROD_URL_KEY = 'pdtrack_prod_sheet_url';
const STORAGE_QC_URL_KEY = 'pdtrack_qc_sheet_url';
const STORAGE_OVERVIEW_URL_KEY = 'pdtrack_overview_sheet_url';
const STORAGE_CACHE_KEY = 'pdtrack_cached_data_v8';
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

export function getSavedOverviewUrl(): string {
  return localStorage.getItem(STORAGE_OVERVIEW_URL_KEY) || DEFAULT_OVERVIEW_URL;
}

export function saveOverviewUrl(url: string): void {
  localStorage.setItem(STORAGE_OVERVIEW_URL_KEY, url.trim());
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
 * Core parser for Status Overview table rows (from CSV, Excel, or Sheet)
 * Matches columns: Production Order, Item Code, Description, Project, Customer, Order Status, Operations
 */
export function parseOverviewRows(rows: (string | null | undefined)[][]): {
  byPd: Record<string, OverviewMeta>;
  byItem: Record<string, OverviewMeta>;
  byProjItem: Record<string, OverviewMeta>;
} {
  if (!rows || rows.length < 2) {
    return { byPd: {}, byItem: {}, byProjItem: {} };
  }

  const headers = (rows[0] || []).map(h => (h !== undefined && h !== null ? String(h) : '').trim().replace(/\n/g, ' '));
  const findCol = (keywords: string[]) => {
    // 1. Exact match first
    const exact = headers.findIndex(h => keywords.some(k => h.toLowerCase() === k.toLowerCase()));
    if (exact !== -1) return exact;
    // 2. Substring match
    return headers.findIndex(h => keywords.some(k => h.toLowerCase().includes(k.toLowerCase())));
  };

  const pdIdx = findCol(['Production Order', 'Prod Order', 'PD No', 'PD No.', 'PD', 'prodOrder']);
  const itemIdx = findCol(['Item_4', 'Item_5', 'Item Code', 'Item No', 'รหัส Item', 'เลขที่ Item', 'itemCode', 'DWG No', 'dwgNo']);
  const descIdx = findCol(['Description', 'Item Name', 'ชื่อ Item', 'รายละเอียด', 'description', 'partName']);
  const projIdx = findCol(['Project', 'Project No', 'เลขที่โครงการ', 'โครงการ', 'projectCode']);
  const custIdx = findCol(['Customer', 'ลูกค้า', 'customer']);
  const statusIdx = findCol(['Order Status', 'Operation Status', 'Status', 'สถานะ', 'status']);
  const opIdx = findCol(['Operation', 'ลำดับ', 'Step']);
  const wcIdx = findCol(['Work Center', 'WorkCenter', 'WC', 'เครื่อง', 'Machine']);
  const opDescIdx = findCol(['r.ref.oper.desc', 'Operation Description', 'ชื่อ Operation', 'ชื่อกระบวนการ', 'Step Name']);
  const opStatusIdx = findCol(['Operation Status', 'สถานะ Operation']);

  const byPd: Record<string, OverviewMeta> = {};
  const byItem: Record<string, OverviewMeta> = {};
  const byProjItem: Record<string, OverviewMeta> = {};

  const priorityOrder: Record<string, number> = {
    'active': 5,
    'ready to start': 4,
    'planned': 3,
    'completed': 2,
    'closed': 2,
    'close': 2,
    'เสร็จแล้ว': 2,
  };

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;

    const getCell = (idx: number) => (idx !== -1 && idx < r.length && r[idx] !== undefined && r[idx] !== null ? String(r[idx]).trim() : '');

    const pdVal = getCell(pdIdx).toUpperCase();
    const itemCode = getCell(itemIdx).toUpperCase();
    const desc = getCell(descIdx);
    const project = getCell(projIdx).toUpperCase();
    const customer = getCell(custIdx);
    const status = getCell(statusIdx);
    const op = getCell(opIdx);
    const wc = getCell(wcIdx);
    const opDesc = getCell(opDescIdx);
    const opStatus = getCell(opStatusIdx);

    if (!pdVal && !itemCode) continue;

    const isReady = opStatus.toLowerCase() === 'ready to start';
    const isActive = opStatus.toLowerCase() === 'active';
    const isCompleted = ['completed', 'close', 'closed', 'เสร็จแล้ว', 'เสร็จสิ้น'].includes(opStatus.toLowerCase()) || ['completed', 'close', 'closed', 'เสร็จแล้ว', 'เสร็จสิ้น'].includes(status.toLowerCase());
    const opLabel = opDesc ? `Op ${op}: ${opDesc}${wc ? ` (${wc})` : ''}` : '';

    const meta: OverviewMeta = {
      status: status || opStatus || '',
      project: project || '',
      customer: customer || '',
      itemCode: itemCode || '',
      description: desc || '',
      prodOrder: pdVal || '',
      readyOp: isReady ? opLabel : undefined,
      readyOpDesc: isReady ? opDesc : undefined,
      readyOpWc: isReady ? wc : undefined,
      readyOpNo: isReady ? op : undefined,
      hasReadyOp: isReady,
      activeOp: isActive ? opLabel : undefined,
      activeOpDesc: isActive ? opDesc : undefined,
      activeOpWc: isActive ? wc : undefined,
      activeOpNo: isActive ? op : undefined,
      currentOp: isReady ? opLabel : isActive ? opLabel : undefined,
      currentOpDesc: isReady ? opDesc : isActive ? opDesc : undefined,
      currentOpStatus: isReady ? 'Ready to Start' : isActive ? 'Active' : undefined,
      lastCompletedOp: isCompleted ? `Op ${op}` : undefined,
      lastCompletedOpDesc: isCompleted ? opDesc : undefined,
      lastCompletedOpWc: isCompleted ? wc : undefined,
      lastCompletedOpNo: isCompleted ? op : undefined,
    };

    const normStatus = (status || opStatus || '').toLowerCase();

    // Helper to merge operation info
    const mergeMeta = (existing: OverviewMeta | undefined, incoming: OverviewMeta): OverviewMeta => {
      if (!existing) return incoming;
      const higherPriority = (priorityOrder[normStatus] || 0) > (priorityOrder[(existing.status || '').toLowerCase()] || 0);
      return {
        ...existing,
        status: higherPriority ? incoming.status : existing.status,
        project: incoming.project || existing.project,
        customer: incoming.customer || existing.customer,
        itemCode: incoming.itemCode || existing.itemCode,
        description: incoming.description || existing.description,
        prodOrder: incoming.prodOrder || existing.prodOrder,
        readyOp: incoming.readyOp || existing.readyOp,
        readyOpDesc: incoming.readyOpDesc || existing.readyOpDesc,
        readyOpWc: incoming.readyOpWc || existing.readyOpWc,
        readyOpNo: incoming.readyOpNo || existing.readyOpNo,
        hasReadyOp: Boolean(incoming.readyOp || existing.readyOp),
        activeOp: incoming.activeOp || existing.activeOp,
        activeOpDesc: incoming.activeOpDesc || existing.activeOpDesc,
        activeOpWc: incoming.activeOpWc || existing.activeOpWc,
        activeOpNo: incoming.activeOpNo || existing.activeOpNo,
        currentOp: incoming.readyOp || existing.readyOp || incoming.activeOp || existing.activeOp || existing.currentOp,
        currentOpDesc: incoming.readyOpDesc || existing.readyOpDesc || incoming.activeOpDesc || existing.activeOpDesc || existing.currentOpDesc,
        currentOpStatus: incoming.readyOp || existing.readyOp ? 'Ready to Start' : incoming.activeOp || existing.activeOp ? 'Active' : existing.currentOpStatus,
        lastCompletedOp: incoming.lastCompletedOp || existing.lastCompletedOp,
        lastCompletedOpDesc: incoming.lastCompletedOpDesc || existing.lastCompletedOpDesc,
        lastCompletedOpWc: incoming.lastCompletedOpWc || existing.lastCompletedOpWc,
        lastCompletedOpNo: incoming.lastCompletedOpNo || existing.lastCompletedOpNo,
        isAllCompleted: incoming.isAllCompleted ?? existing.isAllCompleted,
      };
    };

    // Index by PD
    if (pdVal) {
      byPd[pdVal] = mergeMeta(byPd[pdVal], meta);
    }

    // Index by Item Code
    if (itemCode) {
      byItem[itemCode] = mergeMeta(byItem[itemCode], meta);
      if (project) {
        const projKey = `${project}|${itemCode}`;
        byProjItem[projKey] = mergeMeta(byProjItem[projKey], meta);
      }
    }
  }

  return { byPd, byItem, byProjItem };
}

/**
 * Parses raw CSV of Google Sheet 4 (Status Overview ฝ่ายผลิต)
 */
export function parseOverviewCsv(csvText: string): {
  byPd: Record<string, OverviewMeta>;
  byItem: Record<string, OverviewMeta>;
  byProjItem: Record<string, OverviewMeta>;
} {
  const parsed = Papa.parse<string[]>(csvText, { skipEmptyLines: true });
  return parseOverviewRows(parsed.data);
}

/**
 * Parses binary Excel file (.xlsx / .xls) of Status Overview
 * Supports 'Data', 'data', or any sheet containing production orders
 */
export function parseOverviewExcel(buffer: ArrayBuffer): {
  byPd: Record<string, OverviewMeta>;
  byItem: Record<string, OverviewMeta>;
  byProjItem: Record<string, OverviewMeta>;
} {
  const wb = XLSX.read(buffer, { type: 'array' });
  let ws = wb.Sheets['Data'] || wb.Sheets['data'];
  if (!ws) {
    const matched = wb.SheetNames.find(n => n.trim().toLowerCase().includes('data'));
    ws = matched ? wb.Sheets[matched] : wb.Sheets[wb.SheetNames[0]];
  }
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });
  return parseOverviewRows(rows);
}

/**
 * Parses JSON from Plan.json (Google Drive / Apps Script) or cached overview
 */
export function parseOverviewJson(jsonObj: any): {
  byPd: Record<string, OverviewMeta>;
  byItem: Record<string, OverviewMeta>;
  byProjItem: Record<string, OverviewMeta>;
} {
  if (jsonObj?.byPd && jsonObj?.byItem) {
    return {
      byPd: jsonObj.byPd || {},
      byItem: jsonObj.byItem || {},
      byProjItem: jsonObj.byProjItem || {},
    };
  }

  const byPd: Record<string, OverviewMeta> = {};
  const byItem: Record<string, OverviewMeta> = {};
  const byProjItem: Record<string, OverviewMeta> = {};

  const jobs: any[] = jsonObj?.scheduledJobs || jsonObj?.data?.scheduledJobs || [];
  for (const job of jobs) {
    const pdVal = String(job.woId || job.prodOrder || '').trim().toUpperCase();
    const itemCode = String(job.dwgNo || job.itemCode || '').trim().toUpperCase();
    const project = String(job.project || '').trim().toUpperCase();
    const customer = String(job.customer || '').trim();
    const status = String(job.status || job.opStatus || '').trim();
    const op = job.stepNum || job.stepNo || '';
    const opDesc = job.stepName || '';
    const wc = job.machine || '';
    const opLabel = opDesc ? `Op ${op}: ${opDesc}${wc ? ` (${wc})` : ''}` : '';
    const isReady = status.toLowerCase() === 'ready to start';
    const isActive = status.toLowerCase() === 'active';
    const isCompleted =
      ['completed', 'close', 'closed', 'เสร็จแล้ว', 'เสร็จสิ้น'].includes(status.toLowerCase()) ||
      Boolean(job.erpCompleted);

    const meta: OverviewMeta = {
      status: isCompleted ? 'Completed' : (status || ''),
      project,
      customer,
      itemCode,
      description: job.partName || '',
      prodOrder: pdVal,
      readyOp: isReady ? opLabel : undefined,
      readyOpDesc: isReady ? opDesc : undefined,
      readyOpWc: isReady ? wc : undefined,
      readyOpNo: isReady ? op : undefined,
      hasReadyOp: isReady,
      activeOp: isActive ? opLabel : undefined,
      activeOpDesc: isActive ? opDesc : undefined,
      activeOpWc: isActive ? wc : undefined,
      activeOpNo: isActive ? op : undefined,
      currentOp: isReady || isActive ? opLabel : undefined,
      currentOpDesc: isReady || isActive ? opDesc : undefined,
      currentOpStatus: isReady ? 'Ready to Start' : isActive ? 'Active' : undefined,
      lastCompletedOp: isCompleted ? `Op ${op}` : undefined,
      lastCompletedOpDesc: isCompleted ? opDesc : undefined,
      lastCompletedOpWc: isCompleted ? wc : undefined,
      lastCompletedOpNo: isCompleted ? op : undefined,
      isAllCompleted: isCompleted,
    };

    if (pdVal) byPd[pdVal] = meta;
    if (itemCode) {
      byItem[itemCode] = meta;
      if (project) byProjItem[`${project}|${itemCode}`] = meta;
    }
  }

  return { byPd, byItem, byProjItem };
}

/**
 * Gets saved name of the active overview file
 */
export function getSavedOverviewFilename(): string {
  return localStorage.getItem(STORAGE_OVERVIEW_FILENAME_KEY) || 'Week 40 26-09-30 Status Overview.xlsx (Google Drive)';
}

/**
 * Saves overview data to memory and persistent localStorage
 */
export function saveActiveOverviewData(
  overviewData: { byPd: Record<string, OverviewMeta>; byItem: Record<string, OverviewMeta>; byProjItem: Record<string, OverviewMeta> },
  fileName: string
): void {
  overviewStatusMap = { ...defaultOverviewData, ...overviewData.byPd };
  overviewItemMap = {
    byItem: { ...defaultOverviewItemMap.byItem, ...overviewData.byItem },
    byProjItem: { ...defaultOverviewItemMap.byProjItem, ...overviewData.byProjItem },
  };
  try {
    localStorage.setItem(STORAGE_OVERVIEW_CACHE_KEY, JSON.stringify(overviewData));
    localStorage.setItem(STORAGE_OVERVIEW_FILENAME_KEY, fileName);
  } catch (err) {
    console.warn('Could not save overview data to localStorage:', err);
  }
}

/**
 * Fetches latest overview data directly from the Google Drive Apps Script endpoint
 */
export async function fetchOverviewFromAppsScript(
  endpointUrl: string = DEFAULT_OVERVIEW_APPS_SCRIPT_URL
): Promise<{
  byPd: Record<string, OverviewMeta>;
  byItem: Record<string, OverviewMeta>;
  byProjItem: Record<string, OverviewMeta>;
  fileName: string;
}> {
  const res = await fetch(endpointUrl, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`ไม่สามารถเชื่อมต่อ Google Apps Script (${res.status} ${res.statusText})`);
  }
  const data = await res.json();
  const parsed = parseOverviewJson(data);
  const fileName = data.fileName || 'Plan.json (Google Drive Folder)';
  return { ...parsed, fileName };
}

/**
 * Helper to check if an Overview status represents Completed or Closed
 * (เช่น 'Completed', 'Closed', 'Close', 'เสร็จแล้ว')
 */
export function isOverviewCompletedOrClosed(status?: string): boolean {
  if (!status) return false;
  const s = status.trim().toLowerCase();
  return (
    s === 'completed' ||
    s === 'closed' ||
    s === 'close' ||
    s === 'เสร็จแล้ว' ||
    s === 'เสร็จสิ้น' ||
    s === 'finished' ||
    s === 'done'
  );
}

/**
 * Look up Overview Status from the Overview Status Map for any given PD numbers
 * If all matched PDs are Completed or Closed ("complete หรือ close หมด"), mark as 'Closed' / 'เสร็จแล้ว'.
 * Otherwise, prioritize in-progress status (Active > Ready to Start > Planned).
 */
export function getOverviewStatusForPds(pds: string[]): OverviewMeta | undefined {
  if (!pds || pds.length === 0) return undefined;

  const matchedMetas: OverviewMeta[] = [];
  for (const p of pds) {
    const clean = p.toUpperCase().trim();
    const meta = overviewStatusMap[clean];
    if (meta) matchedMetas.push(meta);
  }

  if (matchedMetas.length === 0) return undefined;
  if (matchedMetas.length === 1) return matchedMetas[0];

  // If ALL matched PDs are Completed or Closed ("complete หรือ close หมด")
  const allFinished = matchedMetas.every(m => isOverviewCompletedOrClosed(m.status));
  if (allFinished) {
    return {
      ...matchedMetas[0],
      status: 'Closed',
      currentOp: matchedMetas[0].currentOp || 'เสร็จทุกขั้นตอน',
      currentOpDesc: matchedMetas[0].currentOpDesc || 'Completed',
      currentOpStatus: 'Completed',
    };
  }

  // If not all finished, prioritize in-progress operations
  const inProgress = matchedMetas.filter(m => !isOverviewCompletedOrClosed(m.status));
  const activeMeta = inProgress.find(m => m.status?.toLowerCase() === 'active' || m.currentOpStatus === 'Active');
  if (activeMeta) return activeMeta;

  const readyMeta = inProgress.find(m => m.status?.toLowerCase() === 'ready to start' || m.currentOpStatus === 'Ready to Start');
  if (readyMeta) return readyMeta;

  const plannedMeta = inProgress.find(m => m.status?.toLowerCase() === 'planned');
  if (plannedMeta) return plannedMeta;

  return inProgress[0] || matchedMetas[0];
}

/**
 * Look up Overview Status prioritized by specific PD Number(s) when available.
 * If specific PDs are provided, we check them directly and do NOT inherit another PD's status
 * (since the same Item Code can be used across multiple machines and production orders).
 * Only when NO PD is specified on the item, we fall back to Project Code + Item Code / Item Code lookup.
 */
export function getOverviewStatusForItem(
  itemCode?: string,
  projectCode?: string,
  pds?: string[]
): OverviewMeta | undefined {
  const cleanCode = itemCode?.trim().toUpperCase();
  const cleanProj = projectCode?.trim().toUpperCase();

  // 1. Primary: If specific PDs are given, inspect ONLY those PDs.
  // We MUST NOT fall back to item code / project matching when PDs are provided,
  // because multiple machines or orders share the same blueprint (Item Code),
  // and borrowing another PD's progress would report false machine statuses.
  if (pds && pds.length > 0) {
    return getOverviewStatusForPds(pds);
  }

  // 2. Only if the item has NO PD specified (e.g. blank prodOrder in delivery sheet),
  // look up by Project Code + Item Code:
  if (cleanProj && cleanCode) {
    const projKey = `${cleanProj}|${cleanCode}`;
    const meta = overviewItemMap.byProjItem[projKey];
    if (meta) return meta;
  }

  // 3. Secondary fallback: match by Item Code directly (only when NO PD is specified)
  if (cleanCode) {
    const meta = overviewItemMap.byItem[cleanCode];
    if (meta) return meta;
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
  const closedIdx = findCol(['Closed', 'closed', 'ปิดงาน', 'ปิด', 'close']);

  // 🔍 Debug: แสดง header จริงจาก Sheet และ index ที่ detect ได้ — เปิด DevTools Console เพื่อดู
  console.log('[PDTrack] Sheet1 Headers:', headers);
  console.log('[PDTrack] closedIdx:', closedIdx, '| statusIdx:', statusIdx, '| remarkIdx:', remarkIdx);

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
    const closed = closedIdx !== -1 ? getVal(closedIdx) : '';

    const machineName = rawMachine || '(ไม่ระบุเครื่องจักร)';
    const targetLatest = rawTargetLatest || target5 || target4 || target3 || target2 || target1;

    let qty = 1;
    if (qtyStr) {
      const parsedQty = parseFloat(qtyStr.replace(/,/g, ''));
      if (!isNaN(parsedQty)) qty = parsedQty;
    }

    const normRemark = remark.toLowerCase();
    const normClosed = closed.toLowerCase();
    const normRawStatus = rawStatus.toLowerCase();

    // กฎ: ถ้าสถานะระบุส่งแล้ว หรือในหมายเหตุ/Closed มีเครื่องหมาย * หรือคำว่า close แสดงว่าส่งงานแล้ว
    const isDelivered = 
      normRawStatus.includes('ส่ง') || 
      normRawStatus.includes('deliv') ||
      normRemark.includes('*') ||
      normRemark.includes('close') ||
      normClosed.includes('*') ||
      normClosed.includes('close');

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
      workTag: 'Service',
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
      // Joined Operation metadata
      readyOp: overviewMeta?.readyOp || '',
      readyOpDesc: overviewMeta?.readyOpDesc || '',
      readyOpWc: overviewMeta?.readyOpWc || '',
      readyOpNo: overviewMeta?.readyOpNo || undefined,
      hasReadyOp: Boolean(overviewMeta?.readyOp),
      activeOp: overviewMeta?.activeOp || '',
      activeOpDesc: overviewMeta?.activeOpDesc || '',
      activeOpWc: overviewMeta?.activeOpWc || '',
      activeOpNo: overviewMeta?.activeOpNo || undefined,
      currentOp: overviewMeta?.currentOp || '',
      currentOpDesc: overviewMeta?.currentOpDesc || '',
      currentOpStatus: overviewMeta?.currentOpStatus || '',
      lastCompletedOp: overviewMeta?.lastCompletedOp || '',
      lastCompletedOpDesc: overviewMeta?.lastCompletedOpDesc || '',
      lastCompletedOpWc: overviewMeta?.lastCompletedOpWc || '',
      lastCompletedOpNo: overviewMeta?.lastCompletedOpNo || undefined,
      isAllCompleted: overviewMeta?.isAllCompleted || false,
    });
  }

  return items;
}

/**
 * Parses Project items ("สั่งผลิตเครื่องจักรตาม Machine List") from File 2 (Record รับ - จ่าย Production)
 * and tags them with workTag: 'Project'
 */
export function parseProjectItemsFromProductionCsv(
  csvText: string,
  existingServiceItems: DeliveryItem[],
  qcMap?: Record<string, QcMeta>
): DeliveryItem[] {
  const parsed = Papa.parse<string[]>(csvText, { skipEmptyLines: true });
  const rows = parsed.data;
  if (!rows || rows.length < 3) return [];

  const existingServiceKeys = new Set<string>();
  existingServiceItems.forEach(item => {
    existingServiceKeys.add(`${norm(item.docRef)}|${norm(item.machineName)}|${norm(item.itemCode)}`);
  });

  const projectItems: DeliveryItem[] = [];
  let projIdx = 0;

  // Detect Closed column from header row (row index 1) of Sheet 2
  const sheet2Headers = (rows[1] || []).map((h: string) => (h || '').trim().replace(/\n/g, ' '));
  const findSheet2Col = (keywords: string[]) =>
    sheet2Headers.findIndex((h: string) => keywords.some(k => h.toLowerCase().includes(k.toLowerCase())));
  const sheet2ClosedIdx = findSheet2Col(['Closed', 'closed', 'close', 'ปิดงาน', 'ปิด']);
  const sheet2RemarkIdx = findSheet2Col(['หมายเหตุ', 'Remark', 'Note']);
  console.log('[PDTrack] Sheet2 Headers (row1):', sheet2Headers);
  console.log('[PDTrack] Sheet2 closedIdx:', sheet2ClosedIdx, '| remarkIdx:', sheet2RemarkIdx);

  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 10) continue;

    const getVal = (idx: number) => (idx >= 0 && idx < r.length && r[idx] ? r[idx].trim() : '');

    const actionTopic = getVal(1);
    if (actionTopic !== 'สั่งผลิตเครื่องจักรตาม Machine List') continue;

    const rawDwgStatus = getVal(25);
    if (rawDwgStatus.includes('ยกเลิกผลิต') || rawDwgStatus.includes('ไม่สั่งผลิต')) continue;

    const docRef = getVal(0);
    const ncrNo = getVal(2);
    const projectCode = getVal(3);
    const projectName = getVal(4);
    const docType = getVal(5) || 'งานโครงการ';
    const rawMachine = getVal(6);
    const itemCode = getVal(7);
    const itemName = getVal(8);
    const qtyStr = getVal(9);
    let prodOrder = getVal(10);
    const pdActLine = getVal(11);
    const notifyDate = getVal(12);
    const week = getVal(13);
    const targetRequested = getVal(14);
    const requestDept = getVal(15);
    const requesterName = getVal(16);
    const target1 = getVal(17);
    const target2 = getVal(18);
    const target3 = getVal(19);
    const target4 = getVal(20);
    const target5 = getVal(21);
    let rawTargetLatest = getVal(22);
    const poPr = getVal(23);
    const remark = sheet2RemarkIdx !== -1 ? getVal(sheet2RemarkIdx) : getVal(24);
    const closed = sheet2ClosedIdx !== -1 ? getVal(sheet2ClosedIdx) : getVal(26);

    const machineName = rawMachine || '(ไม่ระบุเครื่องจักร)';
    const dedupKey = `${norm(docRef)}|${norm(machineName)}|${norm(itemCode)}`;
    if (existingServiceKeys.has(dedupKey)) continue;

    // Clean fake formula default date in Sheet 2 (30/12/2025 or 31/12/2025 when target1..5 are all empty)
    const hasAnyTarget1To5 = Boolean(target1 || target2 || target3 || target4 || target5);
    if (
      !hasAnyTarget1To5 &&
      (rawTargetLatest === '30/12/2025' || rawTargetLatest === '31/12/2025' || rawTargetLatest === '30/12/1899')
    ) {
      rawTargetLatest = '';
    }

    const targetLatest = rawTargetLatest || target5 || target4 || target3 || target2 || target1 || targetRequested;

    let qty = 1;
    if (qtyStr) {
      const parsedQty = parseFloat(qtyStr.replace(/,/g, ''));
      if (!isNaN(parsedQty)) qty = parsedQty;
    }

    if (!prodOrder && itemCode) {
      const projItemKey = `${projectCode.trim()}|${itemCode.trim()}`;
      prodOrder =
        (itemPdMap.byProjItem as Record<string, string>)[projItemKey] ||
        (itemPdMap.byItem as Record<string, string>)[itemCode.trim()] ||
        '';
    }

    const itemPds = extractPdNumbers(prodOrder);
    const matchedQcPds = qcMap ? itemPds.filter(p => qcMap[p]) : [];
    const isQcPassed = matchedQcPds.length > 0;
    const firstQcMeta = isQcPassed && qcMap ? qcMap[matchedQcPds[0]] : undefined;

    const overviewMeta = getOverviewStatusForItem(itemCode, projectCode, itemPds);
    if (!prodOrder && overviewMeta?.prodOrder) {
      prodOrder = overviewMeta.prodOrder;
    }

    const normRemark = remark.toLowerCase();
    const normClosed = closed.toLowerCase();
    const isDelivered =
      normRemark.includes('ส่งแล้ว') ||
      normRemark.includes('จัดส่งแล้ว') ||
      normRemark.includes('*') ||
      normRemark.includes('close') ||
      normClosed.includes('*') ||
      normClosed.includes('close');

    projIdx++;
    projectItems.push({
      id: `proj-item-${projIdx}`,
      workTag: 'Project',
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
      rawStatus: rawDwgStatus,
      closed,
      actionTopic,
      ncrNo,
      requestDept,
      requesterName,
      targetRequested,
      week,
      isQcPassed,
      qcDate: firstQcMeta?.qcDate || '',
      qcInspector: firstQcMeta?.inspector || '',
      qcPassedQty: firstQcMeta?.qtyPass || '',
      qcTopic: firstQcMeta?.topic || '',
      qcRemarks: firstQcMeta?.remarks || '',
      qcPdList: matchedQcPds,
      overviewStatus: overviewMeta?.status || '',
      overviewCustomer: overviewMeta?.customer || '',
      overviewProject: overviewMeta?.project || '',
      overviewItemCode: overviewMeta?.itemCode || '',
      readyOp: overviewMeta?.readyOp || '',
      readyOpDesc: overviewMeta?.readyOpDesc || '',
      readyOpWc: overviewMeta?.readyOpWc || '',
      readyOpNo: overviewMeta?.readyOpNo || undefined,
      hasReadyOp: Boolean(overviewMeta?.readyOp),
      activeOp: overviewMeta?.activeOp || '',
      activeOpDesc: overviewMeta?.activeOpDesc || '',
      activeOpWc: overviewMeta?.activeOpWc || '',
      activeOpNo: overviewMeta?.activeOpNo || undefined,
      currentOp: overviewMeta?.currentOp || '',
      currentOpDesc: overviewMeta?.currentOpDesc || '',
      currentOpStatus: overviewMeta?.currentOpStatus || '',
      lastCompletedOp: overviewMeta?.lastCompletedOp || '',
      lastCompletedOpDesc: overviewMeta?.lastCompletedOpDesc || '',
      lastCompletedOpWc: overviewMeta?.lastCompletedOpWc || '',
      lastCompletedOpNo: overviewMeta?.lastCompletedOpNo || undefined,
      isAllCompleted: overviewMeta?.isAllCompleted || false,
    });
  }

  return projectItems;
}

/**
 * Helper to enrich a bundled item (Service or Project) with Production, QC, and Overview maps
 */
function enrichBundledItem(item: DeliveryItem, defaultTag: 'Service' | 'Project'): DeliveryItem {
  const docNorm = norm(item.docRef);
  const itemNorm = norm(item.itemCode);
  const key = `${docNorm}|${itemNorm}`;
  const prodMeta =
    (defaultProductionMap.byDocItem as Record<string, ProductionMeta>)[key] ||
    (defaultProductionMap.byDoc as Record<string, ProductionMeta>)[docNorm];

  let prodOrder = item.prodOrder;
  if (!prodOrder && item.itemCode) {
    const projItemKey = `${item.projectCode?.trim()}|${item.itemCode?.trim()}`;
    prodOrder =
      (itemPdMap.byProjItem as Record<string, string>)[projItemKey] ||
      (itemPdMap.byItem as Record<string, string>)[item.itemCode?.trim()] ||
      '';
  }

  const itemPds = extractPdNumbers(prodOrder);
  const matchedQcPds = itemPds.filter(p => (defaultQcData as Record<string, QcMeta>)[p]);
  const isQcPassed = Boolean(item.isQcPassed || matchedQcPds.length > 0);
  const firstQcMeta = matchedQcPds.length > 0 ? (defaultQcData as Record<string, QcMeta>)[matchedQcPds[0]] : undefined;
  const overviewMeta = getOverviewStatusForItem(item.itemCode, item.projectCode, itemPds);
  if (!prodOrder && overviewMeta?.prodOrder) {
    prodOrder = overviewMeta.prodOrder;
  }
  const normRemark = (item.remark || '').toLowerCase();
  const normClosed = (item.closed || '').toLowerCase();
  const normRawStatus = (item.rawStatus || '').toLowerCase();
  const isDelivered =
    item.status === 'ส่งแล้ว' ||
    normRawStatus.includes('ส่ง') ||
    normRawStatus.includes('deliv') ||
    normRemark.includes('*') ||
    normRemark.includes('close') ||
    normClosed.includes('*') ||
    normClosed.includes('close');

  return {
    ...item,
    workTag: item.workTag || defaultTag,
    status: (isDelivered ? 'ส่งแล้ว' : 'รอดำเนินการ') as 'ส่งแล้ว' | 'รอดำเนินการ',
    prodOrder,
    customer: item.customer || extractCustomer(item.projectName),
    actionTopic: item.actionTopic || prodMeta?.actionTopic || '',
    ncrNo: item.ncrNo || prodMeta?.ncrNo || '',
    requestDept: item.requestDept || prodMeta?.requestDept || '',
    requesterName: item.requesterName || prodMeta?.requesterName || '',
    targetRequested: item.targetRequested || prodMeta?.targetRequested || '',
    week: item.week || prodMeta?.week || '',
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
    readyOp: overviewMeta?.readyOp || item.readyOp || '',
    readyOpDesc: overviewMeta?.readyOpDesc || item.readyOpDesc || '',
    readyOpWc: overviewMeta?.readyOpWc || item.readyOpWc || '',
    readyOpNo: overviewMeta?.readyOpNo ?? item.readyOpNo,
    hasReadyOp: Boolean(overviewMeta?.readyOp || item.readyOp),
    activeOp: overviewMeta?.activeOp || item.activeOp || '',
    activeOpDesc: overviewMeta?.activeOpDesc || item.activeOpDesc || '',
    activeOpWc: overviewMeta?.activeOpWc || item.activeOpWc || '',
    activeOpNo: overviewMeta?.activeOpNo ?? item.activeOpNo,
    currentOp: overviewMeta?.currentOp || item.currentOp || '',
    currentOpDesc: overviewMeta?.currentOpDesc || item.currentOpDesc || '',
    currentOpStatus: overviewMeta?.currentOpStatus || item.currentOpStatus || '',
    lastCompletedOp: overviewMeta?.lastCompletedOp || item.lastCompletedOp || '',
    lastCompletedOpDesc: overviewMeta?.lastCompletedOpDesc || item.lastCompletedOpDesc || '',
    lastCompletedOpWc: overviewMeta?.lastCompletedOpWc || item.lastCompletedOpWc || '',
    lastCompletedOpNo: overviewMeta?.lastCompletedOpNo ?? item.lastCompletedOpNo,
    isAllCompleted: overviewMeta?.isAllCompleted ?? item.isAllCompleted ?? false,
  };
}

/**
 * Fetch data connecting up to 4 Google Sheets:
 * 1. Delivery Sheet 1 (Check list ส่งมอบ -> TAG: Service)
 * 2. Production Sheet 2 (Record รับ - จ่าย Production -> Enriches Service & pulls งานโครงการ TAG: Project)
 * 3. QC Sheet 3 (QC Checklist ผ่านการตรวจสอบ)
 * 4. Overview Sheet 4 (Status Overview ฝ่ายผลิต)
 */
export async function fetchDeliveryData(
  customUrl?: string, 
  customProdUrl?: string,
  customQcUrl?: string,
  customOverviewUrl?: string
): Promise<{ items: DeliveryItem[]; fromLive: boolean; error?: string }> {
  const sheetUrl = customUrl || getSavedSheetUrl();
  const prodUrl = customProdUrl || getSavedProdUrl();
  const qcUrl = customQcUrl || getSavedQcUrl();
  const overviewUrl = customOverviewUrl !== undefined ? customOverviewUrl : getSavedOverviewUrl();

  const csvUrl1 = getCsvExportUrl(sheetUrl);
  const csvUrl2 = getCsvExportUrl(prodUrl);
  const csvUrl3 = getCsvExportUrl(qcUrl);
  const hasOverviewUrl = !!(overviewUrl && overviewUrl.trim());
  const csvUrl4 = hasOverviewUrl ? getCsvExportUrl(overviewUrl.trim()) : '';

  try {
    // Fetch all requested sheets in parallel
    const fetchPromises: Promise<Response>[] = [
      fetch(csvUrl1, { method: 'GET', headers: { Accept: 'text/csv,text/plain,*/*' } }),
      fetch(csvUrl2, { method: 'GET', headers: { Accept: 'text/csv,text/plain,*/*' } }),
      fetch(csvUrl3, { method: 'GET', headers: { Accept: 'text/csv,text/plain,*/*' } }),
    ];
    if (csvUrl4) {
      fetchPromises.push(
        fetch(csvUrl4, { method: 'GET', headers: { Accept: 'text/csv,text/plain,*/*' } })
      );
    }

    const [res1, res2, res3, res4] = await Promise.allSettled(fetchPromises);

    if (res1.status !== 'fulfilled' || !res1.value.ok) {
      throw new Error('ไม่สามารถดึงข้อมูลจาก Google Sheet 1 (Check list ส่งมอบ) ได้');
    }

    const csvText1 = await res1.value.text();

    // Production Sheet 2 map & raw text
    let prodMap = defaultProductionMap as { byDocItem: Record<string, ProductionMeta>; byDoc: Record<string, ProductionMeta> };
    let liveCsvText2 = '';
    if (res2.status === 'fulfilled' && res2.value.ok) {
      try {
        liveCsvText2 = await res2.value.text();
        const liveProdMap = parseProductionCsv(liveCsvText2);
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

    // Overview Sheet 4 map
    if (res4 && res4.status === 'fulfilled' && res4.value.ok) {
      try {
        const csvText4 = await res4.value.text();
        const liveOverview = parseOverviewCsv(csvText4);
        if (Object.keys(liveOverview.byPd).length > 0 || Object.keys(liveOverview.byItem).length > 0) {
          overviewStatusMap = { ...defaultOverviewData, ...liveOverview.byPd };
          overviewItemMap = {
            byItem: { ...defaultOverviewItemMap.byItem, ...liveOverview.byItem },
            byProjItem: { ...defaultOverviewItemMap.byProjItem, ...liveOverview.byProjItem },
          };
          try {
            localStorage.setItem(STORAGE_OVERVIEW_CACHE_KEY, JSON.stringify(liveOverview));
          } catch (storageErr) {
            console.warn('Cannot save live overview to localStorage:', storageErr);
          }
        }
      } catch (overviewErr) {
        console.warn('Could not parse live Overview Sheet, using bundled overview data:', overviewErr);
      }
    }

    // 1. Parse Service items from Sheet 1 (Check list ส่งมอบ)
    const serviceItems = parseDeliveryCsvWithProduction(csvText1, prodMap, qcMap);

    // 2. Parse Project items ("สั่งผลิตเครื่องจักรตาม Machine List") from Sheet 2 (Record รับ - จ่าย Production)
    let projectItems: DeliveryItem[] = [];
    if (liveCsvText2) {
      projectItems = parseProjectItemsFromProductionCsv(liveCsvText2, serviceItems, qcMap);
    } else {
      // Sheet 2 ไม่สามารถโหลดได้ (เช่น 401) — ใช้ project items จาก v8 cache ก่อน
      // เพื่อไม่ให้สถานะ Closed ถูก reset เป็นค่าเก่าจาก bundled default
      const cachedRaw = localStorage.getItem(STORAGE_CACHE_KEY);
      if (cachedRaw) {
        try {
          const cachedAll = JSON.parse(cachedRaw) as DeliveryItem[];
          const cachedProj = cachedAll
            .filter(it => it.workTag === 'Project')
            .map(it => enrichBundledItem(it, 'Project'));
          if (cachedProj.length > 0) {
            projectItems = cachedProj;
            console.warn('[PDTrack] Sheet2 fetch failed — using cached project items from localStorage v8');
          } else {
            projectItems = (defaultProjectItemsJson as DeliveryItem[]).map(it => enrichBundledItem(it, 'Project'));
          }
        } catch {
          projectItems = (defaultProjectItemsJson as DeliveryItem[]).map(it => enrichBundledItem(it, 'Project'));
        }
      } else {
        projectItems = (defaultProjectItemsJson as DeliveryItem[]).map(it => enrichBundledItem(it, 'Project'));
      }
    }


    const items = [...serviceItems, ...projectItems];

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
        cachedItems = cachedItems.map(item => enrichBundledItem(item, item.workTag || 'Service'));

        return {
          items: cachedItems,
          fromLive: false,
          error: `ใช้ข้อมูลแคชสำรองที่บันทึกไว้ (${err.message})`,
        };
      } catch (parseErr) {
        // Fall through
      }
    }

    // Default bundled data: combine Service (defaultData.json) + Project (defaultProjectItems.json)
    const bundledServiceItems = (defaultItemsJson as DeliveryItem[]).map(item => enrichBundledItem(item, 'Service'));
    const bundledProjectItems = (defaultProjectItemsJson as DeliveryItem[]).map(item => enrichBundledItem(item, 'Project'));
    const bundledItems = [...bundledServiceItems, ...bundledProjectItems];

    return {
      items: bundledItems,
      fromLive: false,
      error: `ใช้ข้อมูลสำรองในระบบ (เชื่อมโยงทั้งงาน Service และ Project เรียบร้อย)`,
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
    let completedOrQcItems = 0;
    let totalQty = 0;
    let deliveredQty = 0;

    const projectsSet = new Set<string>();
    const projectCodesSet = new Set<string>();
    const prodOrdersSet = new Set<string>();
    const deptsSet = new Set<string>();
    const topicsSet = new Set<string>();
    const workTagsSet = new Set<'Service' | 'Project'>();

    let earliestDate: Date | null = null;
    let latestDate: Date | null = null;

    for (const item of machineItems) {
      totalQty += item.qty;
      if (item.projectName) projectsSet.add(item.projectName);
      if (item.projectCode) projectCodesSet.add(item.projectCode);
      if (item.prodOrder) prodOrdersSet.add(item.prodOrder);
      if (item.requestDept) deptsSet.add(item.requestDept);
      if (item.actionTopic) topicsSet.add(item.actionTopic);
      workTagsSet.add(item.workTag || 'Service');

      const isDelivered = item.status === 'ส่งแล้ว';
      const isDoneOrQc = isDelivered || isOverviewCompletedOrClosed(item.overviewStatus) || Boolean(item.isQcPassed);

      if (isDelivered) {
        deliveredItems++;
        deliveredQty += item.qty;
      } else {
        if (item.isOverdue) overdueItems++;
        else if (item.isDueSoon) dueSoonItems++;
      }

      if (isDoneOrQc) {
        completedOrQcItems++;
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
    // ความคืบหน้าคำนวณจาก Item ที่เสร็จแล้ว หรือ ผ่าน QC แล้ว ต่อ รายการ PD ทั้งหมด
    const progressPercent = totalItems > 0 ? Math.round((completedOrQcItems / totalItems) * 100) : 0;

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
      completedOrQcItems,
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
      workTags: Array.from(workTagsSet),
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

