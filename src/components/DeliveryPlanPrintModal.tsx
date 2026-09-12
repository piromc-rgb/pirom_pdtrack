import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Printer, 
  Download, 
  Filter, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  AlertTriangle, 
  Building2, 
  Cpu, 
  FileText,
  Boxes,
  ShieldCheck,
  Search,
  Sparkles,
  ChevronDown,
  Check,
  FileSpreadsheet
} from 'lucide-react';
import { DeliveryItem } from '../types';
import { 
  formatThaiDate, 
  formatCompactDate, 
  formatThaiDayOfWeek,
  parseDate, 
  isDateOverdue, 
  isDateDueSoon,
  getDaysDiff,
  extractCustomer
} from '../utils/dateUtils';
import { isOverviewCompletedOrClosed } from '../services/sheetService';

interface DeliveryPlanPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: DeliveryItem[];
  initialSelectedDate?: string | null;
}

export const DeliveryPlanPrintModal: React.FC<DeliveryPlanPrintModalProps> = ({
  isOpen,
  onClose,
  items,
  initialSelectedDate = null,
}) => {
  // Filters for printout
  const [qcFilter, setQcFilter] = useState<'all' | 'qc-passed' | 'qc-pending'>('all');
  const [dateFilter, setDateFilter] = useState<string>(initialSelectedDate || 'all');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Filter ONLY pending items (งานที่ยังไม่ส่ง)
  const pendingItems = useMemo(() => {
    return items.filter(item => item.status !== 'ส่งแล้ว');
  }, [items]);

  // Extract unique customers for dropdown
  const customerList = useMemo(() => {
    const set = new Set<string>();
    pendingItems.forEach(item => {
      const cust = item.customer || extractCustomer(item.projectName);
      if (cust && cust !== '-') set.add(cust);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'));
  }, [pendingItems]);

  // Extract unique target dates for dropdown
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

  // 2. Apply Print Modal Filters
  const filteredItems = useMemo(() => {
    return pendingItems.filter(item => {
      // QC Filter: "ถ้าสถานะการผ่าน QC"
      if (qcFilter === 'qc-passed' && !item.isQcPassed) return false;
      if (qcFilter === 'qc-pending' && item.isQcPassed) return false;

      // Date Filter
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
          // Specific date
          if (item.targetLatest !== dateFilter) return false;
        }
      }

      // Customer Filter
      if (selectedCustomer !== 'all') {
        const cust = item.customer || extractCustomer(item.projectName);
        if (cust !== selectedCustomer) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = 
          item.itemCode.toLowerCase().includes(q) ||
          item.itemName.toLowerCase().includes(q) ||
          item.machineName.toLowerCase().includes(q) ||
          item.projectCode.toLowerCase().includes(q) ||
          item.projectName.toLowerCase().includes(q) ||
          item.prodOrder.toLowerCase().includes(q) ||
          (item.customer && item.customer.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    });
  }, [pendingItems, qcFilter, dateFilter, selectedCustomer, searchQuery]);

  // 3. Group by Date, then within each date sort by:
  // ลูกค้า -> เลขที่โครงการ -> เลขที่เครื่องจักร -> เลขที่ Item
  const printDateGroups = useMemo(() => {
    interface SetGroup {
      setKey: string;
      customer: string;
      projectName: string;
      projectCode: string;
      machineName: string;
      items: DeliveryItem[];
      totalQty: number;
      qcPassedCount: number;
      pdCompletedCount: number;
    }

    interface Group {
      dateKey: string;
      parsedDate: Date | null;
      isOverdue: boolean;
      isToday: boolean;
      isTomorrow: boolean;
      daysDiff: number | null;
      items: DeliveryItem[];
      sets: SetGroup[];
      totalQty: number;
      qcPassedCount: number;
      pdCompletedCount: number;
      customersCount: number;
      machinesCount: number;
    }

    const groups: Record<string, Group> = {};

    filteredItems.forEach(item => {
      const dateKey = item.targetLatest || 'ยังไม่ระบุวันส่ง';
      if (!groups[dateKey]) {
        const parsed = parseDate(item.targetLatest);
        const diff = getDaysDiff(item.targetLatest);
        groups[dateKey] = {
          dateKey,
          parsedDate: parsed,
          isOverdue: isDateOverdue(item.targetLatest),
          isToday: diff === 0,
          isTomorrow: diff === 1,
          daysDiff: diff,
          items: [],
          sets: [],
          totalQty: 0,
          qcPassedCount: 0,
          pdCompletedCount: 0,
          customersCount: 0,
          machinesCount: 0,
        };
      }

      groups[dateKey].items.push(item);
      groups[dateKey].totalQty += item.qty;
      if (item.isQcPassed) groups[dateKey].qcPassedCount++;
      if (isOverviewCompletedOrClosed(item.overviewStatus)) groups[dateKey].pdCompletedCount++;
    });

    // Sort chronologically by date
    const sorted = Object.values(groups).sort((a, b) => {
      if (!a.parsedDate) return 1;
      if (!b.parsedDate) return -1;
      return a.parsedDate.getTime() - b.parsedDate.getTime();
    });

    // Within each date group, create sets grouped by:
    // Customer (ลูกค้า) + projectCode (เลขที่โครงการ) + machineName (เลขที่เครื่องจักร)
    sorted.forEach(group => {
      const uniqueCust = new Set<string>();
      const uniqueMach = new Set<string>();
      const setsMap = new Map<string, SetGroup>();

      group.items.forEach(it => {
        const c = it.customer || extractCustomer(it.projectName);
        if (c) uniqueCust.add(c);
        if (it.machineName) uniqueMach.add(it.machineName);

        const setKey = `${c}|${it.projectCode || ''}|${it.machineName || ''}`;
        if (!setsMap.has(setKey)) {
          setsMap.set(setKey, {
            setKey,
            customer: c,
            projectName: it.projectName,
            projectCode: it.projectCode,
            machineName: it.machineName,
            items: [],
            totalQty: 0,
            qcPassedCount: 0,
            pdCompletedCount: 0,
          });
        }
        const s = setsMap.get(setKey)!;
        s.items.push(it);
        s.totalQty += it.qty;
        if (it.isQcPassed) s.qcPassedCount++;
        if (isOverviewCompletedOrClosed(it.overviewStatus)) s.pdCompletedCount++;
      });

      group.customersCount = uniqueCust.size;
      group.machinesCount = uniqueMach.size;

      // Sort sets: Customer -> Project Code -> Machine Name
      const sortedSets = Array.from(setsMap.values()).sort((a, b) => {
        const custCmp = a.customer.localeCompare(b.customer, 'th');
        if (custCmp !== 0) return custCmp;

        const projCmp = (a.projectCode || '').localeCompare(b.projectCode || '');
        if (projCmp !== 0) return projCmp;

        return (a.machineName || '').localeCompare(b.machineName || '');
      });

      // Inside each set, sort items by itemCode
      sortedSets.forEach(s => {
        s.items.sort((a, b) => (a.itemCode || '').localeCompare(b.itemCode || ''));
      });

      group.sets = sortedSets;
    });

    return sorted;
  }, [filteredItems]);

  // Totals for the print document
  const totalItemsCount = filteredItems.length;
  const totalQtyCount = useMemo(() => filteredItems.reduce((acc, it) => acc + it.qty, 0), [filteredItems]);
  const totalQcPassedCount = useMemo(() => filteredItems.filter(it => it.isQcPassed).length, [filteredItems]);

  // Current print timestamp
  const printTimestamp = useMemo(() => {
    const now = new Date();
    const thaiMonths = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return `${now.getDate()} ${thaiMonths[now.getMonth()]} ${now.getFullYear() + 543} เวลา ${timeStr} น.`;
  }, []);

  const [copiedSheets, setCopiedSheets] = useState(false);

  // Copy TSV formatted for Google Sheets
  const handleCopyGoogleSheets = async () => {
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
      'หมายเหตุ'
    ];

    const tsvRows: string[] = [headers.join('\t')];
    let rowSeq = 1;

    printDateGroups.forEach(group => {
      group.items.forEach(item => {
        const cust = item.customer || extractCustomer(item.projectName);
        const qcText = item.isQcPassed ? 'ผ่าน QC แล้ว' : 'ยังไม่เข้า QC';
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

    try {
      await navigator.clipboard.writeText(tsvRows.join('\n'));
      setCopiedSheets(true);
      setTimeout(() => setCopiedSheets(false), 3000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  // Track modal open state on body for @media print CSS isolation
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('print-modal-active');
    } else {
      document.body.classList.remove('print-modal-active');
    }
    return () => {
      document.body.classList.remove('print-modal-active');
    };
  }, [isOpen]);

  // Trigger browser print with custom document title for default PDF filename
  const handlePrint = () => {
    const originalTitle = document.title;
    const filterLabel = qcFilter === 'qc-passed' ? 'เฉพาะผ่านQC' : 'ทั้งหมด';
    const dateStr = new Date().toISOString().slice(0, 10);
    document.title = `ใบแจ้งแผนการส่งมอบชิ้นส่วน_${filterLabel}_${dateStr}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  // Export filtered print data as CSV
  const handleExportCsv = () => {
    const headers = [
      'ลำดับ',
      'วันที่ส่งมอบ (Target Date)',
      'ลูกค้า (Customer)',
      'เลขที่โครงการ (Project No)',
      'ชื่อโครงการ',
      'เลขที่เครื่องจักร (Machine)',
      'เลขที่ Item (Item Code)',
      'ชื่อ Item (Description)',
      'จำนวน (Qty)',
      'เลขที่ PD (Prod Order)',
      'สถานะผ่าน QC (QC Status)',
      'วันที่ตรวจ QC',
      'ผู้ตรวจสอบ QC',
      'หมายเหตุ'
    ];

    const rows: string[][] = [];
    let rowSeq = 1;

    printDateGroups.forEach(group => {
      group.items.forEach(item => {
        const cust = item.customer || extractCustomer(item.projectName);
        const qcText = item.isQcPassed ? 'ผ่าน QC แล้ว' : 'ยังไม่เข้า QC';
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
    link.setAttribute('download', `Print_Delivery_Plan_${qcFilter}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      id="delivery-plan-print-root"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 print:p-0 print:m-0 print:bg-white print:static print:overflow-visible print:w-full print:h-auto print-portal-root"
    >
      
      {/* Modal Container */}
      <div className="bg-slate-50 rounded-2xl border border-slate-300 shadow-2xl w-full max-w-[97vw] 2xl:max-w-[1780px] max-h-[96vh] flex flex-col overflow-hidden print:overflow-visible print:max-w-none print:max-h-none print:border-none print:shadow-none print:rounded-none print:bg-white print:p-0 print-modal-card">
        
        {/* ======================================================== */}
        {/* CONTROL HEADER (Hidden on actual print / PDF output)    */}
        {/* ======================================================== */}
        <div className="bg-white border-b border-slate-200 p-4 sm:p-5 flex-shrink-0 print:hidden space-y-4 shadow-sm">
          
          {/* Title Row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                  <span>พิมพ์แผนการส่งมอบ & บันทึกเป็น PDF</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold border border-blue-200">
                    A4 แนวตั้ง (Portrait)
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  แยกตามวันที่ และ ลูกค้า • เลขที่โครงการ • เลขที่เครื่องจักร • เลขที่ item • ชื่อ item • จำนวน • สถานะ QC
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 hover:shadow-lg transition active:scale-95 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>พิมพ์ / บันทึกเป็น PDF (Print to PDF)</span>
              </button>
              <button
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition"
                title="ส่งออกตารางเป็นไฟล์ CSV"
              >
                <Download className="w-4 h-4 text-slate-600" />
                <span className="hidden sm:inline">CSV</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Interactive Filters Toolbar */}
          <div className="bg-slate-100/80 p-3 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            
            {/* 1. QC Status Filter (ตรงกับคำสั่ง: "ถ้าสถานะการผ่าน QC เป็น pdf") */}
            <div>
              <label className="block text-slate-600 font-semibold mb-1 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>สถานะการผ่าน QC:</span>
              </label>
              <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-lg border border-slate-300">
                <button
                  type="button"
                  onClick={() => setQcFilter('all')}
                  className={`py-1.5 px-2 rounded-md font-semibold transition text-center ${
                    qcFilter === 'all'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  งานรอส่งทั้งหมด
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
                  <CheckCircle2 className="w-3 h-3" />
                  <span>เฉพาะที่ผ่าน QC</span>
                </button>
              </div>
            </div>

            {/* 2. Target Date Range Filter */}
            <div>
              <label className="block text-slate-600 font-semibold mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>เลือกช่วงวันที่ส่งมอบ:</span>
              </label>
              <select
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                className="w-full py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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

            {/* 3. Customer Filter */}
            <div>
              <label className="block text-slate-600 font-semibold mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-purple-600" />
                <span>เลือกลูกค้า:</span>
              </label>
              <select
                value={selectedCustomer}
                onChange={e => setSelectedCustomer(e.target.value)}
                className="w-full py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">ลูกค้าทั้งหมด ({customerList.length} ราย)</option>
                {customerList.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Quick Search Filter */}
            <div>
              <label className="block text-slate-600 font-semibold mb-1 flex items-center gap-1">
                <Search className="w-3.5 h-3.5 text-slate-500" />
                <span>ค้นหาในเอกสารพิมพ์:</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาชื่อชิ้นงาน, เลขที่ PD, รหัส..."
                  className="w-full py-1.5 pl-7 pr-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

          </div>

          {/* Quick Stats Summary Banner */}
          <div className="flex items-center justify-between text-xs text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-200">
            <div className="flex items-center gap-4 flex-wrap">
              <span><strong>ผลลัพธ์ที่จะพิมพ์:</strong> {printDateGroups.length} วันที่</span>
              <span>• <strong>จำนวนรายการ:</strong> {totalItemsCount} รายการ</span>
              <span>• <strong>จำนวนชิ้นงานรวม:</strong> {totalQtyCount} ชิ้น</span>
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>ผ่าน QC แล้ว: {totalQcPassedCount} รายการ ({totalItemsCount > 0 ? Math.round((totalQcPassedCount / totalItemsCount) * 100) : 0}%)</span>
              </span>
            </div>
            <span className="text-slate-400 hidden sm:inline">
              * กดปุ่ม "พิมพ์ / บันทึกเป็น PDF" เพื่อเลือก Save as PDF ในเมนูเครื่องพิมพ์
            </span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* PRINTABLE DOCUMENT BODY (A4 Sheet Preview & Real Print)  */}
        {/* ======================================================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200/60 print:bg-white print:p-0 print:overflow-visible print-modal-scroll-area">
          
          {/* A4 Paper Simulation Canvas (Portrait) */}
          <div className="max-w-[820px] mx-auto bg-white rounded-xl shadow-lg border border-slate-300 p-6 sm:p-8 print:shadow-none print:border-none print:p-0 print:max-w-none print:rounded-none print-document">
            
            {/* 1. Formal Document Header */}
            <div className="border-b-2 border-slate-900 pb-4 mb-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 text-xs font-bold tracking-wider text-slate-600 uppercase mb-1">
                    <span>ฝ่ายผลิตและประกอบเครื่องจักร • คลังสินค้าและจัดส่ง</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-950 tracking-tight">
                    ใบแจ้งแผนการส่งมอบชิ้นส่วนเครื่องจักร (Delivery Schedule Plan)
                  </h1>
                  <p className="text-xs text-slate-600 mt-1">
                    เอกสารรายงานแผนการจัดส่งอะไหล่และชิ้นส่วนตามเป้าหมายส่งมอบรายวัน (แยกตามวันที่ และ ลูกค้า • โครงการ • เครื่องจักร)
                  </p>
                </div>

                <div className="text-right text-xs text-slate-600 space-y-1 flex-shrink-0">
                  <div className="font-semibold text-slate-900">
                    พิมพ์เมื่อ: {printTimestamp}
                  </div>
                  <div>
                    เงื่อนไขเอกสาร: <span className="font-semibold text-blue-700">
                      {qcFilter === 'qc-passed' ? 'เฉพาะรายการที่ผ่าน QC แล้ว' : 'แสดงรายการรอส่งทั้งหมด'}
                    </span>
                  </div>
                  <div>
                    จำนวนวันที่จัดทำแผน: <span className="font-bold text-slate-900">{printDateGroups.length}</span> วัน
                  </div>
                </div>
              </div>

              {/* Document Summary Stats Row */}
              <div className="mt-4 pt-3 border-t border-slate-200 grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block">จำนวนวันที่ส่งมอบ</span>
                  <strong className="text-slate-900 text-sm">{printDateGroups.length} วัน</strong>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block">จำนวนรายการทั้งหมด</span>
                  <strong className="text-slate-900 text-sm">{totalItemsCount} รายการ</strong>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block">จำนวนชิ้นงานรวม</span>
                  <strong className="text-slate-900 text-sm">{totalQtyCount} ชิ้น</strong>
                </div>
                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
                  <span className="text-emerald-600 block">ผ่านการตรวจ QC แล้ว</span>
                  <strong className="text-emerald-700 text-sm font-bold">
                    {totalQcPassedCount} รายการ ({totalItemsCount > 0 ? Math.round((totalQcPassedCount / totalItemsCount) * 100) : 0}%)
                  </strong>
                </div>
              </div>
            </div>

            {/* 2. Empty State */}
            {printDateGroups.length === 0 && (
              <div className="py-16 text-center text-slate-400">
                <Boxes className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-base font-medium text-slate-600">ไม่พบรายการตามเงื่อนไขตัวกรอง</p>
                <p className="text-xs text-slate-400 mt-1">กรุณาลองปรับเปลี่ยนตัวกรอง QC หรือช่วงวันที่ด้านบน</p>
              </div>
            )}

            {/* 3. Grouped Tables: Strictly Separated by Date */}
            <div className="space-y-6">
              {printDateGroups.map((group, groupIdx) => {
                const thaiDayFull = formatThaiDayOfWeek(group.dateKey);
                const compactDate = formatCompactDate(group.dateKey);
                
                return (
                  <div 
                    key={group.dateKey}
                    className="border border-slate-300 rounded-xl overflow-hidden print:overflow-visible page-break-avoid print-date-group mb-5"
                  >
                    {/* Date Section Header Bar */}
                    <div className="bg-slate-100 border-b border-slate-300 px-3 py-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded-md bg-slate-900 text-white font-bold text-xs">
                          {groupIdx + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                              แผนส่งมอบประจำวันที่: {thaiDayFull}
                            </h3>
                            <span className="text-[10px] font-semibold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-300">
                              เป้าหมาย: {compactDate}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Urgency Badge & Summary Pill */}
                      <div className="flex items-center gap-2 text-[10px]">
                        {group.isOverdue && (
                          <span className="px-1.5 py-0.5 rounded font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            🚨 เกินกำหนด {Math.abs(group.daysDiff || 0)} วัน
                          </span>
                        )}
                        {group.isToday && (
                          <span className="px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            ⚡ ส่งมอบวันนี้
                          </span>
                        )}
                        {group.isTomorrow && (
                          <span className="px-1.5 py-0.5 rounded font-bold bg-sky-100 text-sky-800 border border-sky-300">
                            ⏳ ส่งมอบพรุ่งนี้
                          </span>
                        )}

                        <div className="text-slate-600 font-medium hidden sm:inline text-[10px]">
                          <strong>{group.items.length}</strong> รายการ | <strong>{group.totalQty}</strong> ชิ้น | PD เสร็จแล้ว <strong className="text-blue-800">{group.pdCompletedCount}/{group.items.length} ({group.items.length > 0 ? ((group.pdCompletedCount / group.items.length) * 100).toFixed(1).replace('.0', '') : 0}%)</strong> | ผ่าน QC <strong className="text-emerald-700">{group.qcPassedCount}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Sets for this date: Grouped by Customer + Project + Machine */}
                    <div className="p-2 sm:p-3 space-y-3 bg-slate-50/50 print:p-0 print:space-y-2.5 print:bg-transparent">
                      {group.sets.map((set, setIdx) => (
                        <div 
                          key={set.setKey}
                          className="border border-slate-300 rounded-lg overflow-hidden print:overflow-visible page-break-avoid bg-white shadow-2xs"
                        >
                          {/* Set Header Bar: Customer, Project No, Machine No */}
                          <div className="bg-slate-100/95 border-b border-slate-300 px-3 py-1.5 flex items-center justify-between gap-2 text-[10.5px]">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              {/* 1. Customer */}
                              <span className="font-bold text-slate-900 flex items-center gap-1">
                                <Building2 className="w-3.5 h-3.5 text-blue-700 flex-shrink-0" />
                                <span>ลูกค้า: <strong className="text-blue-950 font-bold">{set.customer}</strong></span>
                                {set.projectName && set.projectName !== set.customer && (
                                  <span className="text-slate-500 font-normal text-[9px]">({set.projectName})</span>
                                )}
                              </span>
                              <span className="text-slate-300">•</span>
                              {/* 2. Project No */}
                              <span className="text-slate-700">
                                เลขที่โครงการ: <strong className="font-mono text-slate-900 font-bold">{set.projectCode || '-'}</strong>
                              </span>
                              <span className="text-slate-300">•</span>
                              {/* 3. Machine No */}
                              <span className="text-slate-700">
                                เลขที่เครื่องจักร: <strong className="font-mono text-blue-900 font-bold">{set.machineName || '(ไม่ระบุ)'}</strong>
                              </span>
                            </div>

                            {/* Set Count Pill */}
                            <div className="text-[9.5px] text-slate-500 font-medium whitespace-nowrap">
                              <strong>{set.items.length}</strong> รายการ | <strong>{set.totalQty}</strong> ชิ้น | PD เสร็จ <strong className="text-blue-800">{set.pdCompletedCount}/{set.items.length}</strong> | ผ่าน QC <strong className="text-emerald-700">{set.qcPassedCount}</strong>
                            </div>
                          </div>

                          {/* Table for this set: 6 Spacious, Clean Columns */}
                          <div className="overflow-x-auto print:overflow-visible">
                            <table className="w-full text-left border-collapse text-[10px] leading-snug">
                              <thead>
                                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-300 text-[10px]">
                                  <th className="py-1.5 px-1 text-center w-8 border-r border-slate-200">#</th>
                                  <th className="py-1.5 px-2 w-[calc(14ch+18px)] min-w-[calc(14ch+18px)] max-w-[calc(14ch+18px)] border-r border-slate-200 font-mono text-center">เลขที่ Item</th>
                                  <th className="py-1.5 px-2 border-r border-slate-200">ชื่อ Item / รายละเอียดชิ้นงาน</th>
                                  <th className="py-1.5 px-1 text-center w-14 border-r border-slate-200">จำนวน</th>
                                  <th className="py-1.5 px-2 w-36 border-r border-slate-200 font-mono">เลขที่ PD</th>
                                  <th className="py-1.5 px-2 w-28 text-center">สถานะ QC</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {set.items.map((item, idx) => (
                                  <tr 
                                    key={item.id}
                                    className={`hover:bg-slate-50/80 transition-colors ${
                                      item.isQcPassed ? 'bg-emerald-50/20' : ''
                                    }`}
                                  >
                                    {/* 1. ลำดับ */}
                                    <td className="py-1.5 px-1 text-center text-slate-400 font-medium border-r border-slate-200 text-[9.5px]">
                                      {idx + 1}
                                    </td>

                                    {/* 2. เลขที่ Item */}
                                    <td className="py-1.5 px-2 font-mono text-slate-900 font-semibold border-r border-slate-200 text-[10px] whitespace-nowrap text-center">
                                      {item.itemCode || '-'}
                                    </td>

                                    {/* 3. ชื่อ Item / รายละเอียดชิ้นงาน */}
                                    <td className="py-1.5 px-2 text-slate-900 border-r border-slate-200">
                                      <div className="font-semibold text-slate-900 text-[10.5px]">
                                        {item.itemName}
                                      </div>
                                      {item.remark && (
                                        <div className="text-[9px] text-slate-500 italic mt-0.5">
                                          หมายเหตุ: {item.remark}
                                        </div>
                                      )}
                                    </td>

                                    {/* 4. จำนวน */}
                                    <td className="py-1.5 px-1 text-center font-bold text-slate-900 border-r border-slate-200 text-[10.5px]">
                                      {item.qty.toLocaleString()}
                                    </td>

                                    {/* 5. เลขที่ PD */}
                                    <td className="py-1.5 px-2 font-mono text-slate-800 border-r border-slate-200 text-[10px]">
                                      {item.prodOrder ? (
                                        <span className="font-semibold text-blue-900 font-mono">
                                          {item.prodOrder}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400">-</span>
                                      )}
                                    </td>

                                    {/* 6. สถานะ QC */}
                                    <td className="py-1.5 px-2 text-center">
                                      {item.isQcPassed ? (
                                        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[9px] whitespace-nowrap">
                                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 flex-shrink-0" />
                                          <span>ผ่าน QC แล้ว</span>
                                        </div>
                                      ) : (
                                        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium text-[9px] whitespace-nowrap">
                                          <Clock className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />
                                          <span>ยังไม่เข้า QC</span>
                                        </div>
                                      )}

                                      {item.isQcPassed && (item.qcDate || item.qcInspector) && (
                                        <div className="text-[8px] text-slate-500 mt-0.5 whitespace-nowrap">
                                          {item.qcDate} {item.qcInspector ? `(${item.qcInspector})` : ''}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Subtotal row at end of each date */}
                    <div className="bg-slate-50/90 border-t border-slate-200 px-3 py-1.5 flex items-center justify-between text-[10px] text-slate-700">
                      <span>
                        สรุปวันที่ {compactDate}: <strong>{group.items.length}</strong> รายการ (ลูกค้า {group.customersCount} ราย • เครื่องจักร {group.machinesCount} เครื่อง)
                      </span>
                      <div className="flex items-center gap-3">
                        <span>จำนวนชิ้นงานรวม: <strong className="text-slate-900 font-bold">{group.totalQty.toLocaleString()} ชิ้น</strong></span>
                        <span className="text-blue-800 font-semibold">
                          PD เสร็จแล้ว: <strong>{group.pdCompletedCount}/{group.items.length} ({group.items.length > 0 ? ((group.pdCompletedCount / group.items.length) * 100).toFixed(1).replace('.0', '') : 0}%)</strong>
                        </span>
                        <span className="text-emerald-700 font-semibold">
                          ผ่าน QC แล้ว: <strong>{group.qcPassedCount}</strong> รายการ
                        </span>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>

            {/* 4. Grand Signatures Section for Official Dispatch & Quality Handover */}
            <div className="mt-8 pt-5 border-t-2 border-slate-300 page-break-avoid signature-block">
              <div className="text-xs font-bold text-slate-700 mb-4 tracking-wider uppercase">
                การตรวจสอบและรับรองการส่งมอบชิ้นส่วนเครื่องจักร
              </div>
              <div className="grid grid-cols-4 gap-4 text-center">
                
                {/* 1. ผู้จัดทำแผน */}
                <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/50">
                  <div className="text-xs font-semibold text-slate-700">ผู้จัดทำแผนส่งมอบ</div>
                  <div className="h-14 border-b border-dashed border-slate-300 mt-2 mb-2"></div>
                  <div className="text-[11px] text-slate-500">(...................................................)</div>
                  <div className="text-[10px] text-slate-400 mt-1">วันที่: ....../....../......</div>
                </div>

                {/* 2. ผู้ตรวจ QC */}
                <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/50">
                  <div className="text-xs font-semibold text-slate-700">ผู้ตรวจสอบคุณภาพ (QC)</div>
                  <div className="h-14 border-b border-dashed border-slate-300 mt-2 mb-2"></div>
                  <div className="text-[11px] text-slate-500">(...................................................)</div>
                  <div className="text-[10px] text-slate-400 mt-1">วันที่: ....../....../......</div>
                </div>

                {/* 3. ผู้จัดส่ง / คลังสินค้า */}
                <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/50">
                  <div className="text-xs font-semibold text-slate-700">ผู้จัดส่ง / คลังสินค้า</div>
                  <div className="h-14 border-b border-dashed border-slate-300 mt-2 mb-2"></div>
                  <div className="text-[11px] text-slate-500">(...................................................)</div>
                  <div className="text-[10px] text-slate-400 mt-1">วันที่: ....../....../......</div>
                </div>

                {/* 4. ผู้รับมอบปลายทาง */}
                <div className="border border-slate-300 rounded-lg p-3 bg-slate-50/50">
                  <div className="text-xs font-semibold text-slate-700">ผู้รับมอบสินค้า / หน้างาน</div>
                  <div className="h-14 border-b border-dashed border-slate-300 mt-2 mb-2"></div>
                  <div className="text-[11px] text-slate-500">(...................................................)</div>
                  <div className="text-[10px] text-slate-400 mt-1">วันที่: ....../....../......</div>
                </div>

              </div>
              
              <div className="mt-4 text-[10px] text-slate-400 flex items-center justify-between">
                <span>PDTrack - Delivery Tracking System</span>
                <span>หน้า 1 จาก 1 (จัดพิมพ์สำหรับเอกสารส่งมอบ)</span>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>,
    document.body
  );
};
