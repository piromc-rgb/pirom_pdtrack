import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import defaultItemsJson from '../data/defaultData.json';
import defaultProjectItemsJson from '../data/defaultProjectItems.json';
import defaultServicePurchaseJson from '../data/defaultServicePurchaseItems.json';
import defaultProductionMap from '../data/productionMap.json';
import defaultQcData from '../data/qcData.json';
import defaultOverviewData from '../data/overviewStatusData.json';
import defaultOverviewItemMap from '../data/overviewItemMap.json';
import itemPdMap from '../data/itemPdMap.json';
import defaultPoPendingJson from '../data/poPending.json';
import { DeliveryItem, MachineSummary, OverviewMeta, WorkTag, ItemOverride } from '../types';
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
export const DEFAULT_SERVICE_PURCHASE_URL = 'https://docs.google.com/spreadsheets/d/1YLgaxdeJR_MCHJhFkoAPAJfGmvUJB2K9GPgirYqlhPE/edit?gid=1833136006#gid=1833136006';
export const DEFAULT_QC_URL = 'https://docs.google.com/spreadsheets/d/1w8B0DyG7PEy_YLHM5HCI_eVU_nt4HvA8xHWShuLRL_8/edit?gid=1814251242#gid=1814251242';
export const DEFAULT_OVERVIEW_URL = '';
export const DEFAULT_OVERVIEW_FOLDER_URL = 'https://drive.google.com/drive/folders/1Yt8drFmq0END9fAEWUy0No6sZ76H1dtA?usp=drive_link';
export const DEFAULT_OVERVIEW_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzLDxqPOnJAC8aRVyr8-_oNLWLdXEbSvJqbGSh-5W-zFVo_cwdVhsQPISjUUF3NSpJJFg/exec';

const STORAGE_URL_KEY = 'pdtrack_sheet_url';
const STORAGE_PROD_URL_KEY = 'pdtrack_prod_sheet_url';
const STORAGE_SERVICE_PURCHASE_URL_KEY = 'pdtrack_service_purchase_url';
const STORAGE_QC_URL_KEY = 'pdtrack_qc_sheet_url';
const STORAGE_OVERVIEW_URL_KEY = 'pdtrack_overview_sheet_url';
const STORAGE_CACHE_KEY = 'pdtrack_cached_data_v10';
const STORAGE_TIMESTAMP_KEY = 'pdtrack_last_sync';

export interface ProductionMeta {
  actionTopic: string;
  ncrNo: string;
  week: string;
  targetRequested: string;
  requestDept: string;
  requesterName: string;
  remark?: string;
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

export function getXlsxExportUrl(url: string): string {
  try {
    const sheetIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!sheetIdMatch) return url;
    const sheetId = sheetIdMatch[1];
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
  } catch (err) {
    console.error('Error generating XLSX URL:', err);
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

export function getSavedServicePurchaseUrl(): string {
  return localStorage.getItem(STORAGE_SERVICE_PURCHASE_URL_KEY) || DEFAULT_SERVICE_PURCHASE_URL;
}

export function saveServicePurchaseUrl(url: string): void {
  localStorage.setItem(STORAGE_SERVICE_PURCHASE_URL_KEY, url.trim());
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

// ---------------------------------------------------------------------------
// VIEW / EDIT Mode & Google Sheet Item Updates
// ---------------------------------------------------------------------------
export const STORAGE_ITEM_OVERRIDES_KEY = 'pdtrack_item_overrides_v1';
export const STORAGE_EDIT_PASSWORD_KEY = 'pdtrack_edit_password_v1';
export const STORAGE_UPDATE_APPS_SCRIPT_URL_KEY = 'pdtrack_update_apps_script_url_v1';
export const DEFAULT_EDIT_PASSWORD = '2211';

export function getSavedEditPassword(): string {
  return localStorage.getItem(STORAGE_EDIT_PASSWORD_KEY) || DEFAULT_EDIT_PASSWORD;
}

export function saveEditPassword(pwd: string): void {
  localStorage.setItem(STORAGE_EDIT_PASSWORD_KEY, pwd.trim() || DEFAULT_EDIT_PASSWORD);
}

export function getSavedUpdateAppsScriptUrl(): string {
  return localStorage.getItem(STORAGE_UPDATE_APPS_SCRIPT_URL_KEY) || '';
}

export function saveUpdateAppsScriptUrl(url: string): void {
  localStorage.setItem(STORAGE_UPDATE_APPS_SCRIPT_URL_KEY, url.trim());
}

export function getItemKey(item: Partial<DeliveryItem>): string {
  const tag = item.workTag || 'Service';
  const doc = (item.docRef || '').trim().toLowerCase();
  const machine = (item.machineName || '').trim().toLowerCase();
  const code = (item.itemCode || '').trim().toLowerCase();
  const po = (item.prodOrder || '').trim().toLowerCase();
  return `${tag}|${doc}|${machine}|${code}|${po}`;
}

export function isSameDeliveryItem(a?: Partial<DeliveryItem> | null, b?: Partial<DeliveryItem> | null): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.id && b.id && a.id === b.id) return true;
  const keyA = getItemKey(a);
  const keyB = getItemKey(b);
  if (keyA && keyB && keyA === keyB) return true;
  const norm = (s?: string) => (s || '').trim().toLowerCase();
  if (
    norm(a.docRef) &&
    norm(a.docRef) === norm(b.docRef) &&
    norm(a.itemCode) &&
    norm(a.itemCode) === norm(b.itemCode) &&
    (a.workTag || 'Service') === (b.workTag || 'Service')
  ) {
    return true;
  }
  return false;
}

export function getItemOverrides(): Record<string, ItemOverride> {
  try {
    const raw = localStorage.getItem(STORAGE_ITEM_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveItemOverride(key: string, override: ItemOverride): void {
  try {
    const current = getItemOverrides();
    current[key] = override;
    if (override.itemId) {
      current[override.itemId] = override;
    }
    if (override.itemKey) {
      current[override.itemKey] = override;
    }
    // Secondary core key: workTag + docRef + itemCode
    const parts = (override.itemKey || key).split('|');
    if (parts.length >= 4) {
      const coreKey = `${parts[0]}|${parts[1]}|${parts[3]}`;
      current[coreKey] = override;
    }
    localStorage.setItem(STORAGE_ITEM_OVERRIDES_KEY, JSON.stringify(current));
  } catch (err) {
    console.warn('Could not save item override to localStorage:', err);
  }
}

export function updateCachedItem(updatedItem: DeliveryItem): void {
  try {
    const raw = localStorage.getItem(STORAGE_CACHE_KEY);
    if (!raw) return;
    const items = JSON.parse(raw) as DeliveryItem[];
    const next = items.map(it => {
      if (isSameDeliveryItem(it, updatedItem)) {
        return { ...it, ...updatedItem };
      }
      return it;
    });
    localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('Could not update cached item in localStorage:', err);
  }
}

export function removeItemOverride(key: string): void {
  try {
    const current = getItemOverrides();
    delete current[key];
    localStorage.setItem(STORAGE_ITEM_OVERRIDES_KEY, JSON.stringify(current));
  } catch (err) {
    console.warn('Could not remove item override:', err);
  }
}

export function clearAllOverrides(): void {
  try {
    localStorage.removeItem(STORAGE_ITEM_OVERRIDES_KEY);
  } catch (err) {
    console.warn('Could not clear overrides:', err);
  }
}

export function applyOverridesToItems(items: DeliveryItem[]): DeliveryItem[] {
  const overrides = getItemOverrides();
  if (Object.keys(overrides).length === 0) return items;

  return items.map(item => {
    const key = getItemKey(item);
    const coreKey = `${item.workTag || 'Service'}|${(item.docRef || '').trim().toLowerCase()}|${(item.itemCode || '').trim().toLowerCase()}`;
    const ov = overrides[key] || (item.id ? overrides[item.id] : undefined) || overrides[coreKey];
    if (!ov) return item;

    const target1 = ov.target1 !== undefined ? ov.target1 : item.target1;
    const target2 = ov.target2 !== undefined ? ov.target2 : item.target2;
    const target3 = ov.target3 !== undefined ? ov.target3 : item.target3;
    const target4 = ov.target4 !== undefined ? ov.target4 : item.target4;
    const target5 = ov.target5 !== undefined ? ov.target5 : item.target5;
    const targetLatest = ov.targetLatest !== undefined ? ov.targetLatest : (item.targetLatest || target5 || target4 || target3 || target2 || target1);

    const closed = ov.closed !== undefined ? ov.closed : item.closed;
    const normClosed = (closed || '').toLowerCase();
    const remark = ov.remark !== undefined ? ov.remark : item.remark;
    const normRemark = (remark || '').toLowerCase();
    const normRawStatus = (item.rawStatus || '').toLowerCase();

    // กฎ: ถ้ามีเครื่องหมาย * ใน Closed หรือระบุว่าส่งแล้ว ให้ปรับสถานะเป็น 'ส่งแล้ว'
    const isDelivered =
      ov.status === 'ส่งแล้ว' ||
      normClosed.includes('*') ||
      normClosed.includes('close') ||
      normRemark.includes('*') ||
      normRemark.includes('close') ||
      normRawStatus.includes('ส่ง') ||
      normRawStatus.includes('deliv');

    const status: 'ส่งแล้ว' | 'รอดำเนินการ' = isDelivered ? 'ส่งแล้ว' : 'รอดำเนินการ';

    let rescheduledCount = 0;
    if (target2) rescheduledCount++;
    if (target3) rescheduledCount++;
    if (target4) rescheduledCount++;
    if (target5) rescheduledCount++;

    const isOverdue = status !== 'ส่งแล้ว' && isDateOverdue(targetLatest);
    const isDueSoon = status !== 'ส่งแล้ว' && !isOverdue && isDateDueSoon(targetLatest, 7);

    return {
      ...item,
      target1,
      target2,
      target3,
      target4,
      target5,
      targetLatest,
      closed,
      status,
      remark,
      rescheduledCount,
      isOverdue,
      isDueSoon,
      parsedLatestDate: parseDate(targetLatest),
    };
  });
}

/**
 * Updates an item's target delivery date and/or Closed (*) delivery confirmation status.
 * Updates local cache immediately and sends update to Google Apps Script Web App if configured.
 */
export interface UpdateItemOptions {
  newTargetDate?: string;
  closed?: string;
  status?: 'ส่งแล้ว' | 'รอดำเนินการ';
  remark?: string;
  note?: string;
}

export interface UpdateItemResult {
  success: boolean;
  message: string;
  localOnly?: boolean;
  updatedItem: DeliveryItem;
  syncResult: { synced: boolean; error?: string };
}

/**
 * Updates an item's target delivery date and/or Closed (*) delivery confirmation status.
 * Updates local cache immediately and sends update to Google Apps Script Web App if configured.
 * Accepts either:
 * - updateItemInGoogleSheet(item, changes)
 * - updateItemInGoogleSheet({ item, newTargetDate, ... })
 */
export async function updateItemInGoogleSheet(
  arg1: DeliveryItem | ({ item: DeliveryItem } & UpdateItemOptions),
  arg2?: UpdateItemOptions
): Promise<UpdateItemResult> {
  let item: DeliveryItem;
  let changes: UpdateItemOptions;

  if (arg2 !== undefined) {
    item = arg1 as DeliveryItem;
    changes = arg2 || {};
  } else if ((arg1 as any)?.item) {
    item = (arg1 as any).item;
    changes = (arg1 as any) || {};
  } else {
    item = arg1 as DeliveryItem;
    changes = {};
  }

  const key = getItemKey(item);
  const overrides = getItemOverrides();
  const existingOv = overrides[key] || (item.id ? overrides[item.id] : {}) || {};

  let target1 = existingOv.target1 !== undefined ? existingOv.target1 : item.target1;
  let target2 = existingOv.target2 !== undefined ? existingOv.target2 : item.target2;
  let target3 = existingOv.target3 !== undefined ? existingOv.target3 : item.target3;
  let target4 = existingOv.target4 !== undefined ? existingOv.target4 : item.target4;
  let target5 = existingOv.target5 !== undefined ? existingOv.target5 : item.target5;
  let targetLatest = existingOv.targetLatest !== undefined ? existingOv.targetLatest : item.targetLatest;

  if (target1) target1 = formatCompactDate(target1);
  if (target2) target2 = formatCompactDate(target2);
  if (target3) target3 = formatCompactDate(target3);
  if (target4) target4 = formatCompactDate(target4);
  if (target5) target5 = formatCompactDate(target5);
  let targetSlot = 1;

  if (changes.newTargetDate) {
    const rawDate = changes.newTargetDate.trim();
    const newDate = formatCompactDate(rawDate) || rawDate;
    if (!target1) {
      target1 = newDate;
      targetSlot = 1;
    } else if (!target2 && target1 !== newDate) {
      target2 = newDate;
      targetSlot = 2;
    } else if (!target3 && target2 !== newDate) {
      target3 = newDate;
      targetSlot = 3;
    } else if (!target4 && target3 !== newDate) {
      target4 = newDate;
      targetSlot = 4;
    } else if (target4 !== newDate) {
      target5 = newDate;
      targetSlot = 5;
    }
    targetLatest = newDate;
  }

  const closed = changes.closed !== undefined ? changes.closed : (existingOv.closed !== undefined ? existingOv.closed : item.closed);
  const isNowDelivered = (closed && closed.includes('*')) || changes.status === 'ส่งแล้ว';
  const status: 'ส่งแล้ว' | 'รอดำเนินการ' = isNowDelivered ? 'ส่งแล้ว' : (changes.status || 'รอดำเนินการ');
  const remark = changes.remark !== undefined ? changes.remark : (changes.note !== undefined ? changes.note : (existingOv.remark !== undefined ? existingOv.remark : item.remark));

  const overridePayload: ItemOverride = {
    itemKey: key,
    itemId: item.id,
    target1,
    target2,
    target3,
    target4,
    target5,
    targetLatest,
    closed,
    status,
    remark,
    updatedAt: new Date().toISOString(),
  };

  // 1. Save locally
  saveItemOverride(key, overridePayload);
  if (item.id) {
    saveItemOverride(item.id, overridePayload);
  }

  const daysDiff = getDaysDiff(targetLatest);
  const isOverdue = status !== 'ส่งแล้ว' && (Boolean(daysDiff !== null && daysDiff < 0) || isDateOverdue(targetLatest));
  const isDueSoon = status !== 'ส่งแล้ว' && !isOverdue && isDateDueSoon(targetLatest, 7);

  let rescheduledCount = 0;
  if (target2) rescheduledCount++;
  if (target3) rescheduledCount++;
  if (target4) rescheduledCount++;
  if (target5) rescheduledCount++;

  const updatedItem: DeliveryItem = {
    ...item,
    target1,
    target2,
    target3,
    target4,
    target5,
    targetLatest,
    closed,
    status,
    remark,
    rescheduledCount,
    isOverdue,
    isDueSoon,
    parsedLatestDate: parseDate(targetLatest),
  };

  // Update cached data in localStorage immediately
  updateCachedItem(updatedItem);

  // 2. Send to Google Apps Script Web App if configured
  const appsScriptUrl = getSavedUpdateAppsScriptUrl();
  if (appsScriptUrl && appsScriptUrl.trim()) {
    try {
      const payload = {
        action: 'update',
        workTag: item.workTag || 'Service',
        docRef: item.docRef || '',
        itemCode: item.itemCode || '',
        prodOrder: item.prodOrder || '',
        machineName: item.machineName || '',
        newTargetDate: changes.newTargetDate ? (formatCompactDate(changes.newTargetDate) || changes.newTargetDate) : '',
        targetSlot,
        targetLatest,
        closed,
        status,
        remark: remark || ''
      };

      await fetch(appsScriptUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        mode: 'no-cors'
      });

      return {
        success: true,
        localOnly: false,
        message: 'บันทึกและส่งข้อมูลอัปเดต Google Sheet เรียบร้อยแล้ว',
        updatedItem,
        syncResult: { synced: true }
      };
    } catch (err: any) {
      console.warn('Google Apps Script call failed:', err);
      return {
        success: true,
        localOnly: true,
        message: 'บันทึกในระบบสำเร็จ (Apps Script ขัดข้อง: ' + (err?.message || 'Error') + ')',
        updatedItem,
        syncResult: { synced: false, error: err?.message || 'Apps Script network error' }
      };
    }
  }

  return {
    success: true,
    localOnly: true,
    message: 'บันทึกในระบบเรียบร้อย (แคชในเครื่อง)',
    updatedItem,
    syncResult: { synced: false }
  };
}

export const APPS_SCRIPT_UPDATE_CODE = `/**
 * ============================================================================
 * Google Apps Script สำหรับ AMW PDTrack
 * จัดการ Update วันที่เป้าหมาย และ Confirm ส่งมอบ (Closed *) ลง Google Sheet ต้นฉบับ
 * ============================================================================
 * 
 * วิธีติดตั้ง:
 * 1. เปิด Google Spreadsheet ของคุณ (ไฟล์ Check list ส่งมอบ หรือ Record Production)
 * 2. ไปที่เมนู "ส่วนขยาย" (Extensions) > "Apps Script"
 * 3. วางโค้ดนี้ลงในไฟล์ Code.gs
 * 4. กดปุ่ม "ทำให้ใช้งานได้" (Deploy) > "การทำให้ใช้งานได้รายการใหม่" (New deployment)
 * 5. เลือกประเภท: "เว็บแอปพลิเคชัน" (Web app)
 *    - ดำเนินการในฐานะ: "ฉัน" (Me)
 *    - ผู้ที่มีสิทธิ์เข้าถึง: "ทุกคน" (Anyone)
 * 6. คัดลอก "URL เว็บแอปพลิเคชัน" มาใส่ในช่อง "URL ของ Google Apps Script" ในหน้าต่างตั้งค่าของ PDTrack
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000);
  try {
    var contents = e && e.postData ? e.postData.contents : '';
    var data = contents ? JSON.parse(contents) : {};
    var res = updateSheetItem(data);
    return ContentService.createTextOutput(JSON.stringify(res))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var p = e && e.parameter ? e.parameter : {};
  if (p && p.action === 'update') {
    return ContentService.createTextOutput(JSON.stringify(updateSheetItem(p)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({ status: 'PDTrack Update API Ready' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function updateSheetItem(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // เลือกชีตตาม workTag
  var sheetName = 'Check list ส่งมอบ';
  if (data.workTag === 'Project') {
    sheetName = 'Record รับ - จ่าย Production';
  } else if (data.workTag === 'Service Purchase') {
    sheetName = 'service purchase';
  }
  
  var sheet = ss.getSheetByName(sheetName) || ss.getSheets()[0];
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return { success: false, error: 'ไม่พบข้อมูลในชีต ' + sheetName };

  // ตรวจสอบแถวหัวตาราง (แถว 0 หรือ 1)
  var headerRowIdx = 0;
  if (values[0] && values[0].some(function(c) { return String(c || '').indexOf('Document') !== -1 || String(c || '').indexOf('หัวข้อ') !== -1; })) {
    headerRowIdx = 0;
  } else if (values[1] && values[1].some(function(c) { return String(c || '').indexOf('Document') !== -1 || String(c || '').indexOf('หัวข้อ') !== -1; })) {
    headerRowIdx = 1;
  }
  var headers = values[headerRowIdx].map(function(h) { return String(h || '').trim(); });
  
  function findCol(keywords) {
    for (var i = 0; i < headers.length; i++) {
      for (var k = 0; k < keywords.length; k++) {
        if (headers[i].toLowerCase().indexOf(keywords[k].toLowerCase()) !== -1) return i + 1; // 1-indexed column
      }
    }
    return -1;
  }

  var docCol = findCol(['Document number', 'Doc Ref', 'Reference']);
  var itemCol = findCol(['เลขที่ Item', 'Item Code', 'Item No']);
  var prodCol = findCol(['Production Order', 'Prod Order']);
  var closedCol = findCol(['Closed', 'closed', 'ปิดงาน', 'ปิด']);
  var targetLatestCol = findCol(['เป้าหมายล่าสุด', 'Target Latest']);
  var remarkCol = findCol(['หมายเหตุ', 'Remark']);

  // หาแถวเป้าหมาย
  var targetRow = -1;
  var docClean = String(data.docRef || '').trim().toLowerCase();
  var itemClean = String(data.itemCode || '').trim().toLowerCase();
  var prodClean = String(data.prodOrder || '').trim().toLowerCase();

  for (var r = headerRowIdx + 1; r < values.length; r++) {
    var rowDoc = docCol > 0 ? String(values[r][docCol - 1] || '').trim().toLowerCase() : '';
    var rowItem = itemCol > 0 ? String(values[r][itemCol - 1] || '').trim().toLowerCase() : '';
    var rowProd = prodCol > 0 ? String(values[r][prodCol - 1] || '').trim().toLowerCase() : '';

    var matchDoc = docClean ? (rowDoc === docClean) : true;
    var matchItem = itemClean ? (rowItem === itemClean) : true;
    var matchProd = prodClean ? (rowProd === prodClean) : false;

    if ((matchDoc && matchItem) || (prodClean && matchProd)) {
      targetRow = r + 1; // 1-indexed row in SpreadsheetApp
      break;
    }
  }

  if (targetRow === -1) {
    return { success: false, error: 'ไม่พบรายการในชีต ' + sheetName + ' (Doc: ' + data.docRef + ', Item: ' + data.itemCode + ')' };
  }

  // 1. อัปเดตเป้าหมายส่งมอบ
  if (data.newTargetDate) {
    var slotNum = Number(data.targetSlot) || 1;
    var slotCol = findCol(['เป้าหมายส่งมอบ ' + slotNum, 'เป้าหมาย ' + slotNum]);
    if (slotCol > 0) {
      sheet.getRange(targetRow, slotCol).setValue(data.newTargetDate);
    }
    if (targetLatestCol > 0) {
      sheet.getRange(targetRow, targetLatestCol).setValue(data.newTargetDate);
    }
  }

  // 2. อัปเดต Closed (*)
  if (data.closed !== undefined) {
    if (closedCol > 0) {
      sheet.getRange(targetRow, closedCol).setValue(data.closed);
    }
  }

  // 3. อัปเดตหมายเหตุ (ถ้ามี)
  if (data.remark && remarkCol > 0) {
    sheet.getRange(targetRow, remarkCol).setValue(data.remark);
  }

  return { 
    success: true, 
    row: targetRow, 
    sheet: sheetName,
    message: 'อัปเดตข้อมูลแถวที่ ' + targetRow + ' ในชีต ' + sheetName + ' เรียบร้อยแล้ว'
  };
}
`;

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
  if (!rows || rows.length < 2) {
    return { byDocItem: {}, byDoc: {} };
  }

  // Row 0 is actual headers in Sheet 2 (fallback to row 1 if row 0 doesn't contain headers)
  let headerRowIdx = 0;
  if (rows[0] && rows[0].some(c => (c || '').includes('Document') || (c || '').includes('หัวข้อ'))) {
    headerRowIdx = 0;
  } else if (rows[1] && rows[1].some(c => (c || '').includes('Document') || (c || '').includes('หัวข้อ'))) {
    headerRowIdx = 1;
  }

  const headers = (rows[headerRowIdx] || []).map(h => (h || '').trim().replace(/\n/g, ' '));
  const findCol = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.toLowerCase().includes(k.toLowerCase())));

  const docRefIdx = findCol(['Document number', 'Reference']);
  const topicIdx = findCol(['หัวข้อแจ้งดำเนินการ', 'หัวข้อ']);
  const ncrIdx = findCol(['NCR', 'IPR']);
  const itemCodeIdx = findCol(['เลขที่ Item', 'Item Code']);
  const weekIdx = findCol(['Week']);
  const targetReqIdx = findCol(['เป้าหมายที่ต้องการ']);
  const deptIdx = findCol(['หน่วยงานที่แจ้งดำเนินการ', 'หน่วยงาน']);
  const reqIdx = findCol(['ชื่อผู้แจ้งดำเนินการ', 'ผู้แจ้ง']);
  const remarkIdx = findCol(['หมายเหตุ', 'Remark', 'Note']);

  const byDocItem: Record<string, ProductionMeta> = {};
  const byDoc: Record<string, ProductionMeta> = {};

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;

    const getVal = (idx: number) => (idx >= 0 && idx < r.length && r[idx] ? r[idx].trim() : '');

    const doc = getVal(docRefIdx !== -1 ? docRefIdx : 0);
    const topic = getVal(topicIdx !== -1 ? topicIdx : 1);
    const ncr = getVal(ncrIdx !== -1 ? ncrIdx : 2);
    const itemCode = getVal(itemCodeIdx !== -1 ? itemCodeIdx : 8);
    const week = getVal(weekIdx !== -1 ? weekIdx : 14);
    const targetReq = getVal(targetReqIdx !== -1 ? targetReqIdx : 15);
    const dept = getVal(deptIdx !== -1 ? deptIdx : 16);
    const requester = getVal(reqIdx !== -1 ? reqIdx : 17);
    // Column Z is index 25 (หมายเหตุ)
    const remark = getVal(remarkIdx !== -1 ? remarkIdx : 25);

    const meta: ProductionMeta = {
      actionTopic: topic,
      ncrNo: ncr,
      week,
      targetRequested: targetReq,
      requestDept: dept,
      requesterName: requester,
      remark: remark || undefined,
    };

    const docNorm = norm(doc);
    const itemNorm = norm(itemCode);

    if (docNorm && itemNorm) {
      byDocItem[`${docNorm}|${itemNorm}`] = meta;
    }
    if (docNorm && (dept || requester || topic || remark)) {
      if (!byDoc[docNorm] || (!byDoc[docNorm].remark && remark)) {
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
 * Determines warehouse status from Column N (การดำเนินการ):
 * - เป็น คลัง SEMI    ให้แสดง 'คลัง SEMI'
 * - เป็น คลัง PRD    ให้แสดง 'คลัง PRD'
 * - นอกจากนั้นให้แสดง 'ยังไม่ส่งเข้าคลัง'
 */
export function getQcWarehouseStatus(action: string | undefined | null): 'คลัง SEMI' | 'คลัง PRD' | 'ยังไม่ส่งเข้าคลัง' {
  if (!action) return 'ยังไม่ส่งเข้าคลัง';
  const clean = String(action).trim();
  if (/คลัง\s*SEMI/i.test(clean)) return 'คลัง SEMI';
  if (/คลัง\s*PRD/i.test(clean)) return 'คลัง PRD';
  return 'ยังไม่ส่งเข้าคลัง';
}

/**
 * Given a list of PD numbers, picks the QC metadata that has the latest inspection date (วันที่ตรวจ in Column C).
 * If duplicate PDs or multiple PDs exist, returns the record with the latest date.
 */
export function pickLatestQcMeta(pds: string[], qcMap?: Record<string, QcMeta>): QcMeta | undefined {
  if (!qcMap || !pds || pds.length === 0) return undefined;
  let bestMeta: QcMeta | undefined;
  let bestTime = -Infinity;

  for (const pd of pds) {
    const meta = qcMap[pd.toUpperCase()];
    if (!meta) continue;

    const d = parseDate(meta.qcDate);
    const t = d ? d.getTime() : 0;

    if (!bestMeta || t > bestTime) {
      bestMeta = meta;
      bestTime = t;
    } else if (t === bestTime) {
      const bestWh = getQcWarehouseStatus(bestMeta.action);
      const currWh = getQcWarehouseStatus(meta.action);
      if (currWh !== 'ยังไม่ส่งเข้าคลัง' && bestWh === 'ยังไม่ส่งเข้าคลัง') {
        bestMeta = meta;
      }
    }
  }

  return bestMeta;
}

/**
 * Helper to register or update a PD's QC metadata:
 * Rule: ถ้ารายการ PD ซ้ำกัน ให้แสดงเฉพาะรายการ วันที่ตรวจ ใน column C ที่เป็นวันที่ล่าสุด
 */
function updateQcMapWithLatest(qcMap: Record<string, QcMeta>, pdKey: string, meta: QcMeta) {
  const existing = qcMap[pdKey];
  if (!existing) {
    qcMap[pdKey] = meta;
    return;
  }

  const dNew = parseDate(meta.qcDate);
  const dOld = parseDate(existing.qcDate);
  const tNew = dNew ? dNew.getTime() : 0;
  const tOld = dOld ? dOld.getTime() : 0;

  if (tNew > tOld) {
    qcMap[pdKey] = meta;
  } else if (tNew === tOld) {
    const newWh = getQcWarehouseStatus(meta.action);
    const oldWh = getQcWarehouseStatus(existing.action);
    if (newWh !== 'ยังไม่ส่งเข้าคลัง' && oldWh === 'ยังไม่ส่งเข้าคลัง') {
      qcMap[pdKey] = meta;
    }
  }
}

/**
 * Parses raw ArrayBuffer or Uint8Array of Google Sheet 3 (QC Checklist) as an XLSX workbook across ALL sheets/tabs.
 * Excludes photo/non-data sheets (e.g. names containing 'รูป').
 * Rule: Column N (การดำเนินการ), Column C (วันที่ตรวจ), Column F (PD No.).
 * ถ้ารายการ PD ซ้ำกัน ให้เลือกเฉพาะรายการ วันที่ตรวจ ใน column C ที่เป็นวันที่ล่าสุด!
 */
export function parseQcWorkbook(data: ArrayBuffer | Uint8Array): Record<string, QcMeta> {
  const wb = XLSX.read(data, { type: 'array' });
  const qcMap: Record<string, QcMeta> = {};

  for (const sheetName of wb.SheetNames) {
    if (sheetName.includes('รูป')) continue; // Skip photo sheets
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: false });
    if (!rows || rows.length < 2) continue;

    let headerIdx = -1;
    let pdIdx = -1, dateIdx = -1, inspIdx = -1, passIdx = -1, failIdx = -1, actionIdx = -1, remarkIdx = -1, topicIdx = -1, projIdx = -1;

    for (let r = 0; r < Math.min(rows.length, 5); r++) {
      const row = (rows[r] || []).map(cell => String(cell || '').trim());
      const pIdx = row.findIndex(c => /PD\s*No/i.test(c));
      if (pIdx !== -1) {
        headerIdx = r;
        pdIdx = pIdx;
        dateIdx = row.findIndex(c => c.includes('วันที่ตรวจ') || c.includes('วันตรวจ'));
        inspIdx = row.findIndex(c => c.includes('ผู้ตรวจสอบ'));
        passIdx = row.findIndex(c => c === 'ผ่าน' || c.includes('ผ่าน'));
        failIdx = row.findIndex(c => c.includes('ไม่ผ่าน'));
        actionIdx = row.findIndex(c => c.includes('การดำเนินการ') || c.includes('ดำเนินการ'));
        remarkIdx = row.findIndex(c => c.includes('หมายเหตุ') || c.includes('รายละเอียด'));
        topicIdx = row.findIndex(c => c.includes('หัวข้อการตรวจสอบ'));
        projIdx = row.findIndex(c => c.includes('เลขที่โครงการ'));
        break;
      }
    }

    if (headerIdx === -1 || pdIdx === -1) continue;

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[pdIdx]) continue;
      const pdVal = String(row[pdIdx]).trim();
      const matches = pdVal.match(/PD\d+/gi);
      if (!matches) continue;

      const getVal = (idx: number, fallbackIdx?: number) => {
        const actualIdx = idx !== -1 ? idx : (fallbackIdx !== undefined ? fallbackIdx : -1);
        return actualIdx !== -1 && actualIdx < row.length && row[actualIdx] != null ? String(row[actualIdx]).trim() : '';
      };

      const meta: QcMeta = {
        pdNo: matches[0].toUpperCase(),
        qcDate: getVal(dateIdx, 2),        // Column C
        inspector: getVal(inspIdx, 4),     // Column E
        qtyPass: getVal(passIdx, 8),       // Column I
        qtyFail: getVal(failIdx, 9),       // Column J
        action: getVal(actionIdx, 13),     // Column N
        remarks: getVal(remarkIdx, 15),    // Column P
        topic: getVal(topicIdx, 17),       // Column R
        project: getVal(projIdx, 18),      // Column S
      };

      for (const m of matches) {
        updateQcMapWithLatest(qcMap, m.toUpperCase(), meta);
      }
    }
  }

  return qcMap;
}

/**
 * Parses raw CSV of Google Sheet 3 (QC Checklist: gid=1814251242)
 * Rule: Column N (การดำเนินการ), Column C (วันที่ตรวจ), Column F (PD No.).
 * ถ้ารายการ PD ซ้ำกัน ให้เลือกเฉพาะรายการ วันที่ตรวจ ใน column C ที่เป็นวันที่ล่าสุด!
 */
export function parseQcCsv(csvText: string): Record<string, QcMeta> {
  const parsed = Papa.parse<string[]>(csvText, { skipEmptyLines: true });
  const rows = parsed.data;
  if (!rows || rows.length < 2) return {};

  const headers = rows[0].map(h => h.trim().replace(/\n/g, ' '));
  const findCol = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.toLowerCase().includes(k.toLowerCase())));

  const pdIdx = findCol(['PD No', 'PD No.', 'PD']);
  const dateIdx = findCol(['วันที่ตรวจ', 'วันตรวจ']);
  const inspectorIdx = findCol(['ผู้ตรวจสอบ']);
  const passIdx = findCol(['ผ่าน']);
  const failIdx = findCol(['ไม่ผ่าน']);
  const actionIdx = findCol(['การดำเนินการ', 'ดำเนินการ']);
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

    const getVal = (idx: number, fallbackIdx: number) => {
      const actualIdx = idx !== -1 ? idx : fallbackIdx;
      return actualIdx < r.length && r[actualIdx] ? r[actualIdx].trim() : '';
    };

    const meta: QcMeta = {
      pdNo: matches[0].toUpperCase(),
      qcDate: getVal(dateIdx, 2),        // Column C
      inspector: getVal(inspectorIdx, 4),// Column E
      qtyPass: getVal(passIdx, 8),       // Column I
      qtyFail: getVal(failIdx, 9),       // Column J
      action: getVal(actionIdx, 13),     // Column N
      remarks: getVal(remarkIdx, 15),    // Column P
      topic: getVal(topicIdx, 17),       // Column R
      project: getVal(projIdx, 18),      // Column S
    };

    matches.forEach(p => {
      updateQcMapWithLatest(qcMap, p.toUpperCase(), meta);
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

  const docRefIdx = findCol(['Document number', 'Document Reference', 'Doc Ref', 'Reference']);
  const projCodeIdx = findCol(['เลขที่โครงการ', 'Project No']);
  const projNameIdx = findCol(['ชื่อโครงการ', 'Project Name']);
  const docTypeIdx = findCol(['ประเภท', 'Doc Type']);
  const machineIdx = findCol(['เลขที่ใบ 04', 'ใบ 04', 'เลขที่เอกสาร 04', 'เอกสาร 04', 'ชื่อเครื่องจักร', 'Machine Name', 'Machine']);
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
    const rawRemark = getVal(remarkIdx !== -1 ? remarkIdx : 18);
    const rawStatus = getVal(statusIdx !== -1 ? statusIdx : 19);
    const closed = closedIdx !== -1 ? getVal(closedIdx) : '';

    const machineName = rawMachine || '(ไม่ระบุเอกสาร 04)';
    const targetLatest = rawTargetLatest || target5 || target4 || target3 || target2 || target1;

    let qty = 1;
    if (qtyStr) {
      const parsedQty = parseFloat(qtyStr.replace(/,/g, ''));
      if (!isNaN(parsedQty)) qty = parsedQty;
    }

    // Link with Production Register
    const docNorm = norm(docRef);
    const itemNorm = norm(itemCode);
    const key = `${docNorm}|${itemNorm}`;

    let prodMeta: ProductionMeta | undefined = productionMap.byDocItem[key];
    if (!prodMeta && docNorm && productionMap.byDoc[docNorm]) {
      prodMeta = productionMap.byDoc[docNorm];
    }

    // อ่านข้อมูลจาก Column Y (หมายเหตุ จาก Sheet 2) ผสานกับหมายเหตุจาก Sheet 1
    const prodRemark = prodMeta?.remark?.trim() || '';
    let remark = rawRemark;
    if (prodRemark) {
      if (!rawRemark) {
        remark = prodRemark;
      } else if (rawRemark !== prodRemark && !rawRemark.includes(prodRemark)) {
        remark = `${prodRemark} (${rawRemark})`;
      }
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

    // Link with QC Sheet (Read Column N for warehouse status, and pick latest inspection date from Column C)
    const itemPds = extractPdNumbers(prodOrder);
    const matchedQcPds = qcMap ? itemPds.filter(p => qcMap[p]) : [];
    const latestQcMeta = pickLatestQcMeta(itemPds, qcMap);
    const qcAction = latestQcMeta?.action || '';
    const qcWarehouseStatus = getQcWarehouseStatus(qcAction);
    const isQcPassed = qcWarehouseStatus === 'คลัง PRD' || qcWarehouseStatus === 'คลัง SEMI';

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
      qcDate: latestQcMeta?.qcDate || '',
      qcInspector: latestQcMeta?.inspector || '',
      qcPassedQty: latestQcMeta?.qtyPass || '',
      qcTopic: latestQcMeta?.topic || '',
      qcRemarks: latestQcMeta?.remarks || '',
      qcAction,
      qcWarehouseStatus,
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

  // Detect Closed and Remark (Column Y) columns from header row of Sheet 2
  let headerRowIdx = 0;
  if (rows[0] && rows[0].some(c => (c || '').includes('Document') || (c || '').includes('หัวข้อ'))) {
    headerRowIdx = 0;
  } else if (rows[1] && rows[1].some(c => (c || '').includes('Document') || (c || '').includes('หัวข้อ'))) {
    headerRowIdx = 1;
  }
  const sheet2Headers = (rows[headerRowIdx] || []).map((h: string) => (h || '').trim().replace(/\n/g, ' '));
  const findSheet2Col = (keywords: string[]) =>
    sheet2Headers.findIndex((h: string) => keywords.some(k => h.toLowerCase().includes(k.toLowerCase())));

  const docRefIdx = findSheet2Col(['Document number', 'Document Reference', 'Doc Ref', 'Reference']);
  const actionTopicIdx = findSheet2Col(['หัวข้อแจ้งดำเนินการ', 'หัวข้อ']);
  const ncrIdx = findSheet2Col(['NCR', 'IPR']);
  const projCodeIdx = findSheet2Col(['เลขที่โครงการ', 'Project No']);
  const projNameIdx = findSheet2Col(['ชื่อโครงการ', 'Project Name']);
  const machineIdx = findSheet2Col(['เครื่องจักร', 'Machine Name', 'Machine']);
  const docTypeIdx = findSheet2Col(['ประเภท', 'Doc Type']);
  const doc04Idx = findSheet2Col(['เลขที่ใบ 04', 'ใบ 04', 'เลขที่เอกสาร 04', 'เอกสาร 04']);
  const itemCodeIdx = findSheet2Col(['เลขที่ Item', 'Item Code', 'Item No']);
  const itemNameIdx = findSheet2Col(['ชื่อ Item', 'Item Name', 'รายการ']);
  const qtyIdx = findSheet2Col(['จำนวน', 'Qty', 'Quantity']);
  const prodOrderIdx = findSheet2Col(['Production Order', 'Prod Order']);
  const pdActLineIdx = findSheet2Col(['จำนวนPD', 'Act Line']);
  const notifyDateIdx = findSheet2Col(['วันที่แจ้งดำเนินการ', 'Notify Date']);
  const weekIdx = findSheet2Col(['Week']);
  const targetReqIdx = findSheet2Col(['เป้าหมายที่ต้องการ', 'Target Requested']);
  const deptIdx = findSheet2Col(['หน่วยงานที่แจ้งดำเนินการ', 'หน่วยงาน']);
  const reqNameIdx = findSheet2Col(['ชื่อผู้แจ้งดำเนินการ', 'ผู้แจ้ง']);
  const target1Idx = findSheet2Col(['เป้าหมายส่งมอบ 1', 'เป้าหมาย 1']);
  const target2Idx = findSheet2Col(['เป้าหมายส่งมอบ 2', 'เป้าหมาย 2']);
  const target3Idx = findSheet2Col(['เป้าหมายส่งมอบ 3', 'เป้าหมาย 3']);
  const target4Idx = findSheet2Col(['เป้าหมายส่งมอบ 4', 'เป้าหมาย 4']);
  const target5Idx = findSheet2Col(['เป้าหมายส่งมอบ 5', 'เป้าหมาย 5']);
  const targetLatestIdx = findSheet2Col(['เป้าหมายล่าสุด', 'Target Latest']);
  const poPrIdx = findSheet2Col(['PO/PR', 'PO', 'PR']);
  const remarkIdx = findSheet2Col(['หมายเหตุ', 'Remark', 'Note']);
  const dwgStatusIdx = findSheet2Col(['สถานะแบบ', 'DWG', 'แบบ']);
  const sheet2ClosedIdx = findSheet2Col(['Closed', 'closed', 'close', 'ปิดงาน', 'ปิด']);

  console.log(`[PDTrack] Sheet2 Headers (row ${headerRowIdx}):`, sheet2Headers);
  console.log('[PDTrack] Sheet2 doc04Idx:', doc04Idx, '| machineIdx:', machineIdx, '| docTypeIdx:', docTypeIdx, '| itemCodeIdx:', itemCodeIdx);

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 10) continue;

    const getVal = (idx: number) => (idx >= 0 && idx < r.length && r[idx] ? r[idx].trim() : '');

    const actionTopic = getVal(actionTopicIdx !== -1 ? actionTopicIdx : 1);
    if (actionTopic !== 'สั่งผลิตเครื่องจักรตาม Machine List') continue;

    const rawDwgStatus = getVal(dwgStatusIdx !== -1 ? dwgStatusIdx : 26);
    if (rawDwgStatus.includes('ยกเลิกผลิต') || rawDwgStatus.includes('ไม่สั่งผลิต')) continue;

    const docRef = getVal(docRefIdx !== -1 ? docRefIdx : 0);
    const ncrNo = getVal(ncrIdx !== -1 ? ncrIdx : 2);
    const projectCode = getVal(projCodeIdx !== -1 ? projCodeIdx : 3);
    const projectName = getVal(projNameIdx !== -1 ? projNameIdx : 4);
    const rawMachineCol = getVal(machineIdx !== -1 ? machineIdx : 5);
    const docType = getVal(docTypeIdx !== -1 ? docTypeIdx : 6) || 'งานโครงการ';
    // ดึงข้อมูลมาจาก Column 'เลขที่ใบ 04' ใน Google Sheet
    const rawDoc04 = getVal(doc04Idx !== -1 ? doc04Idx : 7);
    const itemCode = getVal(itemCodeIdx !== -1 ? itemCodeIdx : 8);
    const itemName = getVal(itemNameIdx !== -1 ? itemNameIdx : 9);
    const qtyStr = getVal(qtyIdx !== -1 ? qtyIdx : 10);
    let prodOrder = getVal(prodOrderIdx !== -1 ? prodOrderIdx : 11);
    const pdActLine = getVal(pdActLineIdx !== -1 ? pdActLineIdx : 12);
    const notifyDate = getVal(notifyDateIdx !== -1 ? notifyDateIdx : 13);
    const week = getVal(weekIdx !== -1 ? weekIdx : 14);
    const targetRequested = getVal(targetReqIdx !== -1 ? targetReqIdx : 15);
    const requestDept = getVal(deptIdx !== -1 ? deptIdx : 16);
    const requesterName = getVal(reqNameIdx !== -1 ? reqNameIdx : 17);
    const target1 = getVal(target1Idx !== -1 ? target1Idx : 18);
    const target2 = getVal(target2Idx !== -1 ? target2Idx : 19);
    const target3 = getVal(target3Idx !== -1 ? target3Idx : 20);
    const target4 = getVal(target4Idx !== -1 ? target4Idx : 21);
    const target5 = getVal(target5Idx !== -1 ? target5Idx : 22);
    let rawTargetLatest = getVal(targetLatestIdx !== -1 ? targetLatestIdx : 23);
    const poPr = getVal(poPrIdx !== -1 ? poPrIdx : 24);
    const remark = remarkIdx !== -1 ? getVal(remarkIdx) : getVal(25);
    const closed = sheet2ClosedIdx !== -1 ? getVal(sheet2ClosedIdx) : getVal(27);

    // เลขที่เอกสาร 04 ดึงมาจาก Column 'เลขที่ใบ 04' (ถ้าไม่มี ให้เป็น '(ไม่ระบุเอกสาร 04)')
    const machineName = rawDoc04 || '(ไม่ระบุเอกสาร 04)';
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
    const latestQcMeta = pickLatestQcMeta(itemPds, qcMap);
    const qcAction = latestQcMeta?.action || '';
    const qcWarehouseStatus = getQcWarehouseStatus(qcAction);
    const isQcPassed = qcWarehouseStatus === 'คลัง PRD' || qcWarehouseStatus === 'คลัง SEMI';

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
      machine: rawMachineCol || undefined,
      hasMachine: Boolean(rawDoc04),
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
      qcDate: latestQcMeta?.qcDate || '',
      qcInspector: latestQcMeta?.inspector || '',
      qcPassedQty: latestQcMeta?.qtyPass || '',
      qcTopic: latestQcMeta?.topic || '',
      qcRemarks: latestQcMeta?.remarks || '',
      qcAction,
      qcWarehouseStatus,
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
 * Parses Service Purchase items ("สั่งผลิต/สั่งซื้อ ตามใบเสนอราคา") from Sheet 'service purchase'
 * (https://docs.google.com/spreadsheets/d/1YLgaxdeJR_MCHJhFkoAPAJfGmvUJB2K9GPgirYqlhPE/edit?gid=1833136006)
 * and tags them with workTag: 'Service Purchase'
 */
export function parseServicePurchaseCsv(
  csvText: string,
  existingKeys: Set<string>,
  qcMap?: Record<string, QcMeta>
): DeliveryItem[] {
  const parsed = Papa.parse<string[]>(csvText, { skipEmptyLines: true });
  const rows = parsed.data;
  if (!rows || rows.length < 2) return [];

  let headerRowIdx = 0;
  if (rows[0] && rows[0].some(c => (c || '').includes('Document') || (c || '').includes('หัวข้อ'))) {
    headerRowIdx = 0;
  } else if (rows[1] && rows[1].some(c => (c || '').includes('Document') || (c || '').includes('หัวข้อ'))) {
    headerRowIdx = 1;
  }

  const spHeaders = (rows[headerRowIdx] || []).map((h: string) => (h || '').trim().replace(/\n/g, ' '));
  const findSpCol = (keywords: string[]) =>
    spHeaders.findIndex((h: string) => keywords.some(k => h.toLowerCase().includes(k.toLowerCase())));

  const docRefIdx = findSpCol(['Document number', 'Document Reference', 'Doc Ref', 'Reference']);
  const actionTopicIdx = findSpCol(['หัวข้อแจ้งดำเนินการ', 'หัวข้อ']);
  const ncrIdx = findSpCol(['NCR', 'IPR']);
  const projCodeIdx = findSpCol(['เลขที่โครงการ', 'Project No']);
  const projNameIdx = findSpCol(['ชื่อโครงการ', 'Project Name']);
  const docTypeIdx = findSpCol(['ประเภท', 'Doc Type']);
  const doc04Idx = findSpCol(['เลขที่ใบ 04', 'ใบ 04', 'เลขที่เอกสาร 04', 'เอกสาร 04']);
  const machineIdx = findSpCol(['ชื่อเครื่องจักร', 'เครื่องจักร', 'Machine Name', 'Machine']);
  const itemCodeIdx = findSpCol(['เลขที่ Item', 'Item Code', 'Item No']);
  const itemNameIdx = findSpCol(['ชื่อ Item', 'Item Name', 'รายการ']);
  const qtyIdx = findSpCol(['จำนวน', 'Qty', 'Quantity']);
  const prodOrderIdx = findSpCol(['Production Order', 'Prod Order']);
  const pdActLineIdx = findSpCol(['จำนวนPD', 'Act Line']);
  const notifyDateIdx = findSpCol(['วันที่แจ้งดำเนินการ', 'Notify Date']);
  const weekIdx = findSpCol(['Week']);
  const targetReqIdx = findSpCol(['เป้าหมายที่ต้องการ', 'Target Requested']);
  const deptIdx = findSpCol(['หน่วยงานที่แจ้งดำเนินการ', 'หน่วยงาน']);
  const reqNameIdx = findSpCol(['ชื่อผู้แจ้งดำเนินการ', 'ผู้แจ้ง']);
  const target1Idx = findSpCol(['เป้าหมายส่งมอบ 1', 'เป้าหมาย 1']);
  const target2Idx = findSpCol(['เป้าหมายส่งมอบ 2', 'เป้าหมาย 2']);
  const target3Idx = findSpCol(['เป้าหมายส่งมอบ 3', 'เป้าหมาย 3']);
  const target4Idx = findSpCol(['เป้าหมายส่งมอบ 4', 'เป้าหมาย 4']);
  const target5Idx = findSpCol(['เป้าหมายส่งมอบ 5', 'เป้าหมาย 5']);
  const targetLatestIdx = findSpCol(['เป้าหมายล่าสุด', 'Target Latest']);
  const poPrIdx = findSpCol(['po/pr', 'po / pr']);
  const remarkIdx = findSpCol(['หมายเหตุ', 'Remark', 'Note']);
  const dwgStatusIdx = findSpCol(['สถานะแบบ', 'DWG', 'แบบ']);
  const closedIdx = findSpCol(['Closed', 'closed', 'close', 'ปิดงาน', 'ปิด']);

  const spItems: DeliveryItem[] = [];
  let spCounter = 0;

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 5 || r.every(c => !c.trim())) continue;

    const getVal = (idx: number, fallback: number) => {
      const target = idx !== -1 ? idx : fallback;
      return target >= 0 && target < r.length && r[target] ? r[target].trim() : '';
    };

    const rawDwgStatus = getVal(dwgStatusIdx, 27);
    if (rawDwgStatus.includes('ยกเลิกผลิต') || rawDwgStatus.includes('ไม่สั่งผลิต')) continue;

    const docRef = getVal(docRefIdx, 0);
    const actionTopic = getVal(actionTopicIdx, 1) || 'สั่งผลิต/สั่งซื้อ ตามใบเสนอราคา';
    const ncrNo = getVal(ncrIdx, 2);
    const projectCode = getVal(projCodeIdx, 3);
    const projectName = getVal(projNameIdx, 4);
    const docType = getVal(docTypeIdx, 5) || 'เอกสาร 04';
    const rawDoc04 = getVal(doc04Idx, 6);
    const rawMachineCol = getVal(machineIdx, 7);
    const itemCode = getVal(itemCodeIdx, 8);
    const itemName = getVal(itemNameIdx, 9);
    const qtyStr = getVal(qtyIdx, 10);
    let prodOrder = getVal(prodOrderIdx, 12);
    const pdActLine = getVal(pdActLineIdx, 13);
    const notifyDate = getVal(notifyDateIdx, 14);
    const week = getVal(weekIdx, 15);
    const targetRequested = getVal(targetReqIdx, 16);
    const requestDept = getVal(deptIdx, 17);
    const requesterName = getVal(reqNameIdx, 18);
    let target1 = getVal(target1Idx, 19);
    let target2 = getVal(target2Idx, 20);
    let target3 = getVal(target3Idx, 21);
    let target4 = getVal(target4Idx, 22);
    let target5 = getVal(target5Idx, 23);
    // Column Y (Col 24): เป้าหมายล่าสุด
    const rawTargetLatest = getVal(targetLatestIdx, 24);
    const poPr = getVal(poPrIdx, 25);
    const remark = getVal(remarkIdx, 26);
    const closed = getVal(closedIdx, 28);

    const machineName = rawDoc04 || '(ไม่ระบุเอกสาร 04)';
    const dedupKey = `${norm(docRef)}|${norm(machineName)}|${norm(itemCode)}`;
    if (existingKeys.has(dedupKey)) continue;

    // Service Purchase: เป้าหมายให้ดูใน Column Y (เป้าหมายล่าสุด)
    const targetLatest = rawTargetLatest || target5 || target4 || target3 || target2 || target1 || targetRequested;

    // พร้อมใส่ในช่องประวัติเลื่อนเป้าด้วย (ถ้า target1 ว่าง ให้ใช้ targetLatest จาก Column Y)
    if (!target1 && targetLatest) {
      target1 = targetLatest;
    } else if (target1 && targetLatest && target1 !== targetLatest) {
      if (!target2) target2 = targetLatest;
      else if (!target3 && target2 !== targetLatest) target3 = targetLatest;
      else if (!target4 && target3 !== targetLatest) target4 = targetLatest;
      else if (!target5 && target4 !== targetLatest) target5 = targetLatest;
    }

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
    const latestQcMeta = pickLatestQcMeta(itemPds, qcMap);
    const qcAction = latestQcMeta?.action || '';
    const qcWarehouseStatus = getQcWarehouseStatus(qcAction);
    const isQcPassed = qcWarehouseStatus === 'คลัง PRD' || qcWarehouseStatus === 'คลัง SEMI';

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

    spCounter++;
    spItems.push({
      id: `sp-item-${spCounter}`,
      workTag: 'Service Purchase',
      docRef,
      projectCode,
      projectName,
      customer: extractCustomer(projectName),
      docType,
      machineName,
      machine: rawMachineCol || undefined,
      hasMachine: Boolean(rawDoc04),
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
      qcDate: latestQcMeta?.qcDate || '',
      qcInspector: latestQcMeta?.inspector || '',
      qcPassedQty: latestQcMeta?.qtyPass || '',
      qcTopic: latestQcMeta?.topic || '',
      qcRemarks: latestQcMeta?.remarks || '',
      qcAction,
      qcWarehouseStatus,
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

  return spItems;
}

/**
 * Helper to enrich a bundled item (Service, Project, or Service Purchase) with Production, QC, and Overview maps
 */
function enrichBundledItem(item: DeliveryItem, defaultTag: WorkTag): DeliveryItem {
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
  const latestQcMeta = pickLatestQcMeta(itemPds, defaultQcData as Record<string, QcMeta>);
  const qcAction = item.qcAction || latestQcMeta?.action || '';
  const qcWarehouseStatus = item.qcWarehouseStatus || getQcWarehouseStatus(qcAction);
  const isQcPassed = qcWarehouseStatus === 'คลัง PRD' || qcWarehouseStatus === 'คลัง SEMI';
  const overviewMeta = getOverviewStatusForItem(item.itemCode, item.projectCode, itemPds);
  if (!prodOrder && overviewMeta?.prodOrder) {
    prodOrder = overviewMeta.prodOrder;
  }
  const prodRemark = prodMeta?.remark?.trim() || '';
  let finalRemark = item.remark || '';
  if (prodRemark) {
    if (!finalRemark) {
      finalRemark = prodRemark;
    } else if (finalRemark !== prodRemark && !finalRemark.includes(prodRemark)) {
      finalRemark = `${prodRemark} (${finalRemark})`;
    }
  }

  const normRemark = finalRemark.toLowerCase();
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
    machineName: (!item.machineName || item.machineName === '(ไม่ระบุเครื่องจักร)') ? '(ไม่ระบุเอกสาร 04)' : item.machineName,
    workTag: item.workTag || defaultTag,
    status: (isDelivered ? 'ส่งแล้ว' : 'รอดำเนินการ') as 'ส่งแล้ว' | 'รอดำเนินการ',
    remark: finalRemark,
    prodOrder,
    customer: item.customer || extractCustomer(item.projectName),
    actionTopic: item.actionTopic || prodMeta?.actionTopic || '',
    ncrNo: item.ncrNo || prodMeta?.ncrNo || '',
    requestDept: item.requestDept || prodMeta?.requestDept || '',
    requesterName: item.requesterName || prodMeta?.requesterName || '',
    targetRequested: item.targetRequested || prodMeta?.targetRequested || '',
    week: item.week || prodMeta?.week || '',
    isQcPassed,
    qcDate: item.qcDate || latestQcMeta?.qcDate || '',
    qcInspector: item.qcInspector || latestQcMeta?.inspector || '',
    qcPassedQty: item.qcPassedQty || latestQcMeta?.qtyPass || '',
    qcTopic: item.qcTopic || latestQcMeta?.topic || '',
    qcRemarks: item.qcRemarks || latestQcMeta?.remarks || '',
    qcAction,
    qcWarehouseStatus,
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


// ---------------------------------------------------------------------------
// Report PO ค้างรับ (Purchase Data) — ใช้หาเป้าส่งมอบของงาน Service Purchase
// ---------------------------------------------------------------------------
export const DEFAULT_PO_PENDING_FOLDER_URL = 'https://drive.google.com/drive/folders/1z4qVl5Iikwd1PTQSdwo0Et_nIk9VMTGS?usp=drive_link';
const STORAGE_PO_PENDING_FOLDER_KEY = 'pdtrack_po_pending_folder_url';
const STORAGE_PO_PENDING_CACHE_KEY = 'pdtrack_po_pending_v1';

export interface PoPendingLine {
  order: string;
  line?: number | string;
  item: string;
  qty?: number | string;
  planned: string;
  confirmed: string;
}

export interface PoPendingData {
  fileName: string;
  fileDate: string;
  lines: PoPendingLine[];
}

let activePoPending: PoPendingData = defaultPoPendingJson as PoPendingData;
try {
  const cachedPo = localStorage.getItem(STORAGE_PO_PENDING_CACHE_KEY);
  if (cachedPo) {
    const parsedPo = JSON.parse(cachedPo) as PoPendingData;
    // ใช้ไฟล์ที่ใหม่ที่สุดระหว่างข้อมูลที่ bundle มากับแคชที่ผู้ใช้โหลดเอง
    if (parsedPo?.lines?.length && parsedPo.fileDate >= activePoPending.fileDate) {
      activePoPending = parsedPo;
    }
  }
} catch {
  // ignore storage error
}

export function getActivePoPending(): PoPendingData {
  return activePoPending;
}

export function getSavedPoPendingFolderUrl(): string {
  return localStorage.getItem(STORAGE_PO_PENDING_FOLDER_KEY) || DEFAULT_PO_PENDING_FOLDER_URL;
}

export function savePoPendingFolderUrl(url: string): void {
  localStorage.setItem(STORAGE_PO_PENDING_FOLDER_KEY, url.trim() || DEFAULT_PO_PENDING_FOLDER_URL);
}

function formatPoDate(v: unknown): string {
  if (v instanceof Date && !isNaN(v.getTime())) {
    const dd = String(v.getDate()).padStart(2, '0');
    const mm = String(v.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${v.getFullYear()}`;
  }
  return '';
}

/** แยกวันที่จากชื่อไฟล์ เช่น "Report PO ค้างรับ  06-10-26.xlsx" -> 2026-10-06 */
function poFileDateFromName(fileName: string): string {
  const m = fileName.match(/(\d{1,2})-(\d{1,2})-(\d{2,4})/);
  if (!m) return new Date().toISOString().slice(0, 10);
  let y = parseInt(m[3], 10);
  if (y >= 2500) y -= 543;
  else if (y < 100) y += 2000;
  return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** อ่านไฟล์ Report PO ค้างรับ (.xlsx) แล้วใช้เป็นข้อมูลปัจจุบัน (เก็บใน localStorage) */
export function parsePoPendingExcel(buffer: ArrayBuffer, fileName: string): PoPendingData {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const ws = wb.Sheets['Data'] || wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '', raw: true });
  const headers = (rows[0] || []).map(h => String(h ?? '').trim());
  const idx = (name: string) => headers.indexOf(name);
  const orderI = idx('Order');
  const itemI = idx('Item') + 1; // รหัส Item อยู่คอลัมน์ถัดจากหัว "Item"
  const planI = idx('Planned Receipt Date');
  const confI = idx('Confirmed Receipt Date');
  if (orderI < 0 || idx('Item') < 0 || planI < 0 || confI < 0) {
    throw new Error(`ไม่พบคอลัมน์ Order / Item / Planned Receipt Date / Confirmed Receipt Date ในไฟล์ "${fileName}"`);
  }
  const lineI = idx('Line');
  const qtyI = idx('Ordered Quantity');

  const lines: PoPendingLine[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const order = String(r[orderI] ?? '').trim().toUpperCase();
    if (!order) continue;
    lines.push({
      order,
      line: lineI >= 0 ? r[lineI] : undefined,
      item: String(r[itemI] ?? '').trim().toUpperCase(),
      qty: qtyI >= 0 ? r[qtyI] : undefined,
      planned: formatPoDate(r[planI]),
      confirmed: formatPoDate(r[confI]),
    });
  }
  return { fileName, fileDate: poFileDateFromName(fileName), lines };
}

export function saveActivePoPending(data: PoPendingData): void {
  activePoPending = data;
  try {
    localStorage.setItem(STORAGE_PO_PENDING_CACHE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Could not save PO pending data to localStorage:', err);
  }
}

/**
 * Service Purchase: เป้าส่งมอบ = วันที่รับของจาก Report PO ค้างรับ (Confirmed ถ้ามี ไม่งั้น Planned)
 * ถ้า PO/PR ไม่อยู่ใน Report ค้างรับ แสดงว่าส่งมอบ/รับของแล้ว
 */
export function applyPoPendingToItems(items: DeliveryItem[]): DeliveryItem[] {
  const { lines } = activePoPending;

  const byOrder = new Map<string, PoPendingLine[]>();
  for (const l of lines || []) {
    const arr = byOrder.get(l.order);
    if (arr) arr.push(l);
    else byOrder.set(l.order, [l]);
  }

  return items.map(item => {
    if (item.workTag !== 'Service Purchase') return item;

    // Service Purchase ไม่ใช้เป้าหมายจากชีต service purchase — ใช้เฉพาะข้อมูลจาก Report PO ค้างรับ
    const cleared: DeliveryItem = {
      ...item,
      target1: '',
      target2: '',
      target3: '',
      target4: '',
      target5: '',
      targetLatest: '',
      targetRequested: '',
      poReceiptDate: '',
      // งานที่เคยถูกตีว่าส่งแล้วจาก PO (แคช) ให้เริ่มจากสถานะรอดำเนินการก่อนตัดสินใหม่
      ...(item.deliveredByPo ? { status: 'รอดำเนินการ' as const, deliveredByPo: false } : {}),
    };

    const po = (item.poPr || '').trim().toUpperCase();
    if (!po || byOrder.size === 0) return cleared;

    const poLines = byOrder.get(po);
    if (!poLines) {
      return { ...cleared, status: 'ส่งแล้ว', deliveredByPo: true };
    }

    const itemCode = (item.itemCode || '').trim().toUpperCase();
    const matched = poLines.filter(l => l.item === itemCode);
    const candidates = matched.length > 0 ? matched : poLines;
    const receiptDate = candidates
      .map(l => l.confirmed || l.planned)
      .filter(Boolean)
      .sort((a, b) => (parseDate(a)?.getTime() ?? 0) - (parseDate(b)?.getTime() ?? 0))[0];
    if (!receiptDate) return cleared;
    return { ...cleared, target1: receiptDate, targetLatest: receiptDate, poReceiptDate: receiptDate };
  });
}

// ---------------------------------------------------------------------------
// Auto-sync: scan โฟลเดอร์ Drive หาไฟล์ล่าสุด แล้วดึงมาใช้งานอัตโนมัติ (ผ่าน dev server)
// ---------------------------------------------------------------------------
const STORAGE_OVERVIEW_MTIME_KEY = 'pdtrack_overview_file_mtime';
const STORAGE_PO_MTIME_KEY = 'pdtrack_po_file_mtime';

async function fetchLatestLocalFile(
  kind: 'overview' | 'po',
  mtimeKey: string,
  force: boolean
): Promise<{ name: string; buffer: ArrayBuffer; stamp: string } | null> {
  try {
    const metaRes = await fetch(`/api/latest-file?kind=${kind}&meta=1`);
    if (!metaRes.ok) return null;
    const meta = await metaRes.json();
    if (!meta?.found) return null;
    const stamp = `${meta.name}|${meta.mtime}`;
    if (!force && localStorage.getItem(mtimeKey) === stamp) return null; // ใช้ไฟล์ล่าสุดอยู่แล้ว
    const res = await fetch(`/api/latest-file?kind=${kind}`);
    if (!res.ok) return null;
    return { name: meta.name, buffer: await res.arrayBuffer(), stamp };
  } catch {
    return null; // ไม่มี dev server / ไม่มีโฟลเดอร์ Drive — ใช้ข้อมูลเดิม
  }
}

/** Scan โฟลเดอร์ Status Overview หาไฟล์ล่าสุด แล้วโหลดเป็นข้อมูล Overview ที่ใช้งาน (null = ไม่มีไฟล์ใหม่) */
export async function autoSyncLatestOverview(force = false): Promise<{ fileName: string; pdCount: number } | null> {
  const file = await fetchLatestLocalFile('overview', STORAGE_OVERVIEW_MTIME_KEY, force);
  if (!file) return null;
  const parsed = parseOverviewExcel(file.buffer);
  const pdCount = Object.keys(parsed.byPd).length;
  if (pdCount === 0) return null;
  saveActiveOverviewData(parsed, file.name);
  try {
    localStorage.setItem(STORAGE_OVERVIEW_MTIME_KEY, file.stamp);
  } catch {
    // ignore storage error
  }
  return { fileName: file.name, pdCount };
}

/** Scan โฟลเดอร์ Purchase Data หา Report PO ค้างรับ ล่าสุด แล้วโหลดใช้งาน (null = ไม่มีไฟล์ใหม่) */
export async function autoSyncLatestPoPending(force = false): Promise<PoPendingData | null> {
  const file = await fetchLatestLocalFile('po', STORAGE_PO_MTIME_KEY, force);
  if (!file) return null;
  const data = parsePoPendingExcel(file.buffer, file.name);
  if (data.lines.length === 0) return null;
  saveActivePoPending(data);
  try {
    localStorage.setItem(STORAGE_PO_MTIME_KEY, file.stamp);
  } catch {
    // ignore storage error
  }
  return data;
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
  customOverviewUrl?: string,
  customSpUrl?: string
): Promise<{ items: DeliveryItem[]; fromLive: boolean; error?: string }> {
  const sheetUrl = customUrl || getSavedSheetUrl();
  const prodUrl = customProdUrl || getSavedProdUrl();
  const spUrl = customSpUrl || getSavedServicePurchaseUrl();
  const qcUrl = customQcUrl || getSavedQcUrl();
  const overviewUrl = customOverviewUrl !== undefined ? customOverviewUrl : getSavedOverviewUrl();

  const csvUrl1 = getCsvExportUrl(sheetUrl);
  const csvUrl2 = getCsvExportUrl(prodUrl);
  const csvUrlSp = getCsvExportUrl(spUrl);
  const xlsxUrl3 = getXlsxExportUrl(qcUrl);
  const csvUrl3 = getCsvExportUrl(qcUrl);
  const hasOverviewUrl = !!(overviewUrl && overviewUrl.trim());
  const csvUrl4 = hasOverviewUrl ? getCsvExportUrl(overviewUrl.trim()) : '';

  try {
    // Fetch all requested sheets in parallel
    const [res1, res2, res3, res4, resSp] = await Promise.allSettled([
      fetch(csvUrl1, { method: 'GET', headers: { Accept: 'text/csv,text/plain,*/*' } }),
      fetch(csvUrl2, { method: 'GET', headers: { Accept: 'text/csv,text/plain,*/*' } }),
      fetch(xlsxUrl3, { method: 'GET' }),
      csvUrl4 ? fetch(csvUrl4, { method: 'GET', headers: { Accept: 'text/csv,text/plain,*/*' } }) : Promise.reject('No overview URL'),
      csvUrlSp ? fetch(csvUrlSp, { method: 'GET', headers: { Accept: 'text/csv,text/plain,*/*' } }) : Promise.reject('No SP URL'),
    ]);

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

    // QC Sheet 3 map (Fetch all sheets via XLSX across all monthly tabs, fallback to CSV if needed)
    let qcMap = defaultQcData as Record<string, QcMeta>;
    if (res3.status === 'fulfilled' && res3.value.ok) {
      try {
        const arrayBuf = await res3.value.arrayBuffer();
        const liveQcMap = parseQcWorkbook(arrayBuf);
        if (Object.keys(liveQcMap).length > 0) {
          qcMap = liveQcMap;
        }
      } catch (qcErr) {
        console.warn('Could not parse live QC XLSX, trying fallback CSV:', qcErr);
        try {
          const fallbackRes = await fetch(csvUrl3, { method: 'GET', headers: { Accept: 'text/csv,text/plain,*/*' } });
          if (fallbackRes.ok) {
            const csvText = await fallbackRes.text();
            const liveQcMap = parseQcCsv(csvText);
            if (Object.keys(liveQcMap).length > 0) {
              qcMap = liveQcMap;
            }
          }
        } catch (fbErr) {
          console.warn('Could not parse fallback QC CSV, using cached QC data:', fbErr);
        }
      }
    } else {
      // If XLSX fetch failed directly, try CSV fallback
      try {
        const fallbackRes = await fetch(csvUrl3, { method: 'GET', headers: { Accept: 'text/csv,text/plain,*/*' } });
        if (fallbackRes.ok) {
          const csvText = await fallbackRes.text();
          const liveQcMap = parseQcCsv(csvText);
          if (Object.keys(liveQcMap).length > 0) {
            qcMap = liveQcMap;
          }
        }
      } catch (fbErr) {
        console.warn('Fallback QC CSV fetch failed, using cached QC data:', fbErr);
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
      // Sheet 2 ไม่สามารถโหลดได้ (เช่น 401) — ใช้ project items จาก cache ก่อน
      const cachedRaw = localStorage.getItem(STORAGE_CACHE_KEY);
      if (cachedRaw) {
        try {
          const cachedAll = JSON.parse(cachedRaw) as DeliveryItem[];
          const cachedProj = cachedAll
            .filter(it => it.workTag === 'Project')
            .map(it => enrichBundledItem(it, 'Project'));
          if (cachedProj.length > 0) {
            projectItems = cachedProj;
            console.warn('[PDTrack] Sheet2 fetch failed — using cached project items from localStorage');
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

    // 3. Parse Service Purchase items from Sheet "service purchase"
    let spItems: DeliveryItem[] = [];
    if (resSp && resSp.status === 'fulfilled' && resSp.value.ok) {
      try {
        const liveCsvSp = await resSp.value.text();
        // Collect existing keys to avoid accidental duplicates
        const existingKeys = new Set<string>();
        for (const item of serviceItems) {
          const docNum = (item.docRef || '').trim().toUpperCase();
          const itemCode = (item.itemCode || '').trim().toUpperCase();
          if (docNum && itemCode) existingKeys.add(`${docNum}|${itemCode}`);
          if (item.prodOrder) existingKeys.add(item.prodOrder.trim().toUpperCase());
        }
        for (const item of projectItems) {
          const docNum = (item.docRef || '').trim().toUpperCase();
          const itemCode = (item.itemCode || '').trim().toUpperCase();
          if (docNum && itemCode) existingKeys.add(`${docNum}|${itemCode}`);
          if (item.prodOrder) existingKeys.add(item.prodOrder.trim().toUpperCase());
        }
        spItems = parseServicePurchaseCsv(liveCsvSp, existingKeys, qcMap);
      } catch (spErr) {
        console.warn('Could not parse live Service Purchase Sheet, falling back to cached/bundled:', spErr);
      }
    }

    if (spItems.length === 0) {
      const cachedRaw = localStorage.getItem(STORAGE_CACHE_KEY);
      if (cachedRaw) {
        try {
          const cachedAll = JSON.parse(cachedRaw) as DeliveryItem[];
          const cachedSp = cachedAll
            .filter(it => it.workTag === 'Service Purchase')
            .map(it => enrichBundledItem(it, 'Service Purchase'));
          if (cachedSp.length > 0) {
            spItems = cachedSp;
          } else {
            spItems = (defaultServicePurchaseJson as DeliveryItem[]).map(it => enrichBundledItem(it, 'Service Purchase'));
          }
        } catch {
          spItems = (defaultServicePurchaseJson as DeliveryItem[]).map(it => enrichBundledItem(it, 'Service Purchase'));
        }
      } else {
        spItems = (defaultServicePurchaseJson as DeliveryItem[]).map(it => enrichBundledItem(it, 'Service Purchase'));
      }
    }

    const items = [...serviceItems, ...projectItems, ...spItems];

    // Save to cache
    try {
      // Clean up older cache versions to prevent QuotaExceededError
      for (let k = 0; k < localStorage.length; k++) {
        const key = localStorage.key(k);
        if (key && key.startsWith('pdtrack_cached_data_') && key !== STORAGE_CACHE_KEY) {
          localStorage.removeItem(key);
        }
      }
      localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(items));
      localStorage.setItem(STORAGE_TIMESTAMP_KEY, new Date().toISOString());
    } catch (storageErr) {
      console.warn('Cannot save to localStorage:', storageErr);
    }

    return { items: applyOverridesToItems(applyPoPendingToItems(items)), fromLive: true };
  } catch (err: any) {
    console.warn('Live fetch failed, falling back to local cache/bundled data:', err);

    // Check localStorage cache
    const cached = localStorage.getItem(STORAGE_CACHE_KEY);
    if (cached) {
      try {
        let cachedItems = JSON.parse(cached) as DeliveryItem[];
        cachedItems = cachedItems.map(item => enrichBundledItem(item, item.workTag || 'Service'));

        return {
          items: applyOverridesToItems(applyPoPendingToItems(cachedItems)),
          fromLive: false,
          error: `ใช้ข้อมูลแคชสำรองที่บันทึกไว้ (${err.message})`,
        };
      } catch (parseErr) {
        // Fall through
      }
    }

    // Default bundled data: combine Service + Project + Service Purchase
    const bundledServiceItems = (defaultItemsJson as DeliveryItem[]).map(item => enrichBundledItem(item, 'Service'));
    const bundledProjectItems = (defaultProjectItemsJson as DeliveryItem[]).map(item => enrichBundledItem(item, 'Project'));
    const bundledSpItems = (defaultServicePurchaseJson as DeliveryItem[]).map(item => enrichBundledItem(item, 'Service Purchase'));
    const bundledItems = [...bundledServiceItems, ...bundledProjectItems, ...bundledSpItems];

    return {
      items: applyOverridesToItems(applyPoPendingToItems(bundledItems)),
      fromLive: false,
      error: `ใช้ข้อมูลสำรองในระบบ (เชื่อมโยงทั้งงาน Service, Project และ Service Purchase เรียบร้อย)`,
    };
  }
}

/**
 * Process raw items and build Machine-Indexed summaries with Production & QC context
 */
export function buildMachineSummaries(items: DeliveryItem[]): MachineSummary[] {
  const machineMap = new Map<string, DeliveryItem[]>();

  for (const item of items) {
    const key = (!item.machineName || item.machineName === '(ไม่ระบุเครื่องจักร)') ? '(ไม่ระบุเอกสาร 04)' : item.machineName;
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
    const workTagsSet = new Set<WorkTag>();

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
      hasMachine: name !== '(ไม่ระบุเครื่องจักร)' && name !== '(ไม่ระบุเอกสาร 04)',
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
    if (a.name === '(ไม่ระบุเครื่องจักร)' || a.name === '(ไม่ระบุเอกสาร 04)') return 1;
    if (b.name === '(ไม่ระบุเครื่องจักร)' || b.name === '(ไม่ระบุเอกสาร 04)') return -1;
    if (a.overdueItems > 0 && b.overdueItems === 0) return -1;
    if (b.overdueItems > 0 && a.overdueItems === 0) return 1;
    if (a.progressPercent !== b.progressPercent) return a.progressPercent - b.progressPercent;
    return a.name.localeCompare(b.name);
  });

  return summaries;
}

