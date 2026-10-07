import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  ArrowRight, 
  Check, 
  CheckCircle2,
  AlertTriangle, 
  Layers, 
  Cpu, 
  FileText,
  Building2,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { DeliveryItem } from '../types';
import { 
  formatCompactDate, 
  formatThaiDate, 
  formatThaiDayOfWeek,
  parseDate, 
  formatDateToInput, 
  formatInputToCompact,
  addDaysToDate,
  extractCustomer 
} from '../utils/dateUtils';

interface EditTargetModalProps {
  isOpen: boolean;
  item: DeliveryItem | null;
  onClose: () => void;
  onSave: (item: DeliveryItem, newDate: string, remark?: string) => Promise<void> | void;
  onConfirmDelivery?: (
    item: DeliveryItem,
    confirmed: boolean,
    extra?: { newTargetDate?: string; remark?: string }
  ) => Promise<void> | void;
}

export const EditTargetModal: React.FC<EditTargetModalProps> = ({
  isOpen,
  item,
  onClose,
  onSave,
  onConfirmDelivery,
}) => {
  const [dateTextInput, setDateTextInput] = useState<string>(''); // d/m/y format e.g. "6/10/26"
  const [newDateInput, setNewDateInput] = useState<string>(''); // YYYY-MM-DD for native picker
  const [remarkInput, setRemarkInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const datePickerRef = useRef<HTMLInputElement>(null);

  const handleOpenCalendar = () => {
    if (datePickerRef.current) {
      try {
        if ('showPicker' in HTMLInputElement.prototype) {
          datePickerRef.current.showPicker();
          return;
        }
      } catch (err) {
        console.warn('showPicker error, fallback to focus/click', err);
      }
      try {
        datePickerRef.current.focus();
        datePickerRef.current.click();
      } catch (err) {
        console.warn('Fallback click error', err);
      }
    }
  };

  useEffect(() => {
    if (item && isOpen) {
      const initialDate = item.targetLatest || item.target1 || '';
      const compact = formatCompactDate(initialDate);
      setDateTextInput(compact === '-' ? '' : compact);
      setNewDateInput(formatDateToInput(initialDate));
      setRemarkInput(item.remark || '');
      setErrorMessage('');
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const currentFormatted = item.targetLatest ? formatCompactDate(item.targetLatest) : 'ยังไม่ระบุ';
  const newCompactDate = dateTextInput ? formatCompactDate(dateTextInput) : '';
  const newParsed = parseDate(dateTextInput);

  // Handle direct text typing in d/m/y format (e.g. 6/10/26)
  const handleDateTextChange = (val: string) => {
    setDateTextInput(val);
    const parsed = parseDate(val);
    if (parsed) {
      setNewDateInput(formatDateToInput(parsed));
      setErrorMessage('');
    }
  };

  // Handle calendar picker selection
  const handlePickerChange = (pickerVal: string) => {
    setNewDateInput(pickerVal);
    const compact = formatInputToCompact(pickerVal);
    setDateTextInput(compact);
    setErrorMessage('');
  };

  // Quick adjust helper
  const handleQuickAddDays = (days: number) => {
    const baseDate = parseDate(dateTextInput) || parseDate(item.targetLatest) || new Date();
    const nextFormatted = addDaysToDate(baseDate, days);
    setDateTextInput(nextFormatted);
    setNewDateInput(formatDateToInput(nextFormatted));
    setErrorMessage('');
  };

  const isAlreadyClosed = Boolean(item && (item.closed === '*' || item.status === 'ส่งแล้ว'));

  const handleMarkDelivered = async () => {
    if (!item) return;

    let nextConfirmed = true;
    if (isAlreadyClosed) {
      const confirmRemove = window.confirm(
        'รายการนี้ทำเครื่องหมาย * (ส่งงานแล้ว) อยู่แล้ว\n\nต้องการยกเลิกสถานะส่งงาน (นำเครื่องหมาย * ออก) หรือไม่?'
      );
      if (!confirmRemove) {
        return;
      }
      nextConfirmed = false;
    }

    setIsSaving(true);
    setErrorMessage('');
    try {
      const parsed = parseDate(dateTextInput) || parseDate(newDateInput);
      const compactDate = parsed ? formatCompactDate(parsed) : undefined;

      if (onConfirmDelivery) {
        await onConfirmDelivery(item, nextConfirmed, {
          newTargetDate: compactDate,
          remark: remarkInput.trim() || undefined,
        });
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'เกิดข้อผิดพลาดในการบันทึกส่งงาน');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseDate(dateTextInput) || parseDate(newDateInput);
    if (!parsed) {
      setErrorMessage('กรุณาระบุวันที่เป้าหมายใหม่ให้ถูกต้อง เช่น 6/10/26 หรือเลือกจากปฏิทิน');
      return;
    }
    const compactDate = formatCompactDate(parsed);

    setIsSaving(true);
    setErrorMessage('');
    try {
      await onSave(item, compactDate, remarkInput.trim());
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-700 via-sky-800 to-indigo-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/30 text-white border border-sky-400/30">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base tracking-tight">แก้ไขเป้าหมายส่งมอบ</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-amber-950">
                  EDIT MODE
                </span>
              </div>
              <p className="text-xs text-sky-200 mt-0.5">
                แผ่นส่งจะขยับเปลี่ยนวันที่ทันที และอัปเดตลง Google Sheet
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-sky-200 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-4">
          
          {/* Item Details Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-slate-800 text-sm bg-white px-2 py-0.5 rounded border border-slate-200">
                {item.itemCode || '-'}
              </span>
              <div className="flex items-center gap-1.5">
                {isAlreadyClosed && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    ส่งงานแล้ว (Closed: *)
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  item.workTag === 'Project'
                    ? 'bg-purple-100 text-purple-800'
                    : item.workTag === 'Service Purchase'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-sky-100 text-sky-800'
                }`}>
                  {item.workTag || 'Service'}
                </span>
              </div>
            </div>

            <div className="font-semibold text-slate-900 line-clamp-2">
              {item.itemName}
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1 border-t border-slate-200/70">
              <div className="flex items-center gap-1.5 truncate">
                <Cpu className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate" title={item.machineName}>
                  {item.machineName || '(ไม่ระบุเอกสาร 04)'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 truncate">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate" title={item.projectName}>
                  {item.customer || extractCustomer(item.projectName)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>Ref: {item.docRef || '-'}</span>
              <span>PD: <strong className="font-mono text-slate-800">{item.prodOrder || '-'}</strong></span>
              <span>จำนวน: <strong className="text-slate-800">{item.qty}</strong></span>
            </div>
          </div>

          {/* Current Target vs Milestone History */}
          <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sky-900 font-medium">เป้าหมายส่งมอบปัจจุบัน (Column S):</span>
              <span className="font-mono font-bold text-sky-900 text-sm bg-white px-2 py-0.5 rounded border border-sky-300">
                {currentFormatted}
              </span>
            </div>

            {/* Target 1-5 Milestone Chain */}
            <div className="text-[11px] text-slate-600 pt-1 flex items-center gap-1 flex-wrap font-mono">
              <span className="text-slate-400 text-[10px]">ประวัติเดิม:</span>
              {item.target1 && <span className={item.target2 ? 'line-through text-slate-400' : 'text-slate-700 font-semibold'}>{formatCompactDate(item.target1)}</span>}
              {item.target2 && <>
                <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                <span className={item.target3 ? 'line-through text-slate-400' : 'text-purple-700 font-semibold'}>{formatCompactDate(item.target2)}</span>
              </>}
              {item.target3 && <>
                <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                <span className={item.target4 ? 'line-through text-slate-400' : 'text-purple-700 font-semibold'}>{formatCompactDate(item.target3)}</span>
              </>}
              {item.target4 && <>
                <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                <span className={item.target5 ? 'line-through text-slate-400' : 'text-purple-700 font-semibold'}>{formatCompactDate(item.target4)}</span>
              </>}
              {item.target5 && <>
                <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                <span className={item.target5 ? 'text-purple-700 font-semibold' : 'text-purple-700 font-semibold'}>{formatCompactDate(item.target5)}</span>
              </>}
            </div>
          </div>

          {/* New Target Date Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>กำหนดวันที่เป้าหมายส่งมอบใหม่ (Column S):</span>
              </label>
              {newParsed && (
                <span className="text-sky-700 font-medium text-[11px]">
                  {formatThaiDate(dateTextInput)} ({formatThaiDayOfWeek(dateTextInput)})
                </span>
              )}
            </div>

            {/* Input with Calendar picker button */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  required
                  value={dateTextInput}
                  onChange={(e) => handleDateTextChange(e.target.value)}
                  placeholder="เช่น 6/10/26"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 font-bold outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 transition"
                />
              </div>

              {/* Native Calendar Picker Button with showPicker API */}
              <div className="relative shrink-0">
                <input
                  ref={datePickerRef}
                  type="date"
                  value={newDateInput}
                  onChange={(e) => handlePickerChange(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
                  tabIndex={-1}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={handleOpenCalendar}
                  className="px-3.5 py-2.5 bg-sky-50 hover:bg-sky-100 active:bg-sky-200 text-sky-700 border border-sky-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs hover:shadow-xs active:scale-95"
                  title="คลิกเพื่อเลือกวันที่จากปฏิทิน"
                >
                  <Calendar className="w-4 h-4 text-sky-600" />
                  <span>เลือกปฏิทิน</span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 flex items-center justify-between">
              <span>* รูปแบบ <strong>d/m/y</strong> เช่น <strong>6/10/26</strong> หรือเลือกปฏิทิน (อัปเดตลง <strong>Column S</strong> ในชีต)</span>
              {newParsed && (
                <span className="text-emerald-700 font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  เป้าหมาย: {formatCompactDate(dateTextInput)}
                </span>
              )}
            </p>

            {/* Quick date adjustment buttons */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[11px] text-slate-400 mr-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>ทางลัด:</span>
              </span>
              <button
                type="button"
                onClick={() => handleQuickAddDays(3)}
                className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer border border-slate-200"
              >
                +3 วัน
              </button>
              <button
                type="button"
                onClick={() => handleQuickAddDays(7)}
                className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer border border-slate-200"
              >
                +7 วัน (1 สัปดาห์)
              </button>
              <button
                type="button"
                onClick={() => handleQuickAddDays(14)}
                className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer border border-slate-200"
              >
                +14 วัน (2 สัปดาห์)
              </button>
              <button
                type="button"
                onClick={() => handleQuickAddDays(30)}
                className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer border border-slate-200"
              >
                +1 เดือน
              </button>
            </div>
          </div>

          {/* Shift Preview Pill */}
          {newCompactDate && newCompactDate !== currentFormatted && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  เลื่อนจาก <strong className="font-mono">{currentFormatted}</strong> → เป็น <strong className="font-mono text-emerald-700">{newCompactDate}</strong>
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                แผ่นส่งจะย้ายวันทันที
              </span>
            </div>
          )}

          {/* Remark / Note Input */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              หมายเหตุ / สาเหตุการเลื่อนเป้า (Remark):
            </label>
            <input
              type="text"
              value={remarkInput}
              onChange={(e) => setRemarkInput(e.target.value)}
              placeholder="ระบุสาเหตุหรือหมายเหตุปลายทาง (ถ้ามี)..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 outline-none focus:border-sky-500 focus:bg-white"
            />
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
            {/* ด้านล่างซ้าย: ปุ่มส่งงานแล้ว */}
            <button
              type="button"
              onClick={handleMarkDelivered}
              disabled={isSaving}
              className={`px-4 py-2 text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50 ${
                isAlreadyClosed
                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
              title="ทำเครื่องหมาย * ที่ Column Closed และเปลี่ยนสถานะเป็นส่งงานแล้ว"
            >
              <CheckCircle2 className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
              <span>ส่งงานแล้ว</span>
              {isAlreadyClosed && (
                <span className="text-[10px] bg-emerald-900/60 text-white px-1.5 py-0.5 rounded font-mono font-bold">
                  *
                </span>
              )}
            </button>

            {/* ด้านล่างขวา: ปุ่มยกเลิก และ บันทึกเป้าหมายใหม่ */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 active:scale-95 rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
                <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกเป้าหมายใหม่'}</span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
