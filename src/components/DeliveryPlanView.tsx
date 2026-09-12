import React, { useState, useMemo, useEffect } from 'react';
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
  ShieldCheck,
  Building2,
  Briefcase,
  User,
  Truck,
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
  onRegisterActions?: (actions: { exportCsv: () => void; openPrint: () => void } | null) => void;
}

export const DeliveryPlanView: React.FC<DeliveryPlanViewProps> = ({
  items,
  machines,
  searchCriteria,
  onSelectMachineByName,
  onRefresh,
  onOpenComparator,
  isLoading,
  onRegisterActions,
}) => {
  const [internalSearch, setInternalSearch] = useState('');
  const [selectedMachine, setSelectedMachine] = useState('all');
  const [dateWindowFilter, setDateWindowFilter] = useState<'all' | 'overdue' | 'today' | '7days' | 'month' | 'qc-ready'>('all');
  const [overviewFilter, setOverviewFilter] = useState<string>('all');
  const [readyOpFilter, setReadyOpFilter] = useState<string>('all');
  const [statusSource, setStatusSource] = useState<'qc' | 'overview' | 'dual'>('overview');
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [selectedPrintDate, setSelectedPrintDate] = useState<string | null>(null);

  // Distinct ready operations and overview status counts for pending items
  const { readyOpsWithCount, overviewCounts } = useMemo(() => {
    const readyMap = new Map<string, number>();
    const ovCounts: Record<string, number> = {
      all: 0,
      Active: 0,
      Planned: 0,
      'Ready to Start': 0,
      Completed: 0,
      none: 0,
      hasReadyOp: 0,
    };

    items.forEach(i => {
      if (i.status === 'ส่งแล้ว') return;
      ovCounts.all++;
      const st = i.overviewStatus || '';
      if (isOverviewCompletedOrClosed(st)) {
        ovCounts.Completed++;
      } else if (st && ovCounts[st] !== undefined) {
        ovCounts[st]++;
      } else if (!st) {
        ovCounts.none++;
      }
      if (i.hasReadyOp || i.readyOp) {
        ovCounts.hasReadyOp++;
      }
      if (i.readyOpDesc) {
        const desc = i.readyOpDesc.trim();
        readyMap.set(desc, (readyMap.get(desc) || 0) + 1);
      }
    });

    const sortedReady = Array.from(readyMap.entries()).sort((a, b) => b[1] - a[1]);
    return {
      readyOpsWithCount: sortedReady,
      overviewCounts: ovCounts,
    };
  }, [items]);

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

      // Overview Status Filter (Toolbar or SearchCriteria)
      const effectiveOverview = overviewFilter !== 'all' ? overviewFilter : (searchCriteria.overviewStatus || 'all');
      if (effectiveOverview !== 'all') {
        if (effectiveOverview === 'none') {
          if (item.overviewStatus) return false;
        } else if (effectiveOverview === 'Completed') {
          if (!isOverviewCompletedOrClosed(item.overviewStatus)) return false;
        } else if ((item.overviewStatus || '').toLowerCase() !== effectiveOverview.toLowerCase()) {
          return false;
        }
      }

      // Ready Operation Filter (Toolbar or SearchCriteria)
      const effectiveReadyOp = readyOpFilter !== 'all' ? readyOpFilter : (searchCriteria.readyOpName || 'all');
      if (effectiveReadyOp !== 'all') {
        if (effectiveReadyOp === 'any_ready') {
          if (!item.hasReadyOp && !item.readyOp) return false;
        } else if (!item.readyOpDesc?.toLowerCase().includes(effectiveReadyOp.toLowerCase()) &&
                   !item.readyOp?.toLowerCase().includes(effectiveReadyOp.toLowerCase())) {
          return false;
        }
      }

      // Machine Dropdown filter
      if (selectedMachine !== 'all' && item.machineName !== selectedMachine) return false;

      // Internal text search
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
  }, [items, searchCriteria, selectedMachine, internalSearch, dateWindowFilter, overviewFilter, readyOpFilter]);

  // Overall statistics for pending items
  const stats = useMemo(() => {
    let totalQty = 0;
    let overdueCount = 0;
    let dueSoonCount = 0;
    let qcPassedCount = 0;
    let qcPassedQty = 0;
    const machineSet = new Set<string>();

    pendingItems.forEach(i => {
      totalQty += i.qty;
      if (i.isOverdue) overdueCount++;
      if (i.isDueSoon) dueSoonCount++;
      if (i.isQcPassed) {
        qcPassedCount++;
        qcPassedQty += i.qty;
      }
      if (i.machineName && i.machineName !== '(ไม่ระบุเครื่องจักร)') {
        machineSet.add(i.machineName);
      }
    });

    return {
      totalItems: pendingItems.length,
      totalQty,
      overdueCount,
      dueSoonCount,
      qcPassedCount,
      qcPassedQty,
      machinesCount: machineSet.size,
    };
  }, [pendingItems]);

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
          machines: new Set<string>(),
          items: []
        };
      }

      groups[dateKey].totalQty += item.qty;
      if (item.isQcPassed) groups[dateKey].qcPassedCount++;
      if (item.machineName) groups[dateKey].machines.add(item.machineName);
      groups[dateKey].items.push(item);
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

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    dateGroups.forEach(g => { next[g.dateKey] = true; });
    setExpandedDates(next);
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    dateGroups.forEach(g => { next[g.dateKey] = false; });
    setExpandedDates(next);
  };

  // Export Delivery Plan to CSV
  const handleExportCsv = () => {
    const headers = [
      'แผนวันที่ส่งมอบ',
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
  };

  // Register export and print actions with parent (e.g. for SearchFilterBar)
  useEffect(() => {
    if (onRegisterActions) {
      onRegisterActions({
        exportCsv: handleExportCsv,
        openPrint: () => {
          setSelectedPrintDate('all');
          setIsPrintModalOpen(true);
        }
      });
      return () => {
        onRegisterActions(null);
      };
    }
  }, [onRegisterActions, handleExportCsv]);

  return (
    <div className="space-y-4 sm:space-y-5">
      
      {/* Slim Plan Note */}
      <div className="flex items-center justify-between gap-2 px-1 text-xs text-slate-500">
        <div className="flex items-center gap-1.5 font-medium">
          <Truck className="w-4 h-4 text-sky-600" />
          <span className="font-bold text-slate-700">แผนการส่งมอบประจำวัน (Daily Delivery Schedule)</span>
          <span className="text-slate-400 hidden sm:inline">• คัดกรองเฉพาะงานที่ยังไม่ส่งมอบ จัดตามเป้าส่งวันต่อวัน</span>
        </div>
      </div>

      {/* 1. Key Metrics for Pending Plan */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Metric 1: Total Pending */}
        <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/50 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-sky-900">งานรอส่งทั้งหมด</span>
            <div className="p-2 rounded-lg bg-sky-100 text-sky-700">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-sky-950">{stats.totalItems} <span className="text-xs font-normal text-sky-700">รายการ</span></div>
            <div className="text-xs text-sky-700 mt-0.5">รวมทั้งหมด {stats.totalQty} ชิ้น</div>
          </div>
        </div>

        {/* Metric 2: Delivery Dates Count */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">วันที่ต้องจัดส่ง</span>
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900">{dateGroups.length} <span className="text-xs font-normal text-slate-500">วัน</span></div>
            <div className="text-xs text-slate-500 mt-0.5">ครอบคลุม {stats.machinesCount} เครื่องจักร</div>
          </div>
        </div>

        {/* Metric 3: Overdue Backlog */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between ${
          stats.overdueCount > 0 ? 'bg-rose-50/70 border-rose-200' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${stats.overdueCount > 0 ? 'text-rose-900' : 'text-slate-600'}`}>
              เกินกำหนดส่ง
            </span>
            <div className={`p-2 rounded-lg ${stats.overdueCount > 0 ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-slate-100 text-slate-500'}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className={`text-2xl font-bold ${stats.overdueCount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
              {stats.overdueCount} <span className="text-xs font-normal text-slate-500">รายการ</span>
            </div>
            <div className="text-xs text-rose-600 mt-0.5 font-medium">
              {stats.overdueCount > 0 ? 'ต้องเร่งรัดการจัดส่งทันที' : 'ไม่มีงานตกค้าง'}
            </div>
          </div>
        </div>

        {/* Metric 4: 7 Days Ahead */}
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-900">กำหนดส่งใน 7 วัน</span>
            <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-amber-900">{stats.dueSoonCount} <span className="text-xs font-normal text-amber-700">รายการ</span></div>
            <div className="text-xs text-amber-700 mt-0.5">เตรียมความพร้อมสัปดาห์นี้</div>
          </div>
        </div>

        {/* Metric 5: QC Passed & Ready */}
        <div className="col-span-2 sm:col-span-2 lg:col-span-1 p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-900">ผ่าน QC พร้อมส่ง</span>
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-emerald-700">{stats.qcPassedCount} <span className="text-xs font-normal text-emerald-800">รายการ</span></div>
            <div className="text-xs text-emerald-800 mt-0.5 font-medium">พร้อมจัดส่ง {stats.qcPassedQty} ชิ้น</div>
          </div>
        </div>
      </div>

      {/* 2. Filter & Control Toolbar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          {/* Quick Search & Machine Controls */}
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={internalSearch}
                onChange={(e) => setInternalSearch(e.target.value)}
                placeholder="ค้นหาชื่อชิ้นงาน, เครื่องจักร, PD No., โครงการ..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-sky-500 focus:bg-white"
              />
            </div>

            {/* Machine dropdown */}
            <div className="flex items-center gap-1 text-xs">
              <Cpu className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedMachine}
                onChange={(e) => setSelectedMachine(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none max-w-[170px] truncate"
              >
                <option value="all">ทุกเครื่องจักร ({machines.length})</option>
                {machines.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name} ({m.pendingItems} รอส่ง)
                  </option>
                ))}
              </select>
            </div>

            {/* Expand / Collapse All */}
            <div className="flex items-center gap-1">
              <button
                onClick={expandAll}
                className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
              >
                ขยายทุกวัน
              </button>
              <button
                onClick={collapseAll}
                className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
              >
                ย่อทุกวัน
              </button>
            </div>
          </div>

          {/* Quick Action Buttons (ย้ายมาอยู่ข้างตัวกรอง เพื่อประหยัดพื้นที่) */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap shrink-0">
            {onOpenComparator && (
              <button
                onClick={onOpenComparator}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition active:scale-95 cursor-pointer"
                title="เปิดหน้าต่างเปรียบเทียบสถานะ Production Order"
              >
                <GitCompare className="w-3.5 h-3.5 text-blue-200" />
                <span>ตัวเทียบ Production Order</span>
              </button>
            )}
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isLoading}
                title="กดเพื่อดึงข้อมูลล่าสุดจาก Google Sheets และอัปเดตเลขที่ PD"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-sky-400' : 'text-sky-400'}`} />
                <span>{isLoading ? 'กำลังอัปเดต...' : 'อัปเดตข้อมูล'}</span>
              </button>
            )}
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white text-slate-800 hover:bg-slate-100 border border-slate-300 shadow-xs transition active:scale-95 cursor-pointer"
              title="ส่งออกแผนส่งมอบประจำวันเป็นไฟล์ CSV"
            >
              <Download className="w-3.5 h-3.5 text-sky-600" />
              <span>ส่งออกแผนส่งมอบ (CSV)</span>
            </button>
            <button
              onClick={() => {
                setSelectedPrintDate('all');
                setIsPrintModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-xs transition active:scale-95 cursor-pointer border border-sky-400/30"
              title="พิมพ์หรือบันทึกแผนส่งมอบเป็นเอกสาร PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>พิมพ์แผน / บันทึกเป็น PDF</span>
            </button>
          </div>
        </div>

        {/* Date Window Filter Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-400 text-[11px] font-medium mr-1">ช่วงเวลาแผนส่งมอบ:</span>
          
          <button
            onClick={() => setDateWindowFilter('all')}
            className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
              dateWindowFilter === 'all'
                ? 'bg-slate-800 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ทั้งหมด ({pendingItems.length})
          </button>

          <button
            onClick={() => setDateWindowFilter('overdue')}
            className={`px-3 py-1 rounded-lg font-medium flex items-center gap-1 transition cursor-pointer ${
              dateWindowFilter === 'overdue'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            เกินกำหนด ({stats.overdueCount})
          </button>

          <button
            onClick={() => setDateWindowFilter('7days')}
            className={`px-3 py-1 rounded-lg font-medium flex items-center gap-1 transition cursor-pointer ${
              dateWindowFilter === '7days'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <Clock className="w-3 h-3" />
            ภายใน 7 วัน ({stats.dueSoonCount})
          </button>

          <button
            onClick={() => setDateWindowFilter('qc-ready')}
            className={`px-3 py-1 rounded-lg font-medium flex items-center gap-1 transition cursor-pointer ${
              dateWindowFilter === 'qc-ready'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            ผ่าน QC แล้วพร้อมส่ง ({stats.qcPassedCount})
          </button>
        </div>

        {/* Overview Status & Ready Operation Filters */}
        <div className="flex items-center gap-3 flex-wrap pt-2.5 border-t border-slate-100 text-xs">
          {/* Overview Status Quick Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-600 font-semibold flex items-center gap-1 text-[11px]">
              <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
              <span>ตัวกรองสถานะ Overview:</span>
            </span>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
              <button
                onClick={() => setOverviewFilter('all')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                  overviewFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ทั้งหมด
              </button>
              <button
                onClick={() => setOverviewFilter(prev => prev === 'Active' ? 'all' : 'Active')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                  overviewFilter === 'Active'
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'text-blue-700 hover:bg-blue-50'
                }`}
              >
                ⚡ Active ({overviewCounts.Active})
              </button>
              <button
                onClick={() => setOverviewFilter(prev => prev === 'Planned' ? 'all' : 'Planned')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                  overviewFilter === 'Planned'
                    ? 'bg-purple-600 text-white shadow-2xs font-bold'
                    : 'text-purple-700 hover:bg-purple-50'
                }`}
              >
                📅 Planned ({overviewCounts.Planned})
              </button>
              <button
                onClick={() => setOverviewFilter(prev => prev === 'Ready to Start' ? 'all' : 'Ready to Start')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                  overviewFilter === 'Ready to Start'
                    ? 'bg-amber-600 text-white shadow-2xs font-bold'
                    : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                🕒 Ready to Start ({overviewCounts['Ready to Start']})
              </button>
              <button
                onClick={() => setOverviewFilter(prev => prev === 'Completed' ? 'all' : 'Completed')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                  overviewFilter === 'Completed'
                    ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                ✓ เสร็จแล้ว ({overviewCounts.Completed})
              </button>
            </div>
          </div>

          {/* Ready Operation Filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-amber-900 font-bold flex items-center gap-1 text-[11px]">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Op รอขึ้นทำงาน:</span>
            </span>

            <button
              onClick={() => setReadyOpFilter(prev => prev === 'any_ready' ? 'all' : 'any_ready')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer border ${
                readyOpFilter === 'any_ready'
                  ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                  : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border-amber-200'
              }`}
            >
              <Clock className="w-3 h-3 text-amber-600" />
              <span>เฉพาะมี Op รอขึ้น ({overviewCounts.hasReadyOp})</span>
            </button>

            {readyOpsWithCount.length > 0 && (
              <select
                value={readyOpFilter !== 'any_ready' ? readyOpFilter : 'all'}
                onChange={(e) => setReadyOpFilter(e.target.value)}
                className={`px-2 py-1 rounded-lg border text-xs font-semibold outline-none max-w-[200px] truncate ${
                  readyOpFilter !== 'all' && readyOpFilter !== 'any_ready'
                    ? 'bg-amber-100 text-amber-950 border-amber-400 ring-1 ring-amber-400'
                    : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                <option value="all">เลือกขั้นตอนรอขึ้น ({readyOpsWithCount.length} ขั้นตอน)...</option>
                {readyOpsWithCount.map(([opName, count], i) => (
                  <option key={i} value={opName}>
                    {opName} ({count} รายการ)
                  </option>
                ))}
              </select>
            )}

            {(overviewFilter !== 'all' || readyOpFilter !== 'all') && (
              <button
                onClick={() => {
                  setOverviewFilter('all');
                  setReadyOpFilter('all');
                }}
                className="text-[11px] text-rose-600 hover:text-rose-800 underline font-medium ml-1 cursor-pointer"
              >
                ล้างตัวกรองสถานะ/Op
              </button>
            )}
          </div>
        </div>

        {/* Status Source View Switcher */}
        <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-slate-100 flex-wrap text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-bold flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>แหล่งตรวจสอบสถานะในตาราง:</span>
            </span>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
              <button
                onClick={() => setStatusSource('overview')}
                className={`px-2.5 py-1 rounded-md text-xs transition cursor-pointer ${
                  statusSource === 'overview'
                    ? 'bg-white text-blue-800 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
              >
                📊 Overview status (Completed / Active...)
              </button>
              <button
                onClick={() => setStatusSource('qc')}
                className={`px-2.5 py-1 rounded-md text-xs transition cursor-pointer ${
                  statusSource === 'qc'
                    ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
              >
                🛡️ QC Record (ผ่าน QC / ยังไม่เข้า)
              </button>
              <button
                onClick={() => setStatusSource('dual')}
                className={`px-2.5 py-1 rounded-md text-xs transition cursor-pointer ${
                  statusSource === 'dual'
                    ? 'bg-white text-purple-800 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
              >
                ⚡ แสดงทั้ง 2 แหล่ง (Dual)
              </button>
            </div>
          </div>

          {onOpenComparator && (
            <button
              onClick={onOpenComparator}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200 font-semibold transition cursor-pointer"
            >
              <GitCompare className="w-3.5 h-3.5 text-blue-600" />
              <span>เปิดตัวเทียบสถานะ PD แบบละเอียด</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. Daily Schedule Groups List */}
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
                      </div>

                      <p className="text-xs text-slate-500 mt-0.5">
                        เป้าหมายส่งมอบตามเอกสาร: <span className="font-mono font-semibold text-slate-700">{group.dateKey}</span>
                      </p>
                    </div>
                  </div>

                  {/* Right: Summary Pills & Toggle */}
                  <div className="flex items-center gap-3 self-end sm:self-center flex-wrap">
                    {/* Items count & Qty */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-800 shadow-2xs">
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

                              {/* Customer & Project */}
                              <td className="py-3 px-3 min-w-[140px]">
                                <div className="font-bold text-slate-900 leading-snug" title={customerName}>
                                  {customerName}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono">
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

                              {/* Item Code */}
                              <td className="py-3 px-3 font-mono font-medium text-slate-800 whitespace-nowrap">
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
                                  {isOverviewCompletedOrClosed(item.overviewStatus) && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      เสร็จแล้ว
                                    </span>
                                  )}
                                  {item.overviewStatus === 'Active' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                                      <TrendingUp className="w-3 h-3 text-blue-600" />
                                      Active
                                    </span>
                                  )}
                                  {item.overviewStatus === 'Ready to Start' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                      <Clock className="w-3 h-3 text-amber-600" />
                                      Ready to Start
                                    </span>
                                  )}
                                  {item.overviewStatus === 'Planned' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
                                      📅 Planned
                                    </span>
                                  )}
                                  {item.overviewStatus && !isOverviewCompletedOrClosed(item.overviewStatus) && !['Active', 'Ready to Start', 'Planned'].includes(item.overviewStatus) && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                                      {item.overviewStatus}
                                    </span>
                                  )}
                                  {!item.overviewStatus && (
                                    <span className="text-slate-400 text-[10px] italic">
                                      {item.prodOrder ? 'ไม่พบใน Overview' : 'ไม่มีเลข PD'}
                                    </span>
                                  )}
                                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                    {item.targetLatest ? formatCompactDate(item.targetLatest) : item.notifyDate ? formatCompactDate(item.notifyDate) : '-'}
                                  </div>
                                  {item.readyOp ? (
                                    <div className="mt-1 flex items-center">
                                      <span 
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs"
                                        title={`Operation รอขึ้นทำงาน: ${item.readyOp}`}
                                      >
                                        <Clock className="w-2.5 h-2.5 text-amber-600 flex-shrink-0 animate-pulse" />
                                        <span className="truncate max-w-[155px]">รอขึ้น: {item.readyOpDesc || item.readyOp}</span>
                                      </span>
                                    </div>
                                  ) : item.activeOp ? (
                                    <div className="mt-1 flex items-center">
                                      <span 
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-900 border border-blue-200"
                                        title={`Operation กำลังทำ: ${item.activeOp}`}
                                      >
                                        <TrendingUp className="w-2.5 h-2.5 text-blue-600 flex-shrink-0" />
                                        <span className="truncate max-w-[155px]">กำลังทำ: {item.activeOpDesc || item.activeOp}</span>
                                      </span>
                                    </div>
                                  ) : null}
                                </td>
                              )}

                              {statusSource === 'dual' && (
                                <>
                                  <td className="py-3 px-2.5 bg-blue-50/20 text-center">
                                    {isOverviewCompletedOrClosed(item.overviewStatus) ? (
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
                                    {item.readyOp ? (
                                      <div className="mt-1 flex justify-center">
                                        <span 
                                          className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-semibold bg-amber-100 text-amber-900 border border-amber-300"
                                          title={`Operation รอขึ้น: ${item.readyOp}`}
                                        >
                                          <Clock className="w-2 h-2 text-amber-600" />
                                          <span className="truncate max-w-[90px]">{item.readyOpDesc || item.readyOp}</span>
                                        </span>
                                      </div>
                                    ) : item.activeOp ? (
                                      <div className="mt-1 flex justify-center">
                                        <span 
                                          className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-semibold bg-blue-100 text-blue-900 border border-blue-200"
                                          title={`กำลังทำ: ${item.activeOp}`}
                                        >
                                          <span className="truncate max-w-[90px]">{item.activeOpDesc || item.activeOp}</span>
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
