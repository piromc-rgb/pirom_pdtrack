import drivePdfIndex from '../data/drivePdfIndex.json';

export const DRIVE_ROOT_FOLDER_ID = '1M-QDPilC7Nn-YW_5YxLQITUS6ZOYEyFm';
export const DRIVE_ROOT_FOLDER_URL = `https://drive.google.com/open?id=${DRIVE_ROOT_FOLDER_ID}&usp=drive_copy`;
export const DEFAULT_DWG_FOLDER_URL = DRIVE_ROOT_FOLDER_URL;

const DWG_FOLDER_STORAGE_KEY = 'pdtrack_dwg_folder_url';

export function getSavedDwgFolderUrl(): string {
  return localStorage.getItem(DWG_FOLDER_STORAGE_KEY) || DEFAULT_DWG_FOLDER_URL;
}

export function saveDwgFolderUrl(url: string): void {
  localStorage.setItem(DWG_FOLDER_STORAGE_KEY, url.trim() || DEFAULT_DWG_FOLDER_URL);
}

export interface DrivePdfEntry {
  id: string;
  name: string;
}

let pdfList: DrivePdfEntry[] = drivePdfIndex as DrivePdfEntry[];
export const TOTAL_INDEXED_DWG_PDFS = pdfList.length;

/**
 * สแกนและรีเฟรชดัชนีไฟล์แบบ DWG ล่าสุดจาก Google Drive (รองรับทั้ง Local Server และ Web)
 */
export async function refreshDwgIndex(): Promise<{ success: boolean; count: number; message: string }> {
  try {
    const resp = await fetch('/api/drive-pdf-refresh', { method: 'POST' });
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.success && Array.isArray(data.items)) {
        pdfList = data.items;
        return {
          success: true,
          count: data.items.length,
          message: `รีเฟรชดัชนี DWG จาก Google Drive สำเร็จ (${data.items.length.toLocaleString()} ไฟล์)`,
        };
      }
    }
  } catch {
    // บน Production หรือสภาพแวดล้อมที่ไม่มี Local API
  }

  return {
    success: true,
    count: pdfList.length,
    message: `เชื่อมต่อดัชนี DWG เรียบร้อย (${pdfList.length.toLocaleString()} ไฟล์)`,
  };
}


/**
 * แปลงรหัส Item เช่น "J131012Z381D00" -> "J131012-Z-38-1-D-00"
 * โครงสร้างมาตรฐาน 14 ตัวอักษร: 7 ตัวแรก - 1 ตัว - 2 ตัว - 1 ตัว - 1 ตัว - 2 ตัวท้าย
 */
export function formatItemCodeWithHyphens(rawItemCode: string): string {
  const clean = (rawItemCode || '').trim().replace(/[-\s_]/g, '').toUpperCase();
  if (!clean) return '';

  // รูปแบบมาตรฐาน 14 ตัวอักษร เช่น J131012Z381D00 -> J131012-Z-38-1-D-00
  if (clean.length === 14) {
    return `${clean.slice(0, 7)}-${clean.slice(7, 8)}-${clean.slice(8, 10)}-${clean.slice(10, 11)}-${clean.slice(11, 12)}-${clean.slice(12, 14)}`;
  }

  // กรณีความยาวใกล้เคียง (เช่น 12-15 ตัวอักษร) ที่ขึ้นต้นด้วยรหัสเครื่อง 7 ตัว
  if (clean.length > 7) {
    return `${clean.slice(0, 7)}-${clean.slice(7)}`;
  }

  return rawItemCode.trim();
}

/**
 * ดึงเลข Revision จากชื่อไฟล์ เช่น "_Rev.03.pdf" -> 3 เพื่อให้เปิดไฟล์ Revision ล่าสุดเสมอ
 */
function extractRevisionNumber(fileName: string): number {
  const match = fileName.match(/rev\.?\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * ค้นหาไฟล์ PDF ในดัชนี Google Drive Folder (1M-QDPilC7Nn-YW_5YxLQITUS6ZOYEyFm และ Subfolder ทั้งหมด)
 * โดยรองรับทั้งชื่อที่มี "-" คั่นตามรูปแบบ J131012-Z-38-1-D-00 และรูปแบบที่มี "-" คั่นในตำแหน่งใดๆ
 */
export function findItemPdfInDriveIndex(rawItemCode: string): DrivePdfEntry | null {
  const clean = (rawItemCode || '').trim().replace(/[-\s_]/g, '').toUpperCase();
  if (!clean || clean === '-') return null;

  const hyphenated = formatItemCodeWithHyphens(clean).toUpperCase();

  // สร้าง Regex ที่อนุญาตให้มี "-" หรือ "_" คั่นระหว่างตัวอักษรได้ทุกตำแหน่ง
  // และให้ '0' (เลขศูนย์) กับ 'O' (ตัวอักษรโอ) สามารถทดแทนกันได้
  const escapedChars = clean.split('').map(c => {
    if (c === '0' || c === 'O') {
      return '[0O]';
    }
    return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  const flexibleHyphenRegex = new RegExp(escapedChars.join('[-_\\s]*'), 'i');

  const matches = pdfList.filter(entry => {
    const upperName = entry.name.toUpperCase();
    if (hyphenated && upperName.includes(hyphenated)) {
      return true;
    }
    return flexibleHyphenRegex.test(entry.name);
  });

  if (matches.length === 0) return null;

  // เรียงลำดับให้ไฟล์ที่มี Revision สูงสุดขึ้นก่อน
  matches.sort((a, b) => extractRevisionNumber(b.name) - extractRevisionNumber(a.name));
  return matches[0];
}

/**
 * ค้นหาและเปิดไฟล์ PDF ด้วย Browser เมื่อผู้ใช้ Double Click ที่เลข Item
 * หากพบในดัชนีจะเปิดไฟล์ทันที หากไม่พบจะค้นหาใน Google Drive ให้อัตโนมัติ
 */
export async function searchAndOpenItemPdf(rawItemCode: string): Promise<void> {
  const trimmed = (rawItemCode || '').trim();
  if (!trimmed || trimmed === '-') return;

  const hyphenated = formatItemCodeWithHyphens(trimmed);

  // 1. ค้นหาจากดัชนีไฟล์ทั้งหมดใน Google Drive Folder (เปิดได้ทันทีแบบ synchronous ไม่ถูก popup blocker บล็อก)
  const found = findItemPdfInDriveIndex(trimmed);
  if (found) {
    const pdfUrl = `https://drive.google.com/file/d/${found.id}/view`;
    window.open(pdfUrl, '_blank', 'noopener,noreferrer');
    window.dispatchEvent(
      new CustomEvent('pdtrack:toast', {
        detail: {
          type: 'success',
          text: `เปิดไฟล์ PDF: ${found.name}`,
        },
      })
    );
    return;
  }

  // 2. ถ้าไม่พบในดัชนี ให้เปิดแท็บใหม่ทันทีขณะรับ user gesture (ป้องกันเบราว์เซอร์บล็อกป็อปอัปจากการเรียกแบบ async)
  const newTab = window.open('about:blank', '_blank');

  // ตรวจสอบกับ Local Server (เผื่อมีไฟล์ PDF เพิ่มใหม่สดๆ ในเครื่องที่ยังไม่ได้ build ดัชนี)
  try {
    const resp = await fetch(`/api/drive-pdf-search?code=${encodeURIComponent(trimmed)}`);
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.found && data.url) {
        if (newTab) {
          newTab.location.href = data.url;
        } else {
          window.open(data.url, '_blank', 'noopener,noreferrer');
        }
        window.dispatchEvent(
          new CustomEvent('pdtrack:toast', {
            detail: {
              type: 'success',
              text: `เปิดไฟล์ PDF: ${data.name}`,
            },
          })
        );
        return;
      }
    }
  } catch {
    // ข้ามไปค้นหาผ่าน Google Drive Search โดยตรง
  }

  // 3. หากยังไม่พบไฟล์ตรงในดัชนี ให้เปิดโฟลเดอร์ dwg โดยตรง พร้อมคัดลอกรหัสแบบลงคลิปบอร์ด
  // (ค้นหาเฉพาะในโฟลเดอร์ dwg ไม่ค้นหา Global ทั่ว Google Drive ตามที่กำหนด)
  const dwgFolderUrl = getSavedDwgFolderUrl() || DEFAULT_DWG_FOLDER_URL;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(hyphenated);
    } catch {
      // ignore clipboard error
    }
  }

  if (newTab) {
    newTab.location.href = dwgFolderUrl;
  } else {
    window.open(dwgFolderUrl, '_blank', 'noopener,noreferrer');
  }

  window.dispatchEvent(
    new CustomEvent('pdtrack:toast', {
      detail: {
        type: 'warning',
        text: `ไม่พบไฟล์แบบ PDF สำหรับรหัส "${hyphenated}" จึงเปิดโฟลเดอร์ dwg ให้แทน (คัดลอกรหัสลงคลิปบอร์ดแล้ว)`,
      },
    })
  );
}


