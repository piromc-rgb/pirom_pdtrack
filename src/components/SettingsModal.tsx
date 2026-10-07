import React, { useState, useRef } from 'react';
import { 
  X, 
  Cog, 
  ExternalLink, 
  Check, 
  RefreshCw, 
  Database, 
  RotateCcw,
  AlertCircle,
  Link2,
  FileSpreadsheet,
  FolderUp,
  CloudDownload,
  CheckCircle2,
  FolderOpen,
  Edit3,
  Lock,
  KeyRound,
  Copy,
  Code
} from 'lucide-react';
import { 
  DEFAULT_SHEET_URL, 
  DEFAULT_PRODUCTION_URL,
  DEFAULT_SERVICE_PURCHASE_URL,
  DEFAULT_QC_URL,
  DEFAULT_OVERVIEW_URL,
  DEFAULT_OVERVIEW_FOLDER_URL,
  DEFAULT_OVERVIEW_APPS_SCRIPT_URL,
  DEFAULT_EDIT_PASSWORD,
  getSavedEditPassword,
  saveEditPassword,
  getSavedUpdateAppsScriptUrl,
  saveUpdateAppsScriptUrl,
  APPS_SCRIPT_UPDATE_CODE,
  clearAllOverrides,
  getItemOverrides,
  saveSheetUrl, 
  getSavedSheetUrl,
  saveProdUrl, 
  getSavedProdUrl,
  saveServicePurchaseUrl,
  getSavedServicePurchaseUrl,
  saveQcUrl, 
  getSavedQcUrl,
  saveOverviewUrl, 
  getSavedOverviewUrl,
  getSavedOverviewFilename,
  saveActiveOverviewData,
  parseOverviewExcel,
  parseOverviewJson,
  parseOverviewCsv,
  fetchOverviewFromAppsScript,
  autoSyncLatestOverview,
  autoSyncLatestPoPending,
  overviewStatusMap,
  DEFAULT_PO_PENDING_FOLDER_URL,
  getSavedPoPendingFolderUrl,
  savePoPendingFolderUrl,
  getActivePoPending,
  parsePoPendingExcel,
  saveActivePoPending
} from '../services/sheetService';
import {
  DEFAULT_DWG_FOLDER_URL,
  getSavedDwgFolderUrl,
  saveDwgFolderUrl,
  TOTAL_INDEXED_DWG_PDFS
} from '../utils/pdfFinder';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData: (newUrl?: string, newProdUrl?: string, newQcUrl?: string, newOverviewUrl?: string, newSpUrl?: string) => Promise<void>;
  lastSyncTime: string | null;
  isLive: boolean;
  totalItems: number;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onRefreshData,
  lastSyncTime,
  isLive,
  totalItems,
}) => {
  if (!isOpen) return null;

  const [sheetUrl, setSheetUrl] = useState(getSavedSheetUrl());
  const [prodUrl, setProdUrl] = useState(getSavedProdUrl());
  const [spUrl, setSpUrl] = useState(getSavedServicePurchaseUrl());
  const [qcUrl, setQcUrl] = useState(getSavedQcUrl());
  const [overviewUrl, setOverviewUrl] = useState(getSavedOverviewUrl());
  const [dwgFolderUrl, setDwgFolderUrl] = useState(getSavedDwgFolderUrl());
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // EDIT Mode & Google Sheet Update Settings
  const [editPassword, setEditPassword] = useState(getSavedEditPassword());
  const [updateAppsScriptUrl, setUpdateAppsScriptUrl] = useState(getSavedUpdateAppsScriptUrl());
  const [showAppsScriptCode, setShowAppsScriptCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [overrideCount, setOverrideCount] = useState(() => Object.keys(getItemOverrides()).length);

  // Overview Google Drive & File Selection States
  const [activeOverviewFilename, setActiveOverviewFilename] = useState(getSavedOverviewFilename());
  const [overviewPdCount, setOverviewPdCount] = useState(Object.keys(overviewStatusMap).length);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isSyncingDrive, setIsSyncingDrive] = useState(false);
  const [overviewMessage, setOverviewMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Report PO ค้างรับ (Purchase Data) States — ใช้หาเป้าส่งมอบงาน Service Purchase
  const [poFolderUrl, setPoFolderUrl] = useState(getSavedPoPendingFolderUrl());
  const [poInfo, setPoInfo] = useState(getActivePoPending());
  const [isProcessingPo, setIsProcessingPo] = useState(false);
  const [poMessage, setPoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const poFileInputRef = useRef<HTMLInputElement>(null);

  const handlePoAutoSync = async () => {
    setIsProcessingPo(true);
    setPoMessage(null);
    try {
      const data = await autoSyncLatestPoPending(true);
      if (!data) throw new Error('ไม่พบไฟล์ Report PO ค้างรับ ในโฟลเดอร์ Purchase Data (ต้องรันผ่าน dev server และมี Google Drive for desktop)');
      setPoInfo(data);
      setPoMessage({ type: 'success', text: `Scan พบไฟล์ล่าสุด "${data.fileName}" (${data.lines.length.toLocaleString()} รายการ)` });
      await onRefreshData(sheetUrl.trim(), prodUrl.trim(), qcUrl.trim(), overviewUrl.trim(), spUrl.trim());
    } catch (err: any) {
      setPoMessage({ type: 'error', text: err.message || 'เกิดข้อผิดพลาด' });
    } finally {
      setIsProcessingPo(false);
    }
  };

  const handlePoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingPo(true);
    setPoMessage(null);
    try {
      const data = parsePoPendingExcel(await file.arrayBuffer(), file.name);
      if (data.lines.length === 0) {
        throw new Error(`ไม่พบรายการ PO ค้างรับในไฟล์ "${file.name}"`);
      }
      saveActivePoPending(data);
      setPoInfo(data);
      setPoMessage({ type: 'success', text: `โหลด "${file.name}" สำเร็จ (${data.lines.length.toLocaleString()} รายการ PO ค้างรับ)` });
      await onRefreshData(sheetUrl.trim(), prodUrl.trim(), qcUrl.trim(), overviewUrl.trim(), spUrl.trim());
    } catch (err: any) {
      setPoMessage({ type: 'error', text: err.message || 'เกิดข้อผิดพลาดในการอ่านไฟล์' });
    } finally {
      setIsProcessingPo(false);
      if (poFileInputRef.current) poFileInputRef.current.value = '';
    }
  };

  // Handle local file selection (.xlsx, .xls, .json, .csv)
  const handleOverviewFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setOverviewMessage(null);

    try {
      let parsedResult;
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer();
        parsedResult = parseOverviewExcel(buffer);
      } else if (ext === 'json') {
        const text = await file.text();
        const jsonObj = JSON.parse(text);
        parsedResult = parseOverviewJson(jsonObj);
      } else if (ext === 'csv') {
        const text = await file.text();
        parsedResult = parseOverviewCsv(text);
      } else {
        throw new Error('รองรับเฉพาะไฟล์ .xlsx, .xls, .json หรือ .csv');
      }

      const pdCount = Object.keys(parsedResult.byPd).length;
      if (pdCount === 0) {
        throw new Error(`ไม่พบข้อมูล Production Order ในไฟล์ "${file.name}" กรุณาตรวจสอบแท็บ Data`);
      }

      saveActiveOverviewData(parsedResult, file.name);
      setActiveOverviewFilename(file.name);
      setOverviewPdCount(pdCount);
      setOverviewMessage({
        type: 'success',
        text: `โหลดข้อมูลจากไฟล์ "${file.name}" สำเร็จ (พบ ${pdCount.toLocaleString()} Production Orders)`
      });

      // Auto refresh data in main App
      await onRefreshData(sheetUrl.trim(), prodUrl.trim(), qcUrl.trim(), overviewUrl.trim());
    } catch (err: any) {
      setOverviewMessage({
        type: 'error',
        text: err.message || 'เกิดข้อผิดพลาดในการอ่านไฟล์'
      });
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle live cloud sync from Google Drive folder via Apps Script
  const handleSyncFromDriveFolder = async () => {
    setIsSyncingDrive(true);
    setOverviewMessage(null);

    try {
      // 1) scan โฟลเดอร์ Drive หาไฟล์ Status Overview ล่าสุดโดยตรง
      const latest = await autoSyncLatestOverview(true);
      if (latest) {
        setActiveOverviewFilename(latest.fileName);
        setOverviewPdCount(latest.pdCount);
        setOverviewMessage({
          type: 'success',
          text: `Scan พบไฟล์ล่าสุด "${latest.fileName}" และซิงค์สำเร็จ (พบ ${latest.pdCount.toLocaleString()} PDs)`
        });
        await onRefreshData(sheetUrl.trim(), prodUrl.trim(), qcUrl.trim(), overviewUrl.trim(), spUrl.trim());
        return;
      }
      // 2) สำรอง: Google Apps Script
      const res = await fetchOverviewFromAppsScript();
      const pdCount = Object.keys(res.byPd).length;
      if (pdCount === 0) {
        throw new Error('ไม่พบข้อมูลจาก Google Drive');
      }

      saveActiveOverviewData(res, res.fileName);
      setActiveOverviewFilename(res.fileName);
      setOverviewPdCount(pdCount);
      setOverviewMessage({
        type: 'success',
        text: `ซิงค์สดจาก Google Drive Folder สำเร็จ (${res.fileName}, พบ ${pdCount.toLocaleString()} PDs)`
      });

      // Refresh data
      await onRefreshData(sheetUrl.trim(), prodUrl.trim(), qcUrl.trim(), overviewUrl.trim());
    } catch (err: any) {
      setOverviewMessage({
        type: 'error',
        text: `ไม่สามารถซิงค์สด: ${err.message}`
      });
    } finally {
      setIsSyncingDrive(false);
    }
  };

  const handleSaveAndSync = async () => {
    setIsSaving(true);
    setErrorMessage('');
    setSaveSuccess(false);

    try {
      const trimmed1 = sheetUrl.trim();
      const trimmed2 = prodUrl.trim();
      const trimmedSp = spUrl.trim();
      const trimmed3 = qcUrl.trim();
      const trimmed4 = overviewUrl.trim();
      const trimmedDwg = dwgFolderUrl.trim();
      if (!trimmed1) {
        throw new Error('กรุณาระบุ URL ของ Google Sheet 1 (Check list ส่งมอบ)');
      }
      saveSheetUrl(trimmed1);
      if (trimmed2) {
        saveProdUrl(trimmed2);
      }
      if (trimmedSp) {
        saveServicePurchaseUrl(trimmedSp);
      }
      if (trimmed3) {
        saveQcUrl(trimmed3);
      }
      saveOverviewUrl(trimmed4);
      saveDwgFolderUrl(trimmedDwg || DEFAULT_DWG_FOLDER_URL);
      savePoPendingFolderUrl(poFolderUrl);
      saveEditPassword(editPassword);
      saveUpdateAppsScriptUrl(updateAppsScriptUrl);
      await onRefreshData(trimmed1, trimmed2, trimmed3, trimmed4, trimmedSp);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefault = () => {
    setSheetUrl(DEFAULT_SHEET_URL);
    setProdUrl(DEFAULT_PRODUCTION_URL);
    setSpUrl(DEFAULT_SERVICE_PURCHASE_URL);
    setQcUrl(DEFAULT_QC_URL);
    setOverviewUrl(DEFAULT_OVERVIEW_URL);
    setDwgFolderUrl(DEFAULT_DWG_FOLDER_URL);
    setEditPassword(DEFAULT_EDIT_PASSWORD);
    setUpdateAppsScriptUrl('');
    saveSheetUrl(DEFAULT_SHEET_URL);
    saveProdUrl(DEFAULT_PRODUCTION_URL);
    saveServicePurchaseUrl(DEFAULT_SERVICE_PURCHASE_URL);
    saveQcUrl(DEFAULT_QC_URL);
    saveOverviewUrl(DEFAULT_OVERVIEW_URL);
    saveDwgFolderUrl(DEFAULT_DWG_FOLDER_URL);
    saveEditPassword(DEFAULT_EDIT_PASSWORD);
    saveUpdateAppsScriptUrl('');
    setPoFolderUrl(DEFAULT_PO_PENDING_FOLDER_URL);
    savePoPendingFolderUrl(DEFAULT_PO_PENDING_FOLDER_URL);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">การเชื่อมต่อ Google Sheets, Google Drive & Location DWG</h3>
              <p className="text-xs text-slate-400">ผสาน Check list ส่งมอบ + Record ฝ่ายผลิต + ข้อมูล QC + Status Overview (Google Drive) + โฟลเดอร์ DWG (PDF)</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          
          {/* Status info */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">สถานะการเชื่อมต่อ:</span>
              <span className={`font-semibold flex items-center gap-1 ${isLive ? 'text-emerald-600' : 'text-amber-600'}`}>
                <Link2 className="w-3.5 h-3.5" />
                {isLive ? 'เชื่อมโยงข้อมูลสดทั้ง 4 แหล่ง + Location DWG อัตโนมัติ' : 'ใช้งานออฟไลน์/แคชสำรองที่เชื่อมโยงแล้ว'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">ซิงค์ล่าสุด:</span>
              <span className="font-medium text-slate-700">
                {lastSyncTime ? new Date(lastSyncTime).toLocaleString('th-TH') : 'ยังไม่ได้ทำการซิงค์'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">จำนวนรายการในระบบ / ไฟล์ DWG PDF:</span>
              <span className="font-semibold text-slate-800">
                {totalItems} รายการ • {TOTAL_INDEXED_DWG_PDFS.toLocaleString()} ไฟล์ PDF (รวมทุก Subfolder)
              </span>
            </div>
          </div>

          {/* URL 1 Input: Delivery Checklist */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                <span>ไฟล์ที่ 1: Check list ติดตามงานส่งมอบ (gid: 472754949)</span>
              </label>
              <a
                href={sheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-sky-600 hover:underline flex items-center gap-0.5"
              >
                <span>เปิดดู</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <textarea
              rows={2}
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              className="w-full p-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-sky-500 focus:bg-white"
              placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=472754949"
            />
          </div>

          {/* URL 2 Input: Production Register */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>ไฟล์ที่ 2: Record รับ - จ่าย Production (gid: 1308741309)</span>
              </label>
              <a
                href={prodUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-emerald-600 hover:underline flex items-center gap-0.5"
              >
                <span>เปิดดู</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <textarea
              rows={2}
              value={prodUrl}
              onChange={(e) => setProdUrl(e.target.value)}
              className="w-full p-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 focus:bg-white"
              placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=1308741309"
            />
          </div>

          {/* URL 3 Input: QC Checklist */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                <span>ไฟล์ที่ 3: ข้อมูลตรวจสอบคุณภาพ QC (gid: 1814251242)</span>
              </label>
              <a
                href={qcUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-purple-600 hover:underline flex items-center gap-0.5"
              >
                <span>เปิดดู</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <textarea
              rows={2}
              value={qcUrl}
              onChange={(e) => setQcUrl(e.target.value)}
              className="w-full p-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-purple-500 focus:bg-white"
              placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=1814251242"
            />
            <span className="text-[11px] text-slate-400 block">
              * หากเลขที่ PD No. ปรากฏในไฟล์นี้ ระบบจะถือว่าชิ้นงานผ่าน QC แล้วโดยอัตโนมัติ
            </span>
          </div>

          {/* URL: Service Purchase Sheet */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>ไฟล์: Sheet service purchase (gid: 1833136006)</span>
              </label>
              <a
                href={spUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-amber-600 hover:underline flex items-center gap-0.5"
              >
                <span>เปิดดู</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <textarea
              rows={2}
              value={spUrl}
              onChange={(e) => setSpUrl(e.target.value)}
              className="w-full p-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-amber-500 focus:bg-white"
              placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=1833136006"
            />
            <span className="text-[11px] text-slate-400 block">
              * ข้อมูลจัดซื้อ/จ้างบริการ (Service Purchase) โดยเลขที่เอกสาร 04 ดึงมาจากคอลัมน์ "เลขที่ใบ 04"
            </span>
          </div>

          {/* Report PO ค้างรับ (Purchase Data) — เป้าส่งมอบงาน Service Purchase */}
          <div className="p-3.5 rounded-xl border border-teal-200/90 bg-teal-50/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
                <span>Report PO ค้างรับ: โฟลเดอร์ Purchase Data (เป้าส่งมอบงาน Service Purchase)</span>
              </label>
              <a
                href={poFolderUrl.trim() || DEFAULT_PO_PENDING_FOLDER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-teal-700 hover:underline flex items-center gap-0.5"
              >
                <span>เปิดดูโฟลเดอร์</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <textarea
              rows={2}
              value={poFolderUrl}
              onChange={(e) => setPoFolderUrl(e.target.value)}
              className="w-full p-2.5 text-xs font-mono bg-white border border-slate-200 rounded-lg outline-none focus:border-teal-500"
              placeholder="https://drive.google.com/drive/folders/1z4qVl5Iikwd1PTQSdwo0Et_nIk9VMTGS"
            />

            <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-teal-200 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="truncate">
                  <span className="text-slate-400 text-[10px] block">ไฟล์ Report PO ค้างรับ ที่ใช้งานอยู่ (ใหม่ที่สุด):</span>
                  <span className="font-bold text-slate-800 truncate block">{poInfo.fileName}</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0 ml-2">
                {poInfo.lines.length.toLocaleString()} รายการ
              </span>
            </div>

            {poMessage && (
              <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                poMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {poMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{poMessage.text}</span>
              </div>
            )}

            <input
              type="file"
              ref={poFileInputRef}
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handlePoFileSelect}
            />
            <button
              type="button"
              onClick={handlePoAutoSync}
              disabled={isProcessingPo}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <CloudDownload className={`w-3.5 h-3.5 ${isProcessingPo ? 'animate-bounce' : ''}`} />
              <span>Scan หาไฟล์ล่าสุดและซิงค์อัตโนมัติ</span>
            </button>
            <button
              type="button"
              onClick={() => poFileInputRef.current?.click()}
              disabled={isProcessingPo}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <FolderUp className="w-3.5 h-3.5" />
              <span>{isProcessingPo ? 'กำลังอ่านไฟล์...' : 'หรือเลือกไฟล์ Report PO ค้างรับ (.xlsx) เอง'}</span>
            </button>
            <span className="text-[11px] text-slate-500 block">
              * งาน Service Purchase: เป้าส่งมอบ = วันที่รับของ (Confirmed Receipt Date ถ้ามี ไม่เช่นนั้น Planned Receipt Date) ของเลข PO/PR ในไฟล์ล่าสุด · หากไม่พบ PO ในรายงาน ถือว่า "ส่งแล้ว" · ข้อมูลเริ่มต้นอัปเดตด้วย scripts/update_po_pending.py
            </span>
          </div>

          {/* Section 4: Status Overview from Google Drive Folder */}
          <div className="p-3.5 rounded-xl border border-amber-200/90 bg-amber-50/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>ไฟล์ที่ 4: ข้อมูล Status Overview ฝ่ายผลิต (Production Order Status)</span>
              </label>
              <a
                href={DEFAULT_OVERVIEW_FOLDER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-amber-700 hover:text-amber-900 hover:underline flex items-center gap-1 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-md transition"
                title="เปิดโฟลเดอร์ Google Drive ในแท็บใหม่"
              >
                <span>เปิดโฟลเดอร์ Google Drive</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="text-[11px] text-slate-600 leading-relaxed">
              โฟลเดอร์ Google Drive: <a href={DEFAULT_OVERVIEW_FOLDER_URL} target="_blank" rel="noopener noreferrer" className="font-mono text-amber-700 underline font-semibold">staus overview (1Yt8drFmq0END9fAEWUy0No6sZ76H1dtA)</a>
              <span className="block text-slate-500 text-[10px] mt-0.5">
                เลือกไฟล์ .xlsx สดประจำสัปดาห์ (เช่น Week 40... หรือ LN Status Overview) จากโฟลเดอร์ Google Drive ด้านบน
              </span>
            </div>

            {/* Active Overview Card */}
            <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-amber-200 shadow-2xs text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="truncate">
                  <span className="text-slate-400 text-[10px] block">ไฟล์/ฐานข้อมูล Overview ที่ใช้งานอยู่:</span>
                  <span className="font-bold text-slate-800 truncate block">{activeOverviewFilename}</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0 ml-2">
                {overviewPdCount.toLocaleString()} PDs
              </span>
            </div>

            {/* Overview Alerts */}
            {overviewMessage && (
              <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                overviewMessage.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {overviewMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{overviewMessage.text}</span>
              </div>
            )}

            {/* Action Buttons: Pick File & Cloud Sync */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx,.xls,.csv,.json"
                  className="hidden"
                  onChange={handleOverviewFileSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingFile}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                  title="เลือกไฟล์ Status Overview (.xlsx / .csv / .json) จากเครื่องหรือ Google Drive"
                >
                  <FolderUp className="w-3.5 h-3.5" />
                  <span>{isProcessingFile ? 'กำลังอ่านไฟล์...' : 'เลือกไฟล์ .xlsx จาก Google Drive'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleSyncFromDriveFolder}
                disabled={isSyncingDrive}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                title="ซิงค์ข้อมูลล่าสุดจาก Google Drive Folder อัตโนมัติ"
              >
                <CloudDownload className={`w-3.5 h-3.5 ${isSyncingDrive ? 'animate-bounce' : ''}`} />
                <span>{isSyncingDrive ? 'กำลังดึงจาก Google Drive...' : 'Scan หาไฟล์ล่าสุดจากโฟลเดอร์ & ซิงค์'}</span>
              </button>
            </div>

            {/* Alternative: Google Sheet URL Input */}
            <div className="pt-1.5">
              <span className="text-[10px] text-slate-500 block mb-1">
                หรือระบุลิงก์ Google Sheet / ลิงก์ไฟล์ใน Google Drive โดยตรง:
              </span>
              <textarea
                rows={2}
                value={overviewUrl}
                onChange={(e) => setOverviewUrl(e.target.value)}
                className="w-full p-2 text-xs font-mono bg-white border border-slate-200 rounded-lg outline-none focus:border-amber-500 focus:bg-white"
                placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=... หรือลิงก์ไฟล์ Google Drive"
              />
            </div>
          </div>

          {/* URL 5 Input: Location DWG (Google Drive Folder) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span>Location DWG: โฟลเดอร์เก็บแบบงาน PDF ใน Google Drive (รวมทุก Subfolder)</span>
              </label>
              <a
                href={dwgFolderUrl.trim() || DEFAULT_DWG_FOLDER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-rose-600 hover:underline flex items-center gap-0.5"
              >
                <span>เปิดดูโฟลเดอร์</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <textarea
              rows={2}
              value={dwgFolderUrl}
              onChange={(e) => setDwgFolderUrl(e.target.value)}
              className="w-full p-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-rose-500 focus:bg-white"
              placeholder="https://drive.google.com/open?id=1M-QDPilC7Nn-YW_5YxLQITUS6ZOYEyFm&usp=drive_copy"
            />
            <span className="text-[11px] text-slate-400 block">
              * เมื่อ Double Click ที่เลข Item ในตาราง ระบบจะค้นหาไฟล์ PDF ที่มีรหัสแบบมีขีดคั่น (เช่น J131012-Z-38-1-D-00) จากโฟลเดอร์นี้และทุก Subfolder ({TOTAL_INDEXED_DWG_PDFS.toLocaleString()} ไฟล์)
            </span>
          </div>

          {/* Section: EDIT Mode & Google Sheet Update */}
          <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>โหมดแก้ไข (EDIT Mode) & การอัปเดต Google Sheet</span>
              </label>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                รหัสผ่านเริ่มต้น: 2211
              </span>
            </div>

            {/* Password setting */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-700">รหัสผ่านสำหรับเข้าสู่โหมด EDIT:</span>
                {editPassword !== DEFAULT_EDIT_PASSWORD && (
                  <button
                    type="button"
                    onClick={() => setEditPassword(DEFAULT_EDIT_PASSWORD)}
                    className="text-[10px] text-amber-700 hover:underline cursor-pointer"
                  >
                    รีเซ็ตเป็นค่าเริ่มต้น
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="รหัสผ่าน"
                  className="w-36 p-2 text-xs font-mono bg-white border border-slate-300 rounded-lg outline-none focus:border-amber-500 font-bold"
                />
                <span className="text-[11px] text-slate-500">
                  (ระบบจะถามรหัสผ่านนี้เมื่อผู้ใช้กดปุ่มสลับเข้าสู่โหมด EDIT)
                </span>
              </div>
            </div>

            {/* Apps Script Update URL */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-700">URL ของ Google Apps Script สำหรับบันทึกข้อมูลลง Google Sheet:</span>
                <button
                  type="button"
                  onClick={() => setShowAppsScriptCode(!showAppsScriptCode)}
                  className="text-[11px] text-blue-700 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>{showAppsScriptCode ? 'ซ่อนโค้ด Apps Script' : 'ดูโค้ด Apps Script สำหรับติดตั้งใน Sheet'}</span>
                </button>
              </div>
              <textarea
                rows={2}
                value={updateAppsScriptUrl}
                onChange={(e) => setUpdateAppsScriptUrl(e.target.value)}
                className="w-full p-2.5 text-xs font-mono bg-white border border-slate-300 rounded-lg outline-none focus:border-amber-500"
                placeholder="https://script.google.com/macros/s/AKfycb.../exec (เว้นว่างไว้เพื่อบันทึกแคชในเครื่อง)"
              />
              <span className="text-[10px] text-slate-500 block">
                * เมื่อแก้ไขเป้าหมาย หรือ Confirm ส่งมอบ ระบบจะส่งข้อมูลไปบันทึกที่ Google Sheet ผ่าน URL นี้ทันที
              </span>
            </div>

            {/* Apps Script Code Modal / Expander */}
            {showAppsScriptCode && (
              <div className="bg-slate-900 rounded-xl p-3 text-slate-200 space-y-2 border border-slate-700 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-400 flex items-center gap-1.5">
                    <Code className="w-4 h-4" />
                    <span>โค้ด Google Apps Script (Update Code.gs)</span>
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(APPS_SCRIPT_UPDATE_CODE);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 3000);
                    }}
                    className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'คัดลอกแล้ว!' : 'คัดลอกโค้ด'}</span>
                  </button>
                </div>
                <pre className="text-[10px] font-mono max-h-48 overflow-y-auto bg-slate-950 p-2.5 rounded-lg text-emerald-400">
                  {APPS_SCRIPT_UPDATE_CODE}
                </pre>
                <p className="text-[10px] text-slate-400">
                  วิธีติดตั้ง: ไปที่ Google Sheet ของคุณ $\rightarrow$ Extensions $\rightarrow$ Apps Script $\rightarrow$ วางโค้ด $\rightarrow$ กด Deploy as Web App (Anyone) $\rightarrow$ นำ URL มาใส่ในช่องด้านบน
                </p>
              </div>
            )}

            {/* Overrides indicator */}
            {overrideCount > 0 && (
              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-600 border-t border-amber-200/60">
                <span>มีรายการที่ถูกแก้ไขหรือ Confirm ในเครื่อง: <strong className="text-amber-800">{overrideCount}</strong> รายการ</span>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('ต้องการล้างประวัติการแก้ไขและ Confirm ในเครื่องทั้งหมดใช่หรือไม่?')) {
                      clearAllOverrides();
                      setOverrideCount(0);
                    }
                  }}
                  className="text-rose-600 hover:underline cursor-pointer"
                >
                  ล้างข้อมูลแก้ไขในเครื่อง
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500">
              * ระบบจะผสานข้อมูลส่งมอบ + ฝ่ายผลิต + สถานะ QC + Status Overview + Location DWG ให้อัตโนมัติ
            </span>
            <button
              onClick={handleResetDefault}
              className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium whitespace-nowrap ml-2 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>รีเซ็ตค่าเริ่มต้นทั้ง 5 ลิงก์</span>
            </button>
          </div>

          {/* Alerts */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>เชื่อมต่อและบันทึกข้อมูลทั้ง 4 แหล่งและ Location DWG เรียบร้อยแล้ว!</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSaveAndSync}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 active:scale-95 rounded-lg transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
            <span>{isSaving ? 'กำลังเชื่อมต่อและซิงค์ข้อมูล...' : 'บันทึก & ซิงค์ข้อมูล'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
