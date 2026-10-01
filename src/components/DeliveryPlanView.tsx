import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Cpu, 
  ArrowRight,
  Filter,
  Boxes,
  ChevronDown,
  ChevronUp,
  Download,
  Search,
  Printer,
  Sparkles,
  Building2,
  Briefcase,
  User,
  RefreshCw,
  GitCompare,
  Layers,
  TrendingUp
} from 'lucide-react';
import { DeliveryItem, MachineSummary, SearchCriteria } from '../types';
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
import { searchAndOpenItemPdf, formatItemCodeWithHyphens, refreshDwgIndex } from '../utils/pdfFinder';
import { DeliveryPlanPrintModal } from './DeliveryPlanPrintModal';

export interface DeliveryDateGroup {
  dateKey: string;
  parsedDate: Date | null;
  thaiFormatted: string;
  shortFormatted: string;
  isOverdue: boolean;
  isToday: boolean;
  isTomorrow: boolean;
  daysDiff: number | null;
  totalQty: number;
  qcPassedCount: number;
  pdCompletedCount: number;
  pdPercent: number;
  pdPercentText: string;
  machines: Set<string>;
  items: DeliveryItem[];
}

interface DeliveryPlanViewProps {
  items: DeliveryItem[];
  machines: MachineSummary[];
  searchCriteria: SearchCriteria;
  onSelectMachineByName: (name: string) => void;
  onRefresh?: () => void;
  onOpenComparator?: () => void;
  isLoading?: boolean;
  onRegisterActions?: (actions: { exportCsv: () => void; openPrint: () => void; expandAll: () => void; collapseAll: () => void } | null) => void;
}

export const DeliveryPlanView: React.FC<DeliveryPlanViewProps> = ({
  items,
  searchCriteria,
  onSelectMachineByName,
  onRegisterActions,
}) => {
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedPrintDate, setSelectedPrintDate] = useState<string | null>(null);
  const [isRefreshingDwg, setIsRefreshingDwg] = useState(false);

  const handleRefreshDwg = async () => {
    if (isRefreshingDwg) return;
    setIsRefreshingDwg(true);
    try {
      const result = await refreshDwgIndex();
      window.dispatchEvent(
        new CustomEvent('pdtrack:toast', {
          detail: {
            type: 'success',
            text: result.message,
          },
        })
      );
    } catch (err: any) {
      window.dispatchEvent(
        new CustomEvent('pdtrack:toast', {
          detail: {
            type: 'warning',
            text: `รีเฟรช DWG ไม่สำเร็จ: ${err?.message || 'เกิดข้อผิดพลาด'}`,
          },
        })
      );
    } finally {
      setIsRefreshingDwg(false);
    }
  };

  const statusSource = searchCriteria.statusSource || 'dual';
  const dateWindowFilter = searchCriteria.dateWindow || 'all';
  const internalSearch = searchCriteria.quickSearch || '';

  // 1. FILTER STRICTLY TO PENDING ITEMS ONLY ("แสดงเฉพาะงานที่ยังไม่ส่ง")
  const pendingItems = useMemo(() => {
    return items.filter(item => {
      // Strictly must NOT be delivered
      if (item.status === 'ส่งแล้ว') return false;

      // Apply 5-field Search criteria
      if (searchCriteria.docRef && !item.docRef.toLowerCase().includes(searchCriteria.docRef.toLowerCase().trim())) return false;
      if (searchCriteria.projectCode && !item.projectCode.toLowerCase().includes(searchCriteria.projectCode.toLowerCase().trim())) return false;
      if (searchCriteria.projectName && !item.projectName.toLowerCase().includes(searchCriteria.projectName.toLowerCase().trim())) return false;
      if (searchCriteria.docType && !item.docType.toLowerCase().includes(searchCriteria.docType.toLowerCase().trim())) return false;
      if (searchCriteria.machineName && !item.machineName.toLowerCase().includes(searchCriteria.machineName.toLowerCase().trim())) return false;
      if (searchCriteria.requestDept && (!item.requestDept || !item.requestDept.toLowerCase().includes(searchCriteria.requestDept.toLowerCase().trim()))) return false;
      if (searchCriteria.actionTopic && (!item.actionTopic || !item.actionTopic.toLowerCase().includes(searchCriteria.actionTopic.toLowerCase().trim()))) return false;
      if (searchCriteria.qcStatus === 'passed' && !item.isQcPassed) return false;
      if (searchCriteria.qcStatus === 'pending' && item.isQcPassed) return false;

      // Overview Status Filter
      const effectiveOverview = searchCriteria.overviewStatus || 'all';
      if (effectiveOverview !== 'all') {
        if (effectiveOverview === 'none') {
          if (item.overviewStatus) return false;
        } else if (effectiveOverview === 'Completed') {
          if (!isOverviewCompletedOrClosed(item.overviewStatus)) return false;
        } else if ((item.overviewStatus || '').toLowerCase() !== effectiveOverview.toLowerCase()) {
          return false;
        }
      }

      // Ready Operation Filter
      const effectiveReadyOp = searchCriteria.readyOpName || 'all';
      if (effectiveReadyOp !== 'all') {
        if (effectiveReadyOp === 'any_ready') {
          if (!item.hasReadyOp && !item.readyOp) return false;
        } else if (!item.readyOpDesc?.toLowerCase().includes(effectiveReadyOp.toLowerCase()) &&
                   !item.readyOp?.toLowerCase().includes(effectiveReadyOp.toLowerCase())) {
          return false;
        }
      }

      // Quick text search
      if (internalSearch) {
        const term = internalSearch.toLowerCase().trim();
        const matchName = item.itemName.toLowerCase().includes(term);
        const matchCode = item.itemCode.toLowerCase().includes(term);
        const matchMachine = item.machineName.toLowerCase().includes(term);
        const matchPO = item.prodOrder.toLowerCase().includes(term);
        const matchProj = item.projectName.toLowerCase().includes(term) || item.projectCode.toLowerCase().includes(term);
        const matchDept = item.requestDept?.toLowerCase().includes(term);
        const matchQC = item.isQcPassed && ('ผ่าน qc'.includes(term) || item.qcInspector?.toLowerCase().includes(term));
        const matchReadyOp = item.readyOp?.toLowerCase().includes(term) || item.readyOpDesc?.toLowerCase().includes(term);
        const matchActiveOp = item.activeOp?.toLowerCase().includes(term) || item.activeOpDesc?.toLowerCase().includes(term);
        const isOvDone = isOverviewCompletedOrClosed(item.overviewStatus);
        const matchOverview = item.overviewStatus?.toLowerCase().includes(term) || (isOvDone && ('เสร็จแล้ว'.includes(term) || term.includes('เสร็จ')));
        if (!matchName && !matchCode && !matchMachine && !matchPO && !matchProj && !matchDept && !matchQC && !matchReadyOp && !matchActiveOp && !matchOverview) {
          return false;
        }
      }

      // Quick Date Window Filter
      const daysDiff = getDaysDiff(item.targetLatest);
      if (dateWindowFilter === 'overdue' && !item.isOverdue) return false;
      if (dateWindowFilter === 'today' && (daysDiff === null || daysDiff !== 0)) return false;
      if (dateWindowFilter === '7days' && (daysDiff === null || daysDiff < 0 || daysDiff > 7)) return false;
      if (dateWindowFilter === 'month' && (daysDiff === null || daysDiff < 0 || daysDiff > 30)) return false;
      if (dateWindowFilter === 'qc-ready' && !item.isQcPassed) return false;

      return true;
    });
  }, [items, searchCriteria, internalSearch, dateWindowFilter]);

  // 2. GROUP STRICTLY BY PLANNED DELIVERY DATE ("ยึดตามเป้าการส่งวันไหน คือแผนการส่งวันนั้น")
  const dateGroups = useMemo(() => {
    const groups: { 
      [key: string]: { 
        dateKey: string; 
        parsedDate: Date | null; 
        isOverdue: boolean;
        isToday: boolean;
        isTomorrow: boolean;
        daysDiff: number | null;
        totalQty: number;
        qcPassedCount: number;
        pdCompletedCount: number;
        pdPercent: number;
        pdPercentText: string;
        machines: Set<string>;
        items: DeliveryItem[];
      } 
    } = {};

    pendingItems.forEach(item => {
      const dateKey = item.targetLatest ? item.targetLatest.trim() : 'ยังไม่ระบุวันส่ง';
      const parsed = parseDate(dateKey);
      const daysDiff = getDaysDiff(dateKey);
      const isOverdue = item.isOverdue || Boolean(daysDiff !== null && daysDiff < 0);
      const isToday = daysDiff === 0;
      const isTomorrow = daysDiff === 1;

      if (!groups[dateKey]) {
        groups[dateKey] = {
          dateKey,
          parsedDate: parsed,
          isOverdue,
          isToday,
          isTomorrow,
          daysDiff,
          totalQty: 0,
          qcPassedCount: 0,
          pdCompletedCount: 0,
          pdPercent: 0,
          pdPercentText: '0%',
          machines: new Set<string>(),
          items: []
        };
      }

      groups[dateKey].totalQty += item.qty;
      if (item.isQcPassed) groups[dateKey].qcPassedCount++;
      if (isOverviewCompletedOrClosed(item.overviewStatus)) {
        groups[dateKey].pdCompletedCount++;
      }
      if (item.machineName) groups[dateKey].machines.add(item.machineName);
      groups[dateKey].items.push(item);
    });

    // Compute percentage for each date group
    Object.values(groups).forEach(g => {
      const total = g.items.length;
      const pct = total > 0 ? (g.pdCompletedCount / total) * 100 : 0;
      g.pdPercent = pct;
      g.pdPercentText = pct % 1 === 0 ? `${pct}%` : `${pct.toFixed(1)}%`;
    });

    // Sort chronologically:
    // Past overdue dates -> today -> upcoming dates -> undefined date at the end
    const sorted = Object.values(groups).sort((a, b) => {
      if (!a.parsedDate) return 1;
      if (!b.parsedDate) return -1;
      return a.parsedDate.getTime() - b.parsedDate.getTime();
    });

    return sorted;
  }, [pendingItems]);

  // Expand / collapse single date
  const toggleExpand = (dateKey: string) => {
    setExpandedDates(prev => ({
      ...prev,
      [dateKey]: prev[dateKey] === false ? true : false // default open
    }));
  };

  const isExpanded = (dateKey: string) => {
    return expandedDates[dateKey] !== false; // Default open
  };

  const expandAll = useCallback(() => {
    const next: Record<string, boolean> = {};
    dateGroups.forEach(g => { next[g.dateKey] = true; });
    setExpandedDates(next);
  }, [dateGroups]);

  const collapseAll = useCallback(() => {
    const next: Record<string, boolean> = {};
    dateGroups.forEach(g => { next[g.dateKey] = false; });
    setExpandedDates(next);
  }, [dateGroups]);

  // Export Delivery Plan to CSV
  const handleExportCsv = useCallback(() => {
    const headers = [
      'แผนวันที่ส่งมอบ',
      'TAG',
      'สถานะกำหนดส่ง',
      'ชื่อเครื่องจักร',
      'เลขที่ Item',
      'ชื่อ Item / รายละเอียด',
      'จำนวน (Qty)',
      'Production Order (PD)',
      'สถานะ Overview',
      'Operation รอขึ้นทำงาน',
      'สถานะ QC',
      'วันที่ตรวจ QC',
      'ผู้ตรวจ QC',
      'ชื่อโครงการ',
      'เลขที่โครงการ',
      'ประวัติเป้าหมายเดิม (1-5)',
      'หมายเหตุปลายทาง'
    ];

    const rows: string[][] = [];

    dateGroups.forEach(group => {
      group.items.forEach(item => {
        const urgencyText = group.isOverdue 
          ? `เกินกำหนด ${Math.abs(group.daysDiff || 0)} วัน` 
          : group.isToday 
          ? 'วันนี้' 
          : group.isTomorrow 
          ? 'พรุ่งนี้' 
          : `อีก ${group.daysDiff || 0} วัน`;

        const milestones = [item.target1, item.target2, item.target3, item.target4, item.target5].filter(Boolean).join(' -> ');

        rows.push([
          `"${group.dateKey}"`,
          `"${item.workTag || 'Service'}"`,
          `"${urgencyText}"`,
          `"${item.machineName}"`,
          `"${item.itemCode}"`,
          `"${item.itemName.replace(/"/g, '""')}"`,
          String(item.qty),
          `"${item.prodOrder}"`,
          `"${isOverviewCompletedOrClosed(item.overviewStatus) ? 'เสร็จแล้ว' : (item.overviewStatus || '-')}"`,
          `"${item.readyOp || item.activeOp || '-'}"`,
          item.isQcPassed ? '"ผ่าน QC แล้ว"' : '"ยังไม่เข้า QC"',
          `"${item.qcDate || ''}"`,
          `"${item.qcInspector || ''}"`,
          `"${item.projectName.replace(/"/g, '""')}"`,
          `"${item.projectCode}"`,
          `"${milestones}"`,
          `"${item.remark.replace(/"/g, '""')}"`
        ]);
      });
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Daily_Delivery_Plan_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [dateGroups]);

  // Register export, print, and expand/collapse actions with parent (for SearchFilterBar)
  useEffect(() => {
    if (onRegisterActions) {
      onRegisterActions({
        exportCsv: handleExportCsv,
        openPrint: () => {
          setSelectedPrintDate('all');
          setIsPrintModalOpen(true);
        },
        expandAll,
        collapseAll,
      });
      return () => {
        onRegisterActions(null);
      };
    }
  }, [onRegisterActions, handleExportCsv, expandAll, collapseAll]);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Daily Schedule Groups List */}
      {dateGroups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">ไม่มีรายการค้างส่งมอบตามเงื่อนไขที่เลือก</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            รายการงานตามตัวกรองที่เลือกได้รับการจัดส่งครบถ้วนแล้ว หรือไม่มีงานที่ตรงกับเงื่อนไขการค้นหา
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {dateGroups.map((group) => {
            const expanded = isExpanded(group.dateKey);
            const thaiFullDay = formatThaiDayOfWeek(group.dateKey);
            const allQcPassed = group.qcPassedCount === group.items.length && group.items.length > 0;
            const allPdDone = group.pdCompletedCount === group.items.length && group.items.length > 0;

            return (
              <div 
                key={group.dateKey}
                className={`bg-white rounded-2xl border shadow-xs transition-all overflow-hidden ${
                  group.isOverdue 
                    ? 'border-rose-300 ring-1 ring-rose-200/60' 
                    : group.isToday
                    ? 'border-amber-400 ring-2 ring-amber-200'
                    : 'border-slate-200'
                }`}
              >
                {/* Daily Schedule Header Card */}
                <div 
                  onClick={() => toggleExpand(group.dateKey)}
                  className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition select-none ${
                    group.isOverdue
                      ? 'bg-gradient-to-r from-rose-50/90 via-rose-50/40 to-white hover:bg-rose-100/60'
                      : group.isToday
                      ? 'bg-gradient-to-r from-amber-50/90 via-amber-50/40 to-white hover:bg-amber-100/60'
                      : 'bg-slate-50/70 hover:bg-slate-100/70'
                  }`}
                >
                  {/* Left: Date & Urgency Indicator */}
                  <div className="flex items-start sm:items-center gap-3">
                    <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                      group.isOverdue
                        ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/30'
                        : group.isToday
                        ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30'
                        : 'bg-sky-600 text-white shadow-sm shadow-sky-500/30'
                    }`}>
                      <Calendar className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900">
                          {thaiFullDay}
                        </h2>

                        {/* Relative timing badge */}
                        {group.isOverdue && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            เกินกำหนด {Math.abs(group.daysDiff || 0)} วัน
                          </span>
                        )}
                        {group.isToday && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                            ⚡ กำหนดส่งวันนี้
                          </span>
                        )}
                        {group.isTomorrow && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                            ⏳ ส่งพรุ่งนี้
                          </span>
                        )}
                        {!group.isOverdue && !group.isToday && !group.isTomorrow && group.daysDiff !== null && group.daysDiff > 1 && (
                          <span className="text-xs text-slate-500">
                            (อีก {group.daysDiff} วัน)
                          </span>
                        )}

                        {/* PD Completed / Total & % badge placed right after เกินกำหนด */}
                        <div 
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition shadow-2xs ${
                            allPdDone 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                              : group.pdCompletedCount > 0
                              ? 'bg-blue-50 text-blue-900 border-blue-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                          title={`PD ฝ่ายผลิตเสร็จแล้ว ${group.pdCompletedCount} จากทั้งหมด ${group.items.length} รายการ (คิดเป็น ${group.pdPercentText})`}
                        >
                          <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${
                            allPdDone ? 'text-emerald-600' : group.pdCompletedCount > 0 ? 'text-blue-600' : 'text-slate-400'
                          }`} />
                          <span>PD เสร็จแล้ว {group.pdCompletedCount}/{group.items.length} ({group.pdPercentText})</span>
                        </div>

                        {/* ปุ่ม Refresh DWG ด้านขวาของ PD เสร็จแล้ว */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRefreshDwg();
                          }}
                          disabled={isRefreshingDwg}
                          title="กดเพื่อสแกนและรีเฟรชไฟล์แบบ DWG ล่าสุดจาก Google Drive"
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 hover:border-rose-300 shadow-2xs transition active:scale-95 cursor-pointer disabled:opacity-60"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 text-rose-600 ${isRefreshingDwg ? 'animate-spin' : ''}`} />
                          <span>{isRefreshingDwg ? 'กำลังรีเฟรช DWG...' : 'Refresh DWG'}</span>
                        </button>
                      </div>

                      <p className="text-xs text-slate-500 mt-0.5">
                        เป้าหมายส่งมอบตามเอกสาร: <span className="font-mono font-semibold text-slate-700">{group.dateKey}</span>
                      </p>
                    </div>
                  </div>

                  {/* Right: Summary Pills & Toggle */}
                  <div className="flex items-center gap-2 sm:gap-2.5 self-end sm:self-center flex-wrap">
                    {/* Items count & Qty */}
                    <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-800 shadow-2xs">
                      <Boxes className="w-3.5 h-3.5 text-slate-500" />
                      <span>{group.items.length} รายการ ({group.totalQty} ชิ้น)</span>
                    </div>

                    {/* QC Status indicator */}
                    <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                      allQcPassed 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : group.qcPassedCount > 0
                        ? 'bg-sky-50 text-sky-800 border-sky-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      <CheckCircle2 className={`w-3.5 h-3.5 ${allQcPassed ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span>ผ่าน QC {group.qcPassedCount}/{group.items.length}</span>
                    </div>

                    {/* Quick Print Button for this specific day */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPrintDate(group.dateKey);
                        setIsPrintModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-700 border border-slate-300 text-xs font-semibold shadow-2xs transition active:scale-95 cursor-pointer"
                      title="พิมพ์แผนเฉพาะวันนี้ หรือบันทึกเป็น PDF"
                    >
                      <Printer className="w-3.5 h-3.5 text-sky-600" />
                      <span className="hidden md:inline">พิมพ์แผนวันนี้</span>
                    </button>

                    <div className="p-1 rounded-full text-slate-400 hover:text-slate-600">
                      {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Table of parts scheduled for this day */}
                {expanded && (
                  <div className="border-t border-slate-200 p-0 overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center">#</th>
                          <th className="py-2.5 px-3 min-w-[130px]">ลูกค้า / โครงการ</th>
                          <th className="py-2.5 px-3 min-w-[120px]">ชื่อเครื่องจักร</th>
                          <th className="py-2.5 px-3 w-[calc(14ch+24px)] min-w-[calc(14ch+24px)] font-mono">เลขที่ Item</th>
                          <th className="py-2.5 px-3 min-w-[200px]">ชื่อชิ้นงาน / รายละเอียด</th>
                          <th className="py-2.5 px-3 text-center w-16">จำนวน</th>
                          <th className="py-2.5 px-3 min-w-[120px]">Production Order</th>
                          
                          {/* Dynamic Status Header */}
                          {statusSource === 'qc' && (
                            <th className="py-2.5 px-3 min-w-[130px]">สถานะ QC Record</th>
                          )}
                          {statusSource === 'overview' && (
                            <th className="py-2.5 px-3 min-w-[130px] bg-blue-50 text-blue-900">สถานะ Overview</th>
                          )}
                          {statusSource === 'dual' && (
                            <>
                              <th className="py-2.5 px-2.5 min-w-[110px] bg-blue-50/80 text-blue-900 text-center">1. Overview</th>
                              <th className="py-2.5 px-2.5 min-w-[120px] bg-emerald-50/80 text-emerald-900 text-center">2. QC Record</th>
                            </>
                          )}

                          <th className="py-2.5 px-3 min-w-[130px]">ประวัติเลื่อนเป้า (1 $\rightarrow$ 5)</th>
                          <th className="py-2.5 px-3 min-w-[150px]">หมายเหตุ / ปลายทาง</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.items.map((item, idx) => {
                          const customerName = item.customer || extractCustomer(item.projectName);
                          return (
                            <tr 
                              key={item.id}
                              className="hover:bg-sky-50/40 transition"
                            >
                              <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                                {idx + 1}
                              </td>

                              {/* Customer & Project + TAG */}
                              <td className="py-3 px-3 min-w-[140px]">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border ${
                                      item.workTag === 'Project'
                                        ? 'bg-violet-100 text-violet-800 border-violet-300'
                                        : 'bg-sky-100 text-sky-800 border-sky-300'
                                    }`}
                                  >
                                    {item.workTag || 'Service'}
                                  </span>
                                  <span className="font-bold text-slate-900 leading-snug" title={customerName}>
                                    {customerName}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                  {item.projectCode}
                                </div>
                              </td>

                              {/* Machine Name */}
                              <td className="py-3 px-3 font-medium whitespace-nowrap min-w-[130px]">
                                <button
                                  onClick={() => onSelectMachineByName(item.machineName)}
                                  className="font-bold text-sky-700 hover:text-sky-900 hover:underline flex items-center gap-1 text-left cursor-pointer"
                                >
                                  <Cpu className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                                  <span>{item.machineName}</span>
                                </button>
                                <div className="text-[10px] text-slate-400 leading-snug" title={item.projectName}>
                                  {item.projectName}
                                </div>
                              </td>

                              {/* Item Code (Double-click to search & open PDF in Google Drive) */}
                              <td
                                onDoubleClick={() => item.itemCode && item.itemCode !== '-' && searchAndOpenItemPdf(item.itemCode)}
                                title={
                                  item.itemCode && item.itemCode !== '-'
                                    ? `ดับเบิลคลิกเพื่อค้นหาและเปิดไฟล์ PDF (${formatItemCodeWithHyphens(item.itemCode)})`
                                    : undefined
                                }
                                className={`py-3 px-3 font-mono font-medium text-slate-800 whitespace-nowrap ${
                                  item.itemCode && item.itemCode !== '-'
                                    ? 'cursor-pointer hover:text-sky-700 hover:bg-sky-50/70 hover:underline transition-colors'
                                    : ''
                                }`}
                              >
                                {item.itemCode || '-'}
                              </td>

                              {/* Item Description */}
                              <td className="py-3 px-3 font-medium text-slate-900">
                                <div>{item.itemName}</div>
                                {item.docRef && (
                                  <div className="text-[10px] text-slate-400 mt-0.5">
                                    Ref: {item.docRef}
                                  </div>
                                )}
                              </td>

                              {/* Quantity */}
                              <td className="py-3 px-3 text-center font-bold text-slate-900 text-sm">
                                {item.qty}
                              </td>

                              {/* Production Order */}
                              <td className="py-3 px-3 font-mono text-slate-700 text-[11px]">
                                <div className="font-semibold text-slate-800">{item.prodOrder || '-'}</div>
                                {item.poPr && <div className="text-[10px] text-slate-400">{item.poPr}</div>}
                              </td>

                              {/* Dynamic Status Display Cell */}
                              {statusSource === 'qc' && (
                                <td className="py-3 px-3">
                                  {item.isQcPassed ? (
                                    <div className="space-y-0.5">
                                      <span 
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs"
                                        title={`ผ่านการตรวจ QC: วันที่ ${item.qcDate || '-'} โดย ${item.qcInspector || '-'} (${item.qcTopic || ''})`}
                                      >
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        ผ่าน QC แล้ว
                                      </span>
                                      <div className="text-[10px] text-slate-500 font-mono">
                                        {item.qcDate ? formatCompactDate(item.qcDate) : '-'}
                                      </div>
                                      {item.qcInspector && (
                                        <div className="text-[10px] text-emerald-700">
                                          ผู้ตรวจ: {item.qcInspector}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div>
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                        <Clock className="w-3 h-3 text-slate-400" />
                                        ยังไม่เข้า QC
                                      </span>
                                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">-</div>
                                    </div>
                                  )}
                                </td>
                              )}

                              {statusSource === 'overview' && (
                                <td className="py-3 px-3">
                                  {item.lastCompletedOp ? (
                                    <span 
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs"
                                      title={`ขั้นตอนที่เสร็จแล้ว: ${item.lastCompletedOp}${item.lastCompletedOpDesc ? ` (${item.lastCompletedOpDesc})` : ''}${item.lastCompletedOpWc ? ` [${item.lastCompletedOpWc}]` : ''}`}
                                    >
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      เสร็จแล้ว : {item.lastCompletedOpDesc || item.lastCompletedOp}
                                    </span>
                                  ) : isOverviewCompletedOrClosed(item.overviewStatus) ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      เสร็จแล้ว
                                    </span>
                                  ) : item.overviewStatus === 'Active' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                                      <TrendingUp className="w-3 h-3 text-blue-600" />
                                      Active
                                    </span>
                                  ) : item.overviewStatus === 'Ready to Start' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                      <Clock className="w-3 h-3 text-amber-600" />
                                      Ready to Start
                                    </span>
                                  ) : item.overviewStatus === 'Planned' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
                                      📅 Planned
                                    </span>
                                  ) : item.overviewStatus && !isOverviewCompletedOrClosed(item.overviewStatus) ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                                      {item.overviewStatus}
                                    </span>
                                  ) : !item.overviewStatus ? (
                                    <span className="text-slate-400 text-[10px] italic">
                                      {item.prodOrder ? 'ไม่พบใน Overview' : 'ไม่มีเลข PD'}
                                    </span>
                                  ) : null}
                                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                    {item.targetLatest ? formatCompactDate(item.targetLatest) : item.notifyDate ? formatCompactDate(item.notifyDate) : '-'}
                                  </div>
                                  {item.activeOp ? (
                                    <div className="mt-1 flex items-center">
                                      <span 
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-900 border border-blue-200"
                                        title={`Operation กำลังทำ: ${item.activeOp}`}
                                      >
                                        <TrendingUp className="w-2.5 h-2.5 text-blue-600 flex-shrink-0" />
                                        <span className="truncate max-w-[155px]">
                                          กำลังทำ : {item.activeOpDesc || item.activeOp}
                                        </span>
                                      </span>
                                    </div>
                                  ) : item.readyOp ? (
                                    <div className="mt-1 flex items-center">
                                      <span 
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs"
                                        title={`Operation รอขึ้นทำงาน: ${item.readyOp}`}
                                      >
                                        <Clock className="w-2.5 h-2.5 text-amber-600 flex-shrink-0 animate-pulse" />
                                        <span className="truncate max-w-[155px]">
                                          รอขึ้น : {item.readyOpDesc || item.readyOp}
                                        </span>
                                      </span>
                                    </div>
                                  ) : null}
                                </td>
                              )}

                              {statusSource === 'dual' && (
                                <>
                                  <td className="py-3 px-2.5 bg-blue-50/20 text-center">
                                    {item.lastCompletedOp ? (
                                      <span 
                                        className="font-bold text-emerald-700 text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 inline-block"
                                        title={`เสร็จแล้ว: ${item.lastCompletedOp}${item.lastCompletedOpDesc ? ` (${item.lastCompletedOpDesc})` : ''}`}
                                      >
                                        ✓ เสร็จแล้ว : {item.lastCompletedOpDesc || item.lastCompletedOp}
                                      </span>
                                    ) : isOverviewCompletedOrClosed(item.overviewStatus) ? (
                                      <span className="font-bold text-emerald-700 text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 inline-block">
                                        ✓ เสร็จแล้ว
                                      </span>
                                    ) : item.overviewStatus ? (
                                      <span className="font-bold text-blue-700 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 inline-block">
                                        {item.overviewStatus}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 text-[10px]">-</span>
                                    )}
                                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                      {item.targetLatest ? formatCompactDate(item.targetLatest) : item.notifyDate ? formatCompactDate(item.notifyDate) : '-'}
                                    </div>
                                    {item.activeOp ? (
                                      <div className="mt-1 flex justify-center">
                                        <span 
                                          className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-semibold bg-blue-100 text-blue-900 border border-blue-200"
                                          title={`กำลังทำ: ${item.activeOp}`}
                                        >
                                          <TrendingUp className="w-2 h-2 text-blue-600" />
                                          <span className="truncate max-w-[90px]">กำลังทำ : {item.activeOpDesc || item.activeOp}</span>
                                        </span>
                                      </div>
                                    ) : item.readyOp ? (
                                      <div className="mt-1 flex justify-center">
                                        <span 
                                          className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-semibold bg-amber-100 text-amber-900 border border-amber-300"
                                          title={`Operation รอขึ้น: ${item.readyOp}`}
                                        >
                                          <Clock className="w-2 h-2 text-amber-600" />
                                          <span className="truncate max-w-[90px]">รอขึ้น : {item.readyOpDesc || item.readyOp}</span>
                                        </span>
                                      </div>
                                    ) : null}
                                  </td>
                                  <td className="py-3 px-2.5 bg-emerald-50/20 text-center">
                                    {item.isQcPassed ? (
                                      <span className="font-bold text-emerald-800 text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 border border-emerald-200 inline-block">
                                        ผ่าน QC แล้ว
                                      </span>
                                    ) : (
                                      <span className="text-slate-500 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 inline-block">
                                        ยังไม่เข้า QC
                                      </span>
                                    )}
                                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                      {item.isQcPassed && item.qcDate ? formatCompactDate(item.qcDate) : '-'}
                                    </div>
                                  </td>
                                </>
                              )}

                              {/* Milestone History */}
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-1 text-[11px] font-mono">
                                  {item.target1 && (
                                    <span className={item.target2 ? 'line-through text-slate-400' : 'text-slate-700'}>
                                      {formatCompactDate(item.target1)}
                                    </span>
                                  )}
                                  {item.target2 && (
                                    <>
                                      <ArrowRight className="w-2.5 h-2.5 text-slate-300" />
                                      <span className={item.target3 ? 'line-through text-slate-400' : 'text-purple-700 font-medium'}>
                                        {formatCompactDate(item.target2)}
                                      </span>
                                    </>
                                  )}
                                  {item.target3 && (
                                    <>
                                      <ArrowRight className="w-2.5 h-2.5 text-slate-300" />
                                      <span className="text-purple-700 font-medium">
                                        {formatCompactDate(item.target3)}
                                      </span>
                                    </>
                                  )}
                                  {!item.target1 && <span className="text-slate-400">-</span>}
                                </div>
                              </td>

                              {/* Remark / Delivery Destination */}
                              <td className="py-3 px-3 text-slate-600 text-[11px] min-w-[160px]">
                                <div>{item.remark || '-'}</div>
                                  {(item.closed === '*' || item.closed?.toLowerCase().includes('close') || item.remark?.includes('*') || item.remark?.toLowerCase().includes('close')) && (
                                    <span className="text-[10px] text-amber-600 font-bold block mt-0.5">
                                      ★ Closed {item.closed ? `(${item.closed})` : '(*) / ส่งแล้ว'}
                                    </span>
                                  )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Print & PDF Modal */}
      <DeliveryPlanPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => {
          setIsPrintModalOpen(false);
          setSelectedPrintDate(null);
        }}
        items={items}
        initialSelectedDate={selectedPrintDate}
      />

    </div>
  );
};
