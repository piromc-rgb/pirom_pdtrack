import React, { useState } from 'react';
import { 
  X, 
  Cog, 
  ExternalLink, 
  Check, 
  RefreshCw, 
  Database, 
  RotateCcw,
  AlertCircle,
  Link2
} from 'lucide-react';
import { 
  DEFAULT_SHEET_URL, 
  DEFAULT_PRODUCTION_URL,
  DEFAULT_QC_URL,
  DEFAULT_OVERVIEW_URL,
  saveSheetUrl, 
  getSavedSheetUrl,
  saveProdUrl,
  getSavedProdUrl,
  saveQcUrl,
  getSavedQcUrl,
  saveOverviewUrl,
  getSavedOverviewUrl
} from '../services/sheetService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData: (newUrl?: string, newProdUrl?: string, newQcUrl?: string, newOverviewUrl?: string) => Promise<void>;
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
  const [qcUrl, setQcUrl] = useState(getSavedQcUrl());
  const [overviewUrl, setOverviewUrl] = useState(getSavedOverviewUrl());
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSaveAndSync = async () => {
    setIsSaving(true);
    setErrorMessage('');
    setSaveSuccess(false);

    try {
      const trimmed1 = sheetUrl.trim();
      const trimmed2 = prodUrl.trim();
      const trimmed3 = qcUrl.trim();
      const trimmed4 = overviewUrl.trim();
      if (!trimmed1) {
        throw new Error('กรุณาระบุ URL ของ Google Sheet 1 (Check list ส่งมอบ)');
      }
      saveSheetUrl(trimmed1);
      if (trimmed2) {
        saveProdUrl(trimmed2);
      }
      if (trimmed3) {
        saveQcUrl(trimmed3);
      }
      saveOverviewUrl(trimmed4);
      await onRefreshData(trimmed1, trimmed2, trimmed3, trimmed4);
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
    setQcUrl(DEFAULT_QC_URL);
    setOverviewUrl(DEFAULT_OVERVIEW_URL);
    saveSheetUrl(DEFAULT_SHEET_URL);
    saveProdUrl(DEFAULT_PRODUCTION_URL);
    saveQcUrl(DEFAULT_QC_URL);
    saveOverviewUrl(DEFAULT_OVERVIEW_URL);
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
              <h3 className="font-bold text-base text-white">การเชื่อมต่อ Google Sheets (Multi-Source Sync)</h3>
              <p className="text-xs text-slate-400">ผสาน Check list ส่งมอบ + Record ฝ่ายผลิต + ข้อมูล QC + Status Overview</p>
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
                {isLive ? 'เชื่อมโยง 4 สเปรดชีตสดแบบอัตโนมัติ' : 'ใช้งานออฟไลน์/แคชสำรองที่เชื่อมโยงแล้ว'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">ซิงค์ล่าสุด:</span>
              <span className="font-medium text-slate-700">
                {lastSyncTime ? new Date(lastSyncTime).toLocaleString('th-TH') : 'ยังไม่ได้ทำการซิงค์'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">จำนวนรายการในระบบ:</span>
              <span className="font-semibold text-slate-800">{totalItems} รายการ</span>
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

          {/* URL 4 Input: Status Overview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>ไฟล์ที่ 4: ข้อมูล Status Overview ฝ่ายผลิต (Production Order Status)</span>
              </label>
              {overviewUrl.trim() ? (
                <a
                  href={overviewUrl.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-amber-600 hover:underline flex items-center gap-0.5"
                >
                  <span>เปิดดู</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className="text-[10px] text-slate-400">ใช้ฐานข้อมูล Overview ล่าสุดในระบบ</span>
              )}
            </div>

            <textarea
              rows={2}
              value={overviewUrl}
              onChange={(e) => setOverviewUrl(e.target.value)}
              className="w-full p-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-amber-500 focus:bg-white"
              placeholder="https://docs.google.com/spreadsheets/d/.../edit?gid=... (สเปรดชีต Status Overview ฝ่ายผลิต)"
            />
            <span className="text-[11px] text-slate-400 block">
              * หากระบุลิงก์ ระบบจะดึงข้อมูลสถานะฝ่ายผลิตสด เช่น Completed, Active, Planned, Ready to Start
            </span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500">
              * ระบบจะผสานข้อมูลส่งมอบ + ฝ่ายผลิต + สถานะ QC + Status Overview จากทั้ง 4 ไฟล์ให้อัตโนมัติ
            </span>
            <button
              onClick={handleResetDefault}
              className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium whitespace-nowrap ml-2 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>รีเซ็ตค่าเริ่มต้นทั้ง 4 ลิงก์</span>
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
              <span>เชื่อมต่อและผสานข้อมูลทั้ง 4 สเปรดชีตเรียบร้อยแล้ว!</span>
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
