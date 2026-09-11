import React, { useState, useMemo } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  Copy, 
  Check, 
  ExternalLink, 
  Download, 
  Calendar, 
  ShieldCheck, 
  CheckCircle2, 
  Building2, 
  Boxes, 
  Sparkles,
  Code,
  HelpCircle,
  Clock,
  Layers
} from 'lucide-react';
import { DeliveryItem } from '../types';
import { 
  formatCompactDate, 
  formatThaiDayOfWeek,
  parseDate, 
  isDateOverdue, 
  isDateDueSoon,
  getDaysDiff,
  extractCustomer
} from '../utils/dateUtils';

interface GoogleSheetsExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: DeliveryItem[];
  initialSelectedDate?: string | null;
}

export const GoogleSheetsExportModal: React.FC<GoogleSheetsExportModalProps> = ({
  isOpen,
  onClose,
  items,
  initialSelectedDate = null,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'script'>('export');
  const [qcFilter, setQcFilter] = useState<'all' | 'qc-passed' | 'qc-pending'>('all');
  const [dateFilter, setDateFilter] = useState<string>(initialSelectedDate || 'all');
  const [copiedData, setCopiedData] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // Filter ONLY pending items (งานที่ยังไม่ส่ง)
  const pendingItems = useMemo(() => {
    return items.filter(item => item.status !== 'ส่งแล้ว');
  }, [items]);

  // Unique available target dates
  const availableDates = useMemo(() => {
    const dates = new Map<string, { dateStr: string; label: string; count: number }>();
    pendingItems.forEach(item => {
      const d = item.targetLatest || 'ยังไม่ระบุวันส่ง';
      const existing = dates.get(d);
      if (existing) {
        existing.count++;
      } else {
        dates.set(d, {
          dateStr: d,
          label: d === 'ยังไม่ระบุวันส่ง' ? d : `${formatCompactDate(d)} (${formatThaiDayOfWeek(d)})`,
          count: 1
        });
      }
    });

    return Array.from(dates.values()).sort((a, b) => {
      const da = parseDate(a.dateStr);
      const db = parseDate(b.dateStr);
      if (!da) return 1;
      if (!db) return -1;
      return da.getTime() - db.getTime();
    });
  }, [pendingItems]);

  // Apply filters
  const filteredItems = useMemo(() => {
    return pendingItems.filter(item => {
      if (qcFilter === 'qc-passed' && !item.isQcPassed) return false;
      if (qcFilter === 'qc-pending' && item.isQcPassed) return false;

      if (dateFilter !== 'all') {
        if (dateFilter === 'overdue-today') {
          const isOverdue = isDateOverdue(item.targetLatest);
          const isToday = getDaysDiff(item.targetLatest) === 0;
          if (!isOverdue && !isToday) return false;
        } else if (dateFilter === 'next-7-days') {
          const isDue = isDateDueSoon(item.targetLatest, 7);
          const isOver = isDateOverdue(item.targetLatest);
          if (!isDue && !isOver) return false;
        } else {
          if (item.targetLatest !== dateFilter) return false;
        }
      }

      return true;
    });
  }, [pendingItems, qcFilter, dateFilter]);

  // Group by Date, then sort by Customer -> Project -> Machine -> Item
  const exportDateGroups = useMemo(() => {
    interface Group {
      dateKey: string;
      parsedDate: Date | null;
      items: DeliveryItem[];
      totalQty: number;
      qcPassedCount: number;
    }

    const groups: Record<string, Group> = {};

    filteredItems.forEach(item => {
      const dateKey = item.targetLatest || 'ยังไม่ระบุวันส่ง';
      if (!groups[dateKey]) {
        groups[dateKey] = {
          dateKey,
          parsedDate: parseDate(item.targetLatest),
          items: [],
          totalQty: 0,
          qcPassedCount: 0,
        };
      }
      groups[dateKey].items.push(item);
      groups[dateKey].totalQty += item.qty;
      if (item.isQcPassed) groups[dateKey].qcPassedCount++;
    });

    const sorted = Object.values(groups).sort((a, b) => {
      if (!a.parsedDate) return 1;
      if (!b.parsedDate) return -1;
      return a.parsedDate.getTime() - b.parsedDate.getTime();
    });

    sorted.forEach(group => {
      group.items.sort((a, b) => {
        const custA = a.customer || extractCustomer(a.projectName);
        const custB = b.customer || extractCustomer(b.projectName);
        const custCmp = custA.localeCompare(custB, 'th');
        if (custCmp !== 0) return custCmp;

        const projCmp = (a.projectCode || '').localeCompare(b.projectCode || '');
        if (projCmp !== 0) return projCmp;

        const machCmp = (a.machineName || '').localeCompare(b.machineName || '');
        if (machCmp !== 0) return machCmp;

        return (a.itemCode || '').localeCompare(b.itemCode || '');
      });
    });

    return sorted;
  }, [filteredItems]);

  const totalItemsCount = filteredItems.length;
  const totalQtyCount = useMemo(() => filteredItems.reduce((acc, it) => acc + it.qty, 0), [filteredItems]);
  const totalQcPassedCount = useMemo(() => filteredItems.filter(it => it.isQcPassed).length, [filteredItems]);

  // 1-Click Copy Tab-Separated Values (TSV) for native Google Sheets pasting
  const handleCopyForGoogleSheets = async () => {
    const headers = [
      'ลำดับ',
      'วันที่ส่งมอบ (Target Date)',
      'ลูกค้า (Customer)',
      'เลขที่โครงการ (Project No)',
      'ชื่อโครงการ',
      'เลขที่เครื่องจักร (Machine)',
      'เลขที่ Item (Item Code)',
      'ชื่อ Item / รายละเอียดชิ้นงาน',
      'จำนวน (Qty)',
      'Production Order (PD)',
      'สถานะผ่าน QC (QC Status)',
      'วันที่ตรวจ QC',
      'ผู้ตรวจสอบ QC',
      'หมายเหตุ / ปลายทาง'
    ];

    const tsvRows: string[] = [headers.join('\t')];
    let rowSeq = 1;

    exportDateGroups.forEach(group => {
      group.items.forEach(item => {
        const cust = item.customer || extractCustomer(item.projectName);
        const qcText = item.isQcPassed ? 'ผ่าน QC แล้ว' : 'รอตรวจ QC';
        tsvRows.push([
          String(rowSeq++),
          group.dateKey,
          cust,
          item.projectCode || '',
          item.projectName || '',
          item.machineName || '',
          item.itemCode || '',
          item.itemName || '',
          String(item.qty),
          item.prodOrder || '',
          qcText,
          item.qcDate || '',
          item.qcInspector || '',
          item.remark || ''
        ].join('\t'));
      });
    });

    const fullTsv = tsvRows.join('\n');
    try {
      await navigator.clipboard.writeText(fullTsv);
      setCopiedData(true);
      setTimeout(() => setCopiedData(false), 3500);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  // Open sheets.new in new tab
  const handleOpenGoogleSheetsNew = () => {
    window.open('https://sheets.new', '_blank', 'noopener,noreferrer');
  };

  // Export CSV formatted with UTF-8 BOM
  const handleDownloadCsv = () => {
    const headers = [
      'ลำดับ',
      'วันที่ส่งมอบ',
      'ลูกค้า',
      'เลขที่โครงการ',
      'ชื่อโครงการ',
      'เลขที่เครื่องจักร',
      'เลขที่ Item',
      'ชื่อ Item',
      'จำนวน',
      'Production Order',
      'สถานะ QC',
      'วันที่ตรวจ QC',
      'ผู้ตรวจ QC',
      'หมายเหตุ'
    ];

    const rows: string[][] = [];
    let rowSeq = 1;

    exportDateGroups.forEach(group => {
      group.items.forEach(item => {
        const cust = item.customer || extractCustomer(item.projectName);
        const qcText = item.isQcPassed ? 'ผ่าน QC แล้ว' : 'รอตรวจ QC';
        rows.push([
          String(rowSeq++),
          `"${group.dateKey}"`,
          `"${cust}"`,
          `"${item.projectCode}"`,
          `"${item.projectName.replace(/"/g, '""')}"`,
          `"${item.machineName}"`,
          `"${item.itemCode}"`,
          `"${item.itemName.replace(/"/g, '""')}"`,
          String(item.qty),
          `"${item.prodOrder}"`,
          `"${qcText}"`,
          `"${item.qcDate || ''}"`,
          `"${item.qcInspector || ''}"`,
          `"${item.remark.replace(/"/g, '""')}"`
        ]);
      });
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `GoogleSheets_Delivery_Plan_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Google Apps Script code snippet
  const appsScriptCode = `/**
 * Google Apps Script: สร้างชีต "แผนการส่งมอบ" อัตโนมัติ
 * ติดตั้ง: ใน Google Spreadsheet ของคุณ ไปที่เมนู "ส่วนขยาย" (Extensions) > "Apps Script"
 * วางโค้ดนี้แล้วกดปุ่ม "เรียกใช้" (Run) หรือตั้งเวลาให้รันทุกวัน
 */
function createDeliveryPlanSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. ดึงข้อมูลจากแท็บ "Check list ส่งมอบ"
  var sourceSheet = ss.getSheetByName('Check list ส่งมอบ') || ss.getSheets()[0];
  var data = sourceSheet.getDataRange().getValues();
  if (data.length < 2) {
    SpreadsheetApp.getUi().alert('ไม่พบข้อมูลในชีตหลัก');
    return;
  }
  
  // 2. ดึงข้อมูลจากแท็บ QC เพื่อตรวจสอบสถานะผ่าน QC
  var qcSheet = ss.getSheetByName('QC Checklist') || ss.getSheetByName('Sheet3');
  var qcPds = {};
  if (qcSheet) {
    var qcData = qcSheet.getDataRange().getValues();
    for (var q = 1; q < qcData.length; q++) {
      var pdVal = String(qcData[q][5] || '').trim().toUpperCase();
      var matches = pdVal.match(/PD\\d+/gi);
      if (matches) {
        matches.forEach(function(p) { qcPds[p.toUpperCase()] = true; });
      }
    }
  }

  // 3. กำหนดหัวตารางของชีต "แผนการส่งมอบ"
  var newHeaders = [
    'ลำดับ',
    'วันที่เป้าหมายส่งมอบ',
    'ลูกค้า (Customer)',
    'เลขที่โครงการ',
    'ชื่อโครงการ',
    'ชื่อเครื่องจักร',
    'เลขที่ Item',
    'ชื่อ Item / รายละเอียด',
    'จำนวน',
    'Production Order (PD)',
    'สถานะผ่าน QC',
    'หมายเหตุ'
  ];

  var planRows = [];
  var seq = 1;

  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    var status = String(r[19] || '').trim(); // คอลัมน์สถานะ
    
    // กรองเฉพาะงานที่ยังไม่ส่ง (status !== 'ส่งแล้ว')
    if (status.indexOf('ส่งแล้ว') === -1) {
      var targetDate = String(r[16] || r[15] || r[14] || r[13] || r[12] || r[11] || 'ยังไม่ระบุวันส่ง');
      var projCode = String(r[1] || '');
      var projName = String(r[2] || '');
      var machine = String(r[4] || '(ไม่ระบุ)');
      var itemCode = String(r[5] || '');
      var itemName = String(r[6] || '');
      var qty = Number(r[7]) || 1;
      var prodOrder = String(r[8] || '');
      var remark = String(r[18] || '');

      // ดึงชื่อลูกค้าแบบย่อ
      var customer = projName.replace(/^(BDM|MA|SR|WM|SO|RS|TS)\\s+/i, '')
                             .replace(/\\s*(เริ่ม)?\\s*\\d{1,2}[\\/-]\\d{1,2}[\\/-]\\d{2,4}.*$/i, '')
                             .trim() || projName;

      // ตรวจสอบสถานะ QC
      var isQc = false;
      var pdMatches = prodOrder.match(/PD\\d+/gi);
      if (pdMatches) {
        isQc = pdMatches.some(function(p) { return qcPds[p.toUpperCase()]; });
      }

      planRows.push({
        date: targetDate,
        customer: customer,
        projCode: projCode,
        projName: projName,
        machine: machine,
        itemCode: itemCode,
        itemName: itemName,
        qty: qty,
        prodOrder: prodOrder,
        qcStatus: isQc ? '✅ ผ่าน QC แล้ว' : '⏳ รอตรวจ QC',
        remark: remark
      });
    }
  }

  // เรียงลำดับตาม: วันที่ส่งมอบ -> ลูกค้า -> โครงการ -> เครื่องจักร -> เลขที่ Item
  planRows.sort(function(a, b) {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.customer !== b.customer) return a.customer.localeCompare(b.customer);
    if (a.projCode !== b.projCode) return a.projCode.localeCompare(b.projCode);
    return a.machine.localeCompare(b.machine);
  });

  // 4. สร้างหรืออัปเดตชีต "แผนการส่งมอบ"
  var targetSheet = ss.getSheetByName('แผนการส่งมอบ');
  if (targetSheet) {
    targetSheet.clear();
  } else {
    targetSheet = ss.insertSheet('แผนการส่งมอบ');
  }

  // ใส่หัวตาราง
  targetSheet.appendRow(newHeaders);
  var headerRange = targetSheet.getRange(1, 1, 1, newHeaders.length);
  headerRange.setBackground('#0f766e').setFontColor('#ffffff').setFontWeight('bold');

  // ใส่แถวข้อมูล
  var finalData = planRows.map(function(row, idx) {
    return [
      idx + 1,
      row.date,
      row.customer,
      row.projCode,
      row.projName,
      row.machine,
      row.itemCode,
      row.itemName,
      row.qty,
      row.prodOrder,
      row.qcStatus,
      row.remark
    ];
  });

  if (finalData.length > 0) {
    targetSheet.getRange(2, 1, finalData.length, newHeaders.length).setValues(finalData);
    targetSheet.autoResizeColumns(1, newHeaders.length);
  }

  SpreadsheetApp.getUi().alert('สร้างชีต "แผนการส่งมอบ" เรียบร้อยแล้ว! (' + finalData.length + ' รายการ)');
}`;

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(appsScriptCode);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 3500);
    } catch (err) {
      console.error('Failed to copy script', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden">
        
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white p-4 sm:p-6 flex-shrink-0 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight">
                  แผนส่งมอบในรูปแบบ Google Sheets
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 font-semibold border border-emerald-400/30">
                  Google Sheet Integration
                </span>
              </div>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                ส่งออกข้อมูลไปยัง Google Sheets ด้วย 1 คลิก หรือนำโค้ดไปสร้างแท็บแผนส่งมอบในสเปรดชีตหลัก
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-emerald-200 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('export')}
            className={`py-3 px-4 font-semibold text-xs sm:text-sm border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'export'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>คัดลอก & เปิดใน Google Sheets ทันที (1-Click)</span>
          </button>
          <button
            onClick={() => setActiveTab('script')}
            className={`py-3 px-4 font-semibold text-xs sm:text-sm border-b-2 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'script'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Code className="w-4 h-4" />
            <span>โค้ดสร้างชีตอัตโนมัติในสเปรดชีตหลัก (Apps Script)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* TAB 1: 1-Click Export & Open */}
          {activeTab === 'export' && (
            <div className="space-y-5">
              
              {/* Filter controls */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* QC Filter */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>เลือกเงื่อนไขสถานะ QC:</span>
                  </label>
                  <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-lg border border-slate-300">
                    <button
                      type="button"
                      onClick={() => setQcFilter('all')}
                      className={`py-1.5 px-2 rounded-md font-semibold transition text-center ${
                        qcFilter === 'all'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      งานรอส่งทั้งหมด ({pendingItems.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setQcFilter('qc-passed')}
                      className={`py-1.5 px-2 rounded-md font-semibold transition text-center flex items-center justify-center gap-1 ${
                        qcFilter === 'qc-passed'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>เฉพาะผ่าน QC ({pendingItems.filter(it => it.isQcPassed).length})</span>
                    </button>
                  </div>
                </div>

                {/* Date Filter */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span>เลือกช่วงวันที่ส่งมอบ:</span>
                  </label>
                  <select
                    value={dateFilter}
                    onChange={e => setDateFilter(e.target.value)}
                    className="w-full py-2 px-3 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="all">ทุกวันที่มีกำหนดส่ง ({pendingItems.length} รายการ)</option>
                    <option value="overdue-today">🚨 เลยกำหนด + วันนี้</option>
                    <option value="next-7-days">📅 ภายใน 7 วันข้างหน้า</option>
                    <optgroup label="เลือกเฉพาะวันที่">
                      {availableDates.map(d => (
                        <option key={d.dateStr} value={d.dateStr}>
                          {d.label} ({d.count} รายการ)
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* Data Summary Pill */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between flex-wrap gap-3 text-xs text-emerald-900">
                <div className="flex items-center gap-4 flex-wrap font-medium">
                  <span><strong>จำนวนวัน:</strong> {exportDateGroups.length} วัน</span>
                  <span>• <strong>จำนวนรายการ:</strong> {totalItemsCount} รายการ</span>
                  <span>• <strong>จำนวนชิ้นงานรวม:</strong> {totalQtyCount.toLocaleString()} ชิ้น</span>
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>ผ่าน QC แล้ว: {totalQcPassedCount} รายการ</span>
                  </span>
                </div>
                <div className="text-slate-500 text-[11px]">
                  จัดเรียง: วันที่ $\rightarrow$ ลูกค้า $\rightarrow$ โครงการ $\rightarrow$ เครื่องจักร $\rightarrow$ Item
                </div>
              </div>

              {/* Main Action Buttons for Google Sheets */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Copy for Google Sheets */}
                <button
                  type="button"
                  onClick={handleCopyForGoogleSheets}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition shadow-md active:scale-98 cursor-pointer ${
                    copiedData
                      ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-400'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
                    {copiedData ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    <span>{copiedData ? 'คัดลอกลงคลิปบอร์ดแล้ว!' : '1. คัดลอกตาราง (Copy)'}</span>
                  </div>
                  <span className="text-[11px] opacity-90 mt-1">
                    {copiedData ? 'พร้อมกด Ctrl+V ใน Google Sheets' : 'คัดลอกตารางพร้อมหัวคอลัมน์ภาษาไทย'}
                  </span>
                </button>

                {/* 2. Open Google Sheets New */}
                <button
                  type="button"
                  onClick={handleOpenGoogleSheetsNew}
                  className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-center transition shadow-sm active:scale-98 cursor-pointer hover:border-emerald-500"
                >
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-700">
                    <ExternalLink className="w-5 h-5" />
                    <span>2. เปิด Google Sheets (sheets.new)</span>
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1">
                    เปิดสเปรดชีตเปล่าใหม่ในแท็บถัดไป
                  </span>
                </button>

                {/* 3. Download CSV */}
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-center transition shadow-sm active:scale-98 cursor-pointer hover:border-blue-500"
                >
                  <div className="flex items-center gap-2 font-bold text-sm text-blue-700">
                    <Download className="w-5 h-5" />
                    <span>ดาวน์โหลดเป็นไฟล์ CSV</span>
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1">
                    รองรับภาษาไทย (UTF-8 with BOM)
                  </span>
                </button>
              </div>

              {/* 3-Step Simple Instructions */}
              <div className="bg-slate-100/80 rounded-xl p-4 border border-slate-200 text-xs text-slate-700 space-y-2">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>วิธีนำเข้าสู่ Google Sheets ใน 3 วินาที:</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <strong className="text-emerald-700 block mb-1">ขั้นตอนที่ 1:</strong>
                    กดปุ่ม <span className="font-semibold text-slate-900">"1. คัดลอกตาราง (Copy)"</span> ด้านบน
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <strong className="text-emerald-700 block mb-1">ขั้นตอนที่ 2:</strong>
                    กดปุ่ม <span className="font-semibold text-slate-900">"2. เปิด Google Sheets"</span> หรือเปิดไฟล์ชีตเดิมของคุณ
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <strong className="text-emerald-700 block mb-1">ขั้นตอนที่ 3:</strong>
                    คลิกช่องแรก <span className="font-mono font-bold text-blue-700">A1</span> แล้วกดแป้นพิมพ์ <span className="font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded border">Ctrl + V</span> เพื่อวางข้อมูลได้ทันที
                  </div>
                </div>
              </div>

              {/* Preview Table snippet */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>ตัวอย่างข้อมูลที่จะวางลงใน Google Sheets ({filteredItems.slice(0, 5).length} จาก {filteredItems.length} รายการแรก):</span>
                  <span className="text-[11px] text-slate-500">คอลัมน์ตรงตามที่กำหนดครบถ้วน</span>
                </div>
                <div className="overflow-x-auto max-h-56">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-slate-50 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-2 text-center w-8 border-r border-slate-200">#</th>
                        <th className="py-2 px-2.5 w-24 border-r border-slate-200">วันที่ส่งมอบ</th>
                        <th className="py-2 px-2.5 w-28 border-r border-slate-200">ลูกค้า</th>
                        <th className="py-2 px-2.5 w-24 border-r border-slate-200">เลขที่โครงการ</th>
                        <th className="py-2 px-2.5 w-28 border-r border-slate-200">เลขที่เครื่องจักร</th>
                        <th className="py-2 px-2.5 w-28 border-r border-slate-200">เลขที่ Item</th>
                        <th className="py-2 px-3 border-r border-slate-200">ชื่อ Item</th>
                        <th className="py-2 px-2 text-center w-14 border-r border-slate-200">จำนวน</th>
                        <th className="py-2 px-2.5 w-28 border-r border-slate-200">เลขที่ PD</th>
                        <th className="py-2 px-3 text-center">สถานะผ่าน QC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredItems.slice(0, 6).map((it, idx) => (
                        <tr key={it.id} className="hover:bg-slate-50">
                          <td className="py-1.5 px-2 text-center text-slate-400 font-mono border-r border-slate-200">{idx + 1}</td>
                          <td className="py-1.5 px-2.5 font-mono border-r border-slate-200">{it.targetLatest || '-'}</td>
                          <td className="py-1.5 px-2.5 font-semibold text-slate-900 border-r border-slate-200 truncate max-w-[120px]">{it.customer || extractCustomer(it.projectName)}</td>
                          <td className="py-1.5 px-2.5 font-mono border-r border-slate-200">{it.projectCode}</td>
                          <td className="py-1.5 px-2.5 border-r border-slate-200 truncate max-w-[120px]">{it.machineName}</td>
                          <td className="py-1.5 px-2.5 font-mono font-medium border-r border-slate-200">{it.itemCode}</td>
                          <td className="py-1.5 px-3 border-r border-slate-200 truncate max-w-[180px]">{it.itemName}</td>
                          <td className="py-1.5 px-2 text-center font-bold border-r border-slate-200">{it.qty}</td>
                          <td className="py-1.5 px-2.5 font-mono text-blue-900 font-semibold border-r border-slate-200">{it.prodOrder}</td>
                          <td className="py-1.5 px-3 text-center">
                            {it.isQcPassed ? (
                              <span className="text-emerald-700 font-bold">✅ ผ่าน QC</span>
                            ) : (
                              <span className="text-slate-500">⏳ รอตรวจ QC</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: Google Apps Script Automation */}
          {activeTab === 'script' && (
            <div className="space-y-4 text-xs">
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-sky-900 space-y-2">
                <h4 className="font-bold text-sm flex items-center gap-1.5 text-sky-950">
                  <Code className="w-4 h-4 text-sky-600" />
                  <span>สร้างแท็บ "แผนการส่งมอบ" อัตโนมัติใน Google Spreadsheet หลัก</span>
                </h4>
                <p className="leading-relaxed">
                  สคริปต์นี้จะอ่านข้อมูลจากแท็บ <strong>"Check list ส่งมอบ"</strong> และแท็บ <strong>"QC"</strong> ใน Google Spreadsheet ของคุณ 
                  จากนั้นสร้างแท็บใหม่ชื่อ <strong>"แผนการส่งมอบ"</strong> ให้โดยอัตโนมัติ โดยคัดกรองเฉพาะงานที่ยังไม่ส่ง แยกตามวันที่ และเรียงตาม ลูกค้า, เลขที่โครงการ, เครื่องจักร, เลขที่ Item พร้อมระบุสถานะ QC
                </p>
              </div>

              {/* Script code block with copy button */}
              <div className="relative">
                <div className="flex items-center justify-between bg-slate-900 text-slate-300 px-4 py-2.5 rounded-t-xl text-xs font-mono">
                  <span>Google Apps Script (createDeliveryPlanSheet.gs)</span>
                  <button
                    type="button"
                    onClick={handleCopyScript}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition active:scale-95 cursor-pointer ${
                      copiedScript
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-700 hover:bg-slate-600 text-white'
                    }`}
                  >
                    {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedScript ? 'คัดลอกโค้ดแล้ว!' : 'คัดลอกโค้ดสคริปต์'}</span>
                  </button>
                </div>
                <pre className="bg-slate-950 text-emerald-400 p-4 rounded-b-xl overflow-x-auto text-[11px] font-mono max-h-72 leading-relaxed border border-slate-800">
                  {appsScriptCode}
                </pre>
              </div>

              {/* Instructions on how to add to Google Spreadsheet */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-slate-700 space-y-2">
                <strong className="text-slate-900 block font-semibold text-sm">
                  วิธีนำโค้ดไปใส่ใน Google Spreadsheet ของคุณ:
                </strong>
                <ol className="list-decimal list-inside space-y-1 pl-1">
                  <li>เปิด Google Spreadsheet ไฟล์หลักของคุณ</li>
                  <li>คลิกเมนูด้านบน: <strong>ส่วนขยาย (Extensions)</strong> $\rightarrow$ <strong>Apps Script</strong></li>
                  <li>ลบโค้ดที่มีอยู่เดิมออก แล้วกดปุ่ม <strong>"คัดลอกโค้ดสคริปต์"</strong> ด้านบน แล้วกดวาง (<code className="bg-slate-200 px-1 py-0.5 rounded">Ctrl + V</code>)</li>
                  <li>กดปุ่ม <strong>บันทึก (Save)</strong> รูปแผ่นดิสก์</li>
                  <li>กดปุ่ม <strong>เรียกใช้ (Run)</strong> เพื่อให้สคริปต์สร้างแท็บ "แผนการส่งมอบ" ในสเปรดชีตของคุณทันที!</li>
                </ol>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-slate-500">
            PDTrack • ระบบติดตามแผนการส่งมอบชิ้นส่วนเครื่องจักร
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
};
