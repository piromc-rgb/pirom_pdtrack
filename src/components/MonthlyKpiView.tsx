import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Layers, 
  Cpu, 
  Building2, 
  ArrowRight, 
  Filter, 
  Download, 
  FileText, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp, 
  BarChart3, 
  Percent, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownRight, 
  Minus,
  Sparkles,
  Info,
  Wrench,
  FolderGit2
} from 'lucide-react';
import { DeliveryItem, MachineSummary, SearchCriteria } from '../types';
import { 
  formatThaiDate, 
  parseDate, 
  getMonthKey, 
  formatThaiMonth, 
  formatThaiMonthShort, 
  getDaysBetweenDates, 
  isDateOverdue 
} from '../utils/dateUtils';
import { searchAndOpenItemPdf, formatItemCodeWithHyphens } from '../utils/pdfFinder';

interface MonthlyKpiViewProps {
  items: DeliveryItem[];
  machines?: MachineSummary[];
  onSelectMachineByName?: (name: string) => void;
}

export interface MonthKpiData {
  monthKey: string;           // '2026-07' or 'no-date'
  label: string;              // 'กรกฎาคม 2569'
  shortLabel: string;         // 'ก.ค. 2569'
  sortValue: number;

  // Total in scope
  totalItems: number;
  totalQty: number;

  // Target 1 metrics
  t1TotalItems: number;
  t1TotalQty: number;
  t1OnTimeItems: number;      // ส่งแล้วตรงเป้า 1 (ไม่เลื่อน)
  t1OnTimeQty: number;
  t1OnTimeRate: number;       // % ส่งตรงเป้า 1
  t1MovedLaterItems: number;  // เลื่อนข้ามไปเดือนถัดไป

  // Target Latest metrics
  tLatTotalItems: number;
  tLatTotalQty: number;
  tLatDeliveredItems: number; // ส่งแล้วตามเป้าล่าสุด
  tLatDeliveredQty: number;
  tLatDeliveryRate: number;   // % ส่งแล้วตามเป้าล่าสุด
  tLatPendingItems: number;
  tLatPendingQty: number;
  tLatOverdueItems: number;

  // Variance & Rescheduled
  rescheduledItems: number;
  rescheduledRate: number;
  varianceRate: number;       // tLatDeliveryRate - t1OnTimeRate (Gap)

  // Service breakdown
  service: {
    totalItems: number;
    t1Items: number;
    t1OnTime: number;
    t1OnTimeRate: number;
    tLatItems: number;
    tLatDelivered: number;
    tLatDeliveryRate: number;
    rescheduled: number;
  };

  // Project breakdown
  project: {
    totalItems: number;
    t1Items: number;
    t1OnTime: number;
    t1OnTimeRate: number;
    tLatItems: number;
    tLatDelivered: number;
    tLatDeliveryRate: number;
    rescheduled: number;
  };

  items: DeliveryItem[];
}

export const MonthlyKpiView: React.FC<MonthlyKpiViewProps> = ({
  items,
  machines = [],
  onSelectMachineByName,
}) => {
  // Filters
  const [workScope, setWorkScope] = useState<'all' | 'Service' | 'Project' | 'compare'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [groupBasis, setGroupBasis] = useState<'targetLatest' | 'target1'>('targetLatest');
  const [itemStatusFilter, setItemStatusFilter] = useState<'all' | 'on-time-t1' | 'delivered' | 'rescheduled' | 'pending' | 'overdue'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

  // Helper to check if an item was delivered on-time according to Target 1
  const isItemOnTimeT1 = (item: DeliveryItem): boolean => {
    if (item.status !== 'ส่งแล้ว') return false;
    // If no target 1 was defined, fallback to targetLatest
    if (!item.target1) return true;
    
    // If it had rescheduled targets (target2..5)
    if (item.target2 || item.target3 || item.target4 || item.target5) {
      // Check if targetLatest is still <= target1
      const d1 = parseDate(item.target1);
      const dLat = parseDate(item.targetLatest);
      if (d1 && dLat && dLat.getTime() <= d1.getTime()) {
        return true;
      }
      return false;
    }

    if (item.targetLatest && item.target1 !== item.targetLatest) {
      const d1 = parseDate(item.target1);
      const dLat = parseDate(item.targetLatest);
      if (d1 && dLat && dLat.getTime() > d1.getTime()) {
        return false;
      }
    }

    return true;
  };

  // Helper to check if item was rescheduled
  const isItemRescheduled = (item: DeliveryItem): boolean => {
    if (item.target2 || item.target3 || item.target4 || item.target5) return true;
    if (item.target1 && item.targetLatest && item.target1.trim() !== item.targetLatest.trim()) {
      const d1 = parseDate(item.target1);
      const dLat = parseDate(item.targetLatest);
      if (d1 && dLat && dLat.getTime() > d1.getTime()) {
        return true;
      }
    }
    return false;
  };

  // Filter items by workScope (when not in 'compare' mode)
  const scopedItems = useMemo(() => {
    if (workScope === 'Service') {
      return items.filter(i => (i.workTag || 'Service') === 'Service');
    }
    if (workScope === 'Project') {
      return items.filter(i => i.workTag === 'Project');
    }
    return items;
  }, [items, workScope]);

  // Build Monthly KPI Aggregations
  const monthlyDataList = useMemo(() => {
    const monthMap = new Map<string, DeliveryItem[]>();

    // Group items by month based on groupBasis
    scopedItems.forEach(item => {
      let mKey: string | null = null;
      if (groupBasis === 'target1') {
        mKey = getMonthKey(item.target1) || getMonthKey(item.targetLatest);
      } else {
        mKey = getMonthKey(item.targetLatest) || getMonthKey(item.target1);
      }
      const finalKey = mKey || 'no-date';

      if (!monthMap.has(finalKey)) {
        monthMap.set(finalKey, []);
      }
      monthMap.get(finalKey)!.push(item);
    });

    const list: MonthKpiData[] = [];

    monthMap.forEach((mItems, monthKey) => {
      let totalQty = 0;
      let t1TotalItems = 0;
      let t1TotalQty = 0;
      let t1OnTimeItems = 0;
      let t1OnTimeQty = 0;
      let t1MovedLaterItems = 0;

      let tLatTotalItems = 0;
      let tLatTotalQty = 0;
      let tLatDeliveredItems = 0;
      let tLatDeliveredQty = 0;
      let tLatPendingItems = 0;
      let tLatPendingQty = 0;
      let tLatOverdueItems = 0;
      let rescheduledItems = 0;

      // Service breakdown
      const sItems = mItems.filter(i => (i.workTag || 'Service') === 'Service');
      let sT1Count = 0;
      let sT1OnTime = 0;
      let sTLatCount = 0;
      let sTLatDelivered = 0;
      let sRescheduled = 0;

      // Project breakdown
      const pItems = mItems.filter(i => i.workTag === 'Project');
      let pT1Count = 0;
      let pT1OnTime = 0;
      let pTLatCount = 0;
      let pTLatDelivered = 0;
      let pRescheduled = 0;

      mItems.forEach(item => {
        totalQty += item.qty;
        const isDelivered = item.status === 'ส่งแล้ว';
        const onTimeT1 = isItemOnTimeT1(item);
        const rescheduled = isItemRescheduled(item);

        if (item.target1) {
          t1TotalItems++;
          t1TotalQty += item.qty;
          if (onTimeT1) {
            t1OnTimeItems++;
            t1OnTimeQty += item.qty;
          }
          // Check if moved to a later month
          const t1M = getMonthKey(item.target1);
          const tLatM = getMonthKey(item.targetLatest);
          if (t1M && tLatM && tLatM > t1M) {
            t1MovedLaterItems++;
          }
        }

        if (item.targetLatest || item.target1) {
          tLatTotalItems++;
          tLatTotalQty += item.qty;
          if (isDelivered) {
            tLatDeliveredItems++;
            tLatDeliveredQty += item.qty;
          } else {
            tLatPendingItems++;
            tLatPendingQty += item.qty;
            if (item.isOverdue) {
              tLatOverdueItems++;
            }
          }
        } else {
          // No date items
          if (isDelivered) {
            tLatDeliveredItems++;
            tLatDeliveredQty += item.qty;
          } else {
            tLatPendingItems++;
            tLatPendingQty += item.qty;
          }
        }

        if (rescheduled) {
          rescheduledItems++;
        }

        // Service
        if ((item.workTag || 'Service') === 'Service') {
          if (item.target1) sT1Count++;
          if (onTimeT1) sT1OnTime++;
          if (item.targetLatest || item.target1) sTLatCount++;
          if (isDelivered) sTLatDelivered++;
          if (rescheduled) sRescheduled++;
        } else {
          // Project
          if (item.target1) pT1Count++;
          if (onTimeT1) pT1OnTime++;
          if (item.targetLatest || item.target1) pTLatCount++;
          if (isDelivered) pTLatDelivered++;
          if (rescheduled) pRescheduled++;
        }
      });

      const t1OnTimeRate = t1TotalItems > 0 ? Math.round((t1OnTimeItems / t1TotalItems) * 100) : 0;
      const tLatDeliveryRate = tLatTotalItems > 0 ? Math.round((tLatDeliveredItems / tLatTotalItems) * 100) : 0;
      const rescheduledRate = mItems.length > 0 ? Math.round((rescheduledItems / mItems.length) * 100) : 0;
      const varianceRate = tLatDeliveryRate - t1OnTimeRate;

      // Sort value
      let sortValue = 0;
      if (monthKey === 'no-date') {
        sortValue = 99999999;
      } else {
        const [y, m] = monthKey.split('-').map(Number);
        sortValue = y * 100 + m;
      }

      list.push({
        monthKey,
        label: formatThaiMonth(monthKey),
        shortLabel: formatThaiMonthShort(monthKey),
        sortValue,
        totalItems: mItems.length,
        totalQty,
        t1TotalItems,
        t1TotalQty,
        t1OnTimeItems,
        t1OnTimeQty,
        t1OnTimeRate,
        t1MovedLaterItems,
        tLatTotalItems,
        tLatTotalQty,
        tLatDeliveredItems,
        tLatDeliveredQty,
        tLatDeliveryRate,
        tLatPendingItems,
        tLatPendingQty,
        tLatOverdueItems,
        rescheduledItems,
        rescheduledRate,
        varianceRate,
        service: {
          totalItems: sItems.length,
          t1Items: sT1Count,
          t1OnTime: sT1OnTime,
          t1OnTimeRate: sT1Count > 0 ? Math.round((sT1OnTime / sT1Count) * 100) : 0,
          tLatItems: sTLatCount,
          tLatDelivered: sTLatDelivered,
          tLatDeliveryRate: sTLatCount > 0 ? Math.round((sTLatDelivered / sTLatCount) * 100) : 0,
          rescheduled: sRescheduled,
        },
        project: {
          totalItems: pItems.length,
          t1Items: pT1Count,
          t1OnTime: pT1OnTime,
          t1OnTimeRate: pT1Count > 0 ? Math.round((pT1OnTime / pT1Count) * 100) : 0,
          tLatItems: pTLatCount,
          tLatDelivered: pTLatDelivered,
          tLatDeliveryRate: pTLatCount > 0 ? Math.round((pTLatDelivered / pTLatCount) * 100) : 0,
          rescheduled: pRescheduled,
        },
        items: mItems,
      });
    });

    // Sort chronologically
    list.sort((a, b) => a.sortValue - b.sortValue);
    return list;
  }, [scopedItems, groupBasis]);

  // Overall Global KPI Metrics for current selection
  const overallKpi = useMemo(() => {
    let targetMonths = monthlyDataList;
    if (selectedMonth !== 'all') {
      targetMonths = monthlyDataList.filter(m => m.monthKey === selectedMonth);
    }

    let totalItems = 0;
    let totalQty = 0;
    let t1TotalItems = 0;
    let t1OnTimeItems = 0;
    let tLatTotalItems = 0;
    let tLatDeliveredItems = 0;
    let tLatPendingItems = 0;
    let tLatOverdueItems = 0;
    let rescheduledItems = 0;

    let sTotal = 0;
    let sT1OnTime = 0;
    let sTLatDelivered = 0;
    let pTotal = 0;
    let pT1OnTime = 0;
    let pTLatDelivered = 0;

    targetMonths.forEach(m => {
      totalItems += m.totalItems;
      totalQty += m.totalQty;
      t1TotalItems += m.t1TotalItems;
      t1OnTimeItems += m.t1OnTimeItems;
      tLatTotalItems += m.tLatTotalItems;
      tLatDeliveredItems += m.tLatDeliveredItems;
      tLatPendingItems += m.tLatPendingItems;
      tLatOverdueItems += m.tLatOverdueItems;
      rescheduledItems += m.rescheduledItems;

      sTotal += m.service.totalItems;
      sT1OnTime += m.service.t1OnTime;
      sTLatDelivered += m.service.tLatDelivered;

      pTotal += m.project.totalItems;
      pT1OnTime += m.project.t1OnTime;
      pTLatDelivered += m.project.tLatDelivered;
    });

    const t1OnTimeRate = t1TotalItems > 0 ? Math.round((t1OnTimeItems / t1TotalItems) * 100) : 0;
    const tLatDeliveryRate = tLatTotalItems > 0 ? Math.round((tLatDeliveredItems / tLatTotalItems) * 100) : 0;
    const rescheduledRate = totalItems > 0 ? Math.round((rescheduledItems / totalItems) * 100) : 0;
    const varianceRate = tLatDeliveryRate - t1OnTimeRate;

    return {
      totalItems,
      totalQty,
      t1TotalItems,
      t1OnTimeItems,
      t1OnTimeRate,
      tLatTotalItems,
      tLatDeliveredItems,
      tLatDeliveryRate,
      tLatPendingItems,
      tLatOverdueItems,
      rescheduledItems,
      rescheduledRate,
      varianceRate,
      service: {
        total: sTotal,
        onTimeT1: sT1OnTime,
        onTimeT1Rate: sTotal > 0 ? Math.round((sT1OnTime / sTotal) * 100) : 0,
        delivered: sTLatDelivered,
        deliveredRate: sTotal > 0 ? Math.round((sTLatDelivered / sTotal) * 100) : 0,
      },
      project: {
        total: pTotal,
        onTimeT1: pT1OnTime,
        onTimeT1Rate: pTotal > 0 ? Math.round((pT1OnTime / pTotal) * 100) : 0,
        delivered: pTLatDelivered,
        deliveredRate: pTotal > 0 ? Math.round((pTLatDelivered / pTotal) * 100) : 0,
      },
    };
  }, [monthlyDataList, selectedMonth]);

  // Filtered Items for Drilldown Table
  const drilldownItems = useMemo(() => {
    let pool: DeliveryItem[] = [];
    if (selectedMonth === 'all') {
      pool = scopedItems;
    } else {
      const match = monthlyDataList.find(m => m.monthKey === selectedMonth);
      pool = match ? match.items : [];
    }

    return pool.filter(item => {
      // Status filter
      if (itemStatusFilter === 'on-time-t1' && !isItemOnTimeT1(item)) return false;
      if (itemStatusFilter === 'delivered' && item.status !== 'ส่งแล้ว') return false;
      if (itemStatusFilter === 'rescheduled' && !isItemRescheduled(item)) return false;
      if (itemStatusFilter === 'pending' && item.status === 'ส่งแล้ว') return false;
      if (itemStatusFilter === 'overdue' && !item.isOverdue) return false;

      // Quick search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        const mItemCode = item.itemCode?.toLowerCase().includes(term);
        const mItemName = item.itemName?.toLowerCase().includes(term);
        const mMachine = item.machineName?.toLowerCase().includes(term);
        const mProj = item.projectName?.toLowerCase().includes(term) || item.projectCode?.toLowerCase().includes(term);
        const mPo = item.prodOrder?.toLowerCase().includes(term);
        const mDoc = item.docRef?.toLowerCase().includes(term);
        if (!mItemCode && !mItemName && !mMachine && !mProj && !mPo && !mDoc) {
          return false;
        }
      }

      return true;
    });
  }, [scopedItems, monthlyDataList, selectedMonth, itemStatusFilter, searchTerm]);

  // Export Monthly KPI Summary to CSV
  const exportKpiCsv = () => {
    const headers = [
      'เดือน',
      'เป้าหมายที่ 1 (รายการแผน)',
      'ส่งตรงเป้า 1 (รายการ)',
      '% ส่งตรงเป้าหมายที่ 1',
      'เลื่อนข้ามเดือน (รายการ)',
      'เป้าหมายล่าสุด (รายการแผน)',
      'ส่งแล้วสะสมล่าสุด (รายการ)',
      'ค้างส่ง (รายการ)',
      'เกินกำหนด (รายการ)',
      '% ส่งมอบเป้าหมายล่าสุด',
      'ผลต่าง % (Variance)',
      'รายการที่เลื่อนแผนรวม',
      'งาน Service ส่งแล้ว % (ตรงเป้า1 %)',
      'งาน Project ส่งแล้ว % (ตรงเป้า1 %)',
    ];

    const rows = monthlyDataList.map(m => [
      `"${m.label}"`,
      m.t1TotalItems,
      m.t1OnTimeItems,
      `${m.t1OnTimeRate}%`,
      m.t1MovedLaterItems,
      m.tLatTotalItems,
      m.tLatDeliveredItems,
      m.tLatPendingItems,
      m.tLatOverdueItems,
      `${m.tLatDeliveryRate}%`,
      `${m.varianceRate > 0 ? '+' : ''}${m.varianceRate}%`,
      m.rescheduledItems,
      `${m.service.tLatDeliveryRate}% (ตรงเป้า1: ${m.service.t1OnTimeRate}%)`,
      `${m.project.tLatDeliveryRate}% (ตรงเป้า1: ${m.project.t1OnTimeRate}%)`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AMW_PDTrack_Monthly_KPI_Summary_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleMonthExpand = (key: string) => {
    setExpandedMonths(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header & Controls Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Title & Subtitle */}
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/20">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>สรุป KPI %การส่งมอบ ประจำเดือน</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    เป้าหมายล่าสุด vs เป้าหมายที่ 1
                  </span>
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  วิเคราะห์ผลการส่งมอบเทียบระหว่างเป้าหมายเริ่มแรก (Baseline) และเป้าหมายล่าสุด (Current Plan) ครอบคลุมทั้งงาน Service และงานโครงการ
                </p>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={exportKpiCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white text-slate-700 hover:bg-slate-50 hover:text-emerald-700 border border-slate-300 shadow-xs transition active:scale-95 cursor-pointer"
              title="ส่งออกรายงานสรุป KPI ประจำเดือนเป็นไฟล์ CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>ส่งออกสรุป KPI (CSV)</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          
          {/* Work Scope Selector (All / Service / Project / Side-by-Side) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              <span>ประเภทงาน:</span>
            </span>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-0.5">
              <button
                onClick={() => setWorkScope('all')}
                className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                  workScope === 'all'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ทั้งหมด (All)
              </button>
              <button
                onClick={() => setWorkScope('Service')}
                className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                  workScope === 'Service'
                    ? 'bg-amber-500 text-white shadow-xs font-bold'
                    : 'text-amber-800 hover:bg-amber-100/60'
                }`}
              >
                <Wrench className="w-3 h-3" />
                <span>งาน Service</span>
              </button>
              <button
                onClick={() => setWorkScope('Project')}
                className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                  workScope === 'Project'
                    ? 'bg-sky-600 text-white shadow-xs font-bold'
                    : 'text-sky-800 hover:bg-sky-100/60'
                }`}
              >
                <FolderGit2 className="w-3 h-3" />
                <span>งานโครงการ</span>
              </button>
              <button
                onClick={() => setWorkScope('compare')}
                className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                  workScope === 'compare'
                    ? 'bg-indigo-600 text-white shadow-xs font-bold'
                    : 'text-indigo-800 hover:bg-indigo-100/60'
                }`}
              >
                <BarChart3 className="w-3 h-3" />
                <span>เทียบเคียงข้าง</span>
              </button>
            </div>
          </div>

          {/* Month Grouping Basis & Month Picker */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-500">ฐานรอบเดือน:</span>
              <select
                value={groupBasis}
                onChange={(e) => setGroupBasis(e.target.value as 'targetLatest' | 'target1')}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="targetLatest">เดือนตามเป้าหมายล่าสุด (Current Plan)</option>
                <option value="target1">เดือนตามเป้าหมายที่ 1 (Initial Plan)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-500">เลือกเดือน:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="all">ทุกเดือน (รวมทั้งหมด)</option>
                {monthlyDataList.map(m => (
                  <option key={m.monthKey} value={m.monthKey}>
                    {m.label} ({m.totalItems} รายการ)
                  </option>
                ))}
              </select>
            </div>
          </div>

        </div>
      </div>

      {/* 2. Top Executive KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI Card 1: % ส่งมอบสำเร็จตามเป้าหมายล่าสุด */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">
              % ส่งมอบตามเป้าหมายล่าสุด
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              Latest Plan
            </span>
          </div>
          
          <div className="my-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600 tracking-tight">
              {overallKpi.tLatDeliveryRate}%
            </span>
            <span className="text-xs text-slate-500">
              ({overallKpi.tLatDeliveredItems} / {overallKpi.tLatTotalItems} รายการ)
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                style={{ width: `${overallKpi.tLatDeliveryRate}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>ส่งแล้ว {overallKpi.tLatDeliveredItems} รายการ</span>
              <span className="text-amber-600 font-semibold">ค้างส่ง {overallKpi.tLatPendingItems}</span>
            </div>
          </div>
        </div>

        {/* KPI Card 2: % ส่งมอบตรงเวลาตามเป้าหมายที่ 1 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">
              % ส่งตรงตามเป้าหมายที่ 1
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800">
              Baseline Target 1
            </span>
          </div>

          <div className="my-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-sky-600 tracking-tight">
              {overallKpi.t1OnTimeRate}%
            </span>
            <span className="text-xs text-slate-500">
              ({overallKpi.t1OnTimeItems} / {overallKpi.t1TotalItems} รายการ)
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-sky-500 rounded-full transition-all duration-700"
                style={{ width: `${overallKpi.t1OnTimeRate}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>ส่งตรงเป้า 1: {overallKpi.t1OnTimeItems} รายการ</span>
              <span className="text-rose-600 font-medium">หลุดเป้า 1: {overallKpi.t1TotalItems - overallKpi.t1OnTimeItems}</span>
            </div>
          </div>
        </div>

        {/* KPI Card 3: ผลต่าง KPI & อัตราการเลื่อนเป้าหมาย */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">
              ผลต่างเปรียบเทียบ & การเลื่อนแผน
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
              Plan Variance
            </span>
          </div>

          <div className="my-3 flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold tracking-tight ${
              overallKpi.varianceRate > 0 ? 'text-amber-600' : 'text-slate-700'
            }`}>
              {overallKpi.varianceRate > 0 ? `+${overallKpi.varianceRate}%` : `${overallKpi.varianceRate}%`}
            </span>
            <span className="text-xs text-slate-500">
              ส่วนต่างระหว่างล่าสุด vs เป้า 1
            </span>
          </div>

          <div className="text-[11px] space-y-1">
            <div className="flex items-center justify-between text-slate-600">
              <span>รายการที่มีการเลื่อนเป้าหมาย:</span>
              <span className="font-bold text-amber-700">{overallKpi.rescheduledItems} ({overallKpi.rescheduledRate}%)</span>
            </div>
            <div className="flex items-center justify-between text-slate-500 text-[10px]">
              <span>จำนวนชิ้นงานรวม:</span>
              <span className="font-semibold text-slate-700">{overallKpi.totalQty.toLocaleString()} ชิ้น</span>
            </div>
          </div>
        </div>

        {/* KPI Card 4: สรุปภาพรวม Service vs Project */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">
              สัดส่วน Service เทียบ โครงการ
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
              Work Split
            </span>
          </div>

          <div className="my-2 space-y-2">
            {/* Service */}
            <div className="p-2 rounded-xl bg-amber-50/70 border border-amber-200/60">
              <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                <span className="flex items-center gap-1">
                  <Wrench className="w-3 h-3 text-amber-600" />
                  <span>Service: {overallKpi.service.total} รายการ</span>
                </span>
                <span className="text-emerald-700">{overallKpi.service.deliveredRate}% ส่งแล้ว</span>
              </div>
              <div className="text-[10px] text-amber-700 mt-0.5 flex justify-between">
                <span>ส่งตรงเป้า 1: {overallKpi.service.onTimeT1Rate}%</span>
                <span>({overallKpi.service.onTimeT1} รายการ)</span>
              </div>
            </div>

            {/* Project */}
            <div className="p-2 rounded-xl bg-sky-50/70 border border-sky-200/60">
              <div className="flex items-center justify-between text-xs font-bold text-sky-900">
                <span className="flex items-center gap-1">
                  <FolderGit2 className="w-3 h-3 text-sky-600" />
                  <span>โครงการ: {overallKpi.project.total} รายการ</span>
                </span>
                <span className="text-sky-700">{overallKpi.project.deliveredRate}% ส่งแล้ว</span>
              </div>
              <div className="text-[10px] text-sky-700 mt-0.5 flex justify-between">
                <span>ส่งตรงเป้า 1: {overallKpi.project.onTimeT1Rate}%</span>
                <span>({overallKpi.project.onTimeT1} รายการ)</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 3. Side-by-Side Comparison Mode Section (when 'compare' mode or toggle is active) */}
      {workScope === 'compare' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          
          {/* Service Column */}
          <div className="bg-gradient-to-br from-amber-50/40 via-white to-white rounded-2xl border-2 border-amber-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-amber-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500 text-white shadow-xs">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-amber-950 text-sm sm:text-base">งาน Service (Check list ส่งมอบ)</h3>
                  <p className="text-[11px] text-amber-700">งานซ่อมบำรุง, อะไหล่เปลี่ยนตามระยะ และงานด่วนบริการ</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-900">
                {overallKpi.service.total} รายการ
              </span>
            </div>

            {/* Key Comparison Gauges */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white border border-amber-100 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-medium block">ส่งตรงตามเป้าหมาย 1</span>
                <span className="text-2xl font-bold text-amber-700">{overallKpi.service.onTimeT1Rate}%</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">{overallKpi.service.onTimeT1} / {overallKpi.service.total} รายการ</span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-amber-100 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-medium block">ส่งแล้วตามเป้าล่าสุด</span>
                <span className="text-2xl font-bold text-emerald-600">{overallKpi.service.deliveredRate}%</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">{overallKpi.service.delivered} / {overallKpi.service.total} รายการ</span>
              </div>
            </div>

            {/* Monthly Trend Mini-bars */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-slate-700 block">อัตราการส่งมอบรายเดือน (งาน Service):</span>
              {monthlyDataList.filter(m => m.service.totalItems > 0).map(m => (
                <div key={m.monthKey} className="p-2.5 rounded-lg bg-amber-50/50 border border-amber-100/80 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{m.label}</span>
                    <span className="text-[11px] text-slate-600">{m.service.totalItems} รายการ</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <div className="flex justify-between text-slate-500">
                        <span>ตรงเป้า 1:</span>
                        <span className="font-bold text-sky-700">{m.service.t1OnTimeRate}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-0.5">
                        <div className="h-full bg-sky-500" style={{ width: `${m.service.t1OnTimeRate}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-slate-500">
                        <span>เป้าล่าสุด:</span>
                        <span className="font-bold text-emerald-700">{m.service.tLatDeliveryRate}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-0.5">
                        <div className="h-full bg-emerald-500" style={{ width: `${m.service.tLatDeliveryRate}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Project Column */}
          <div className="bg-gradient-to-br from-sky-50/40 via-white to-white rounded-2xl border-2 border-sky-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-600 text-white shadow-xs">
                  <FolderGit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sky-950 text-sm sm:text-base">งานโครงการ (Project Machine List)</h3>
                  <p className="text-[11px] text-sky-700">สั่งผลิตเครื่องจักรตาม Machine List, โครงการหลักฝ่ายผลิต</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-sky-100 text-sky-900">
                {overallKpi.project.total} รายการ
              </span>
            </div>

            {/* Key Comparison Gauges */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white border border-sky-100 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-medium block">ส่งตรงตามเป้าหมาย 1</span>
                <span className="text-2xl font-bold text-sky-700">{overallKpi.project.onTimeT1Rate}%</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">{overallKpi.project.onTimeT1} / {overallKpi.project.total} รายการ</span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-sky-100 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-medium block">ส่งแล้วตามเป้าล่าสุด</span>
                <span className="text-2xl font-bold text-emerald-600">{overallKpi.project.deliveredRate}%</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">{overallKpi.project.delivered} / {overallKpi.project.total} รายการ</span>
              </div>
            </div>

            {/* Monthly Trend Mini-bars */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-slate-700 block">อัตราการส่งมอบรายเดือน (งานโครงการ):</span>
              {monthlyDataList.filter(m => m.project.totalItems > 0).map(m => (
                <div key={m.monthKey} className="p-2.5 rounded-lg bg-sky-50/50 border border-sky-100/80 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{m.label}</span>
                    <span className="text-[11px] text-slate-600">{m.project.totalItems} รายการ</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <div className="flex justify-between text-slate-500">
                        <span>ตรงเป้า 1:</span>
                        <span className="font-bold text-sky-700">{m.project.t1OnTimeRate}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-0.5">
                        <div className="h-full bg-sky-500" style={{ width: `${m.project.t1OnTimeRate}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-slate-500">
                        <span>เป้าล่าสุด:</span>
                        <span className="font-bold text-emerald-700">{m.project.tLatDeliveryRate}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-0.5">
                        <div className="h-full bg-emerald-500" style={{ width: `${m.project.tLatDeliveryRate}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* 4. Monthly KPI Comparison Matrix Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>ตารางเปรียบเทียบ KPI %การส่งมอบรายเดือน (Monthly Comparison Table)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              เปรียบเทียบเป้าหมายที่ 1 (Initial Target) กับเป้าหมายล่าสุด (Latest Target) ในแต่ละรอบเดือน
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              {monthlyDataList.length} รอบเดือน
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                <th className="py-3 px-3.5 whitespace-nowrap">ประจำเดือน</th>
                <th className="py-3 px-3 text-center border-l border-slate-200 bg-sky-50/70 text-sky-900" colSpan={3}>
                  เป้าหมายที่ 1 (Initial Target)
                </th>
                <th className="py-3 px-3 text-center border-l border-slate-200 bg-emerald-50/70 text-emerald-900" colSpan={4}>
                  เป้าหมายล่าสุด (Latest Target)
                </th>
                <th className="py-3 px-3 text-center border-l border-slate-200 bg-amber-50/70 text-amber-900" colSpan={2}>
                  เปรียบเทียบ & เลื่อนแผน
                </th>
                <th className="py-3 px-3 text-center border-l border-slate-200">สัดส่วนประเภท</th>
                <th className="py-3 px-3 text-center border-l border-slate-200">การประเมิน</th>
                <th className="py-3 px-3 text-right">เจาะลึก</th>
              </tr>
              <tr className="bg-slate-50 text-[11px] text-slate-600 border-b border-slate-200">
                <th className="py-2 px-3.5">เดือน / ปี</th>
                
                {/* T1 */}
                <th className="py-2 px-2.5 text-center border-l border-slate-200 bg-sky-50/30">ยอดแผน (T1)</th>
                <th className="py-2 px-2.5 text-center bg-sky-50/30">ส่งตรงเป้า 1</th>
                <th className="py-2 px-2.5 text-center bg-sky-50/30 font-bold text-sky-700">% ส่งตรงเป้า 1</th>

                {/* TLat */}
                <th className="py-2 px-2.5 text-center border-l border-slate-200 bg-emerald-50/30">ยอดแผน (ล่าสุด)</th>
                <th className="py-2 px-2.5 text-center bg-emerald-50/30">ส่งสำเร็จสะสม</th>
                <th className="py-2 px-2.5 text-center bg-emerald-50/30">ค้างส่ง</th>
                <th className="py-2 px-2.5 text-center bg-emerald-50/30 font-bold text-emerald-700">% ส่งตามเป้าล่าสุด</th>

                {/* Compare */}
                <th className="py-2 px-2.5 text-center border-l border-slate-200 bg-amber-50/30">ผลต่าง % (Variance)</th>
                <th className="py-2 px-2.5 text-center bg-amber-50/30">เลื่อนแผน (รายการ)</th>

                {/* Type & Evaluation */}
                <th className="py-2 px-2.5 text-center border-l border-slate-200">Service / โครงการ</th>
                <th className="py-2 px-2.5 text-center border-l border-slate-200">เกณฑ์ KPI</th>
                <th className="py-2 px-3 text-right">รายการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthlyDataList.map((m) => {
                const isSelected = selectedMonth === m.monthKey;
                const isAchieved = m.tLatDeliveryRate >= 80;
                const isModerate = m.tLatDeliveryRate >= 50 && m.tLatDeliveryRate < 80;

                return (
                  <tr 
                    key={m.monthKey} 
                    onClick={() => setSelectedMonth(selectedMonth === m.monthKey ? 'all' : m.monthKey)}
                    className={`transition cursor-pointer ${
                      isSelected 
                        ? 'bg-emerald-50/90 font-medium' 
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Month Label */}
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-600' : 'bg-slate-300'}`} />
                        <span>{m.label}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 pl-3.5">
                        รวม {m.totalItems} รายการ ({m.totalQty.toLocaleString()} ชิ้น)
                      </span>
                    </td>

                    {/* T1 Planned */}
                    <td className="py-3 px-2.5 text-center border-l border-slate-100 text-slate-700">
                      {m.t1TotalItems} <span className="text-[10px] text-slate-400">รายการ</span>
                    </td>

                    {/* T1 On-Time */}
                    <td className="py-3 px-2.5 text-center text-slate-800">
                      <span className="font-semibold text-sky-700">{m.t1OnTimeItems}</span>
                    </td>

                    {/* T1 On-Time Rate */}
                    <td className="py-3 px-2.5 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-sky-700">{m.t1OnTimeRate}%</span>
                        <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-0.5">
                          <div className="h-full bg-sky-500 rounded-full" style={{ width: `${m.t1OnTimeRate}%` }} />
                        </div>
                      </div>
                    </td>

                    {/* TLat Planned */}
                    <td className="py-3 px-2.5 text-center border-l border-slate-100 text-slate-700">
                      {m.tLatTotalItems} <span className="text-[10px] text-slate-400">รายการ</span>
                    </td>

                    {/* TLat Delivered */}
                    <td className="py-3 px-2.5 text-center">
                      <span className="font-semibold text-emerald-700">{m.tLatDeliveredItems}</span>
                    </td>

                    {/* TLat Pending */}
                    <td className="py-3 px-2.5 text-center">
                      {m.tLatPendingItems > 0 ? (
                        <span className="font-semibold text-amber-600">
                          {m.tLatPendingItems}
                          {m.tLatOverdueItems > 0 && (
                            <span className="text-[10px] text-rose-600 block">
                              (เกิน {m.tLatOverdueItems})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* TLat Delivery Rate */}
                    <td className="py-3 px-2.5 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-extrabold text-emerald-600">{m.tLatDeliveryRate}%</span>
                        <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-0.5">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${m.tLatDeliveryRate}%` }} />
                        </div>
                      </div>
                    </td>

                    {/* Variance */}
                    <td className="py-3 px-2.5 text-center border-l border-slate-100">
                      <span className={`inline-flex items-center gap-0.5 font-bold px-1.5 py-0.5 rounded text-[11px] ${
                        m.varianceRate > 0 
                          ? 'bg-amber-50 text-amber-800' 
                          : m.varianceRate === 0 
                          ? 'bg-slate-100 text-slate-700' 
                          : 'bg-rose-50 text-rose-700'
                      }`}>
                        {m.varianceRate > 0 ? `+${m.varianceRate}%` : `${m.varianceRate}%`}
                      </span>
                    </td>

                    {/* Rescheduled items */}
                    <td className="py-3 px-2.5 text-center">
                      {m.rescheduledItems > 0 ? (
                        <span className="text-amber-700 font-semibold">
                          {m.rescheduledItems} <span className="text-[10px] text-slate-400">({m.rescheduledRate}%)</span>
                          {m.t1MovedLaterItems > 0 && (
                            <span className="text-[9px] text-rose-500 block">เลื่อนข้ามเดือน {m.t1MovedLaterItems}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    {/* Service / Project Breakdown */}
                    <td className="py-3 px-2.5 text-center border-l border-slate-100">
                      <div className="space-y-0.5 text-[10px]">
                        {m.service.totalItems > 0 && (
                          <div className="text-amber-800 font-medium">
                            S: {m.service.totalItems} ({m.service.tLatDeliveryRate}%)
                          </div>
                        )}
                        {m.project.totalItems > 0 && (
                          <div className="text-sky-800 font-medium">
                            P: {m.project.totalItems} ({m.project.tLatDeliveryRate}%)
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Evaluation Badge */}
                    <td className="py-3 px-2.5 text-center border-l border-slate-100">
                      {isAchieved ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>บรรลุเป้าหมาย</span>
                        </span>
                      ) : isModerate ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          <Clock className="w-2.5 h-2.5" />
                          <span>ระดับปานกลาง</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          <span>ต้องเร่งรัด</span>
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMonth(selectedMonth === m.monthKey ? 'all' : m.monthKey);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                        title="ดูรายละเอียดรายการของเดือนนี้"
                      >
                        <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'rotate-90 text-emerald-600' : ''}`} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Detailed Items Drilldown Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Drilldown Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>รายการชิ้นส่วนประกอบ KPI (Items Drilldown)</span>
              {selectedMonth !== 'all' && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {formatThaiMonth(selectedMonth)}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              แสดงข้อมูลรายการ รายละเอียดการเลื่อนเป้าหมายจากเป้าหมายที่ 1 สู่เป้าหมายล่าสุด
            </p>
          </div>

          {/* Search & Status Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              placeholder="ค้นหา ชิ้นส่วน / เครื่องจักร / โครงการ / PD..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 w-48 sm:w-64"
            />

            <select
              value={itemStatusFilter}
              onChange={(e) => setItemStatusFilter(e.target.value as any)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">สถานะทั้งหมด</option>
              <option value="on-time-t1">ส่งตรงเป้า 1 (On-time T1)</option>
              <option value="delivered">ส่งแล้วเสร็จทั้งหมด (Delivered)</option>
              <option value="rescheduled">มีการเลื่อนเป้าหมาย (Rescheduled)</option>
              <option value="pending">รอดำเนินการ (Pending)</option>
              <option value="overdue">เกินกำหนด (Overdue)</option>
            </select>
          </div>
        </div>

        {/* Drilldown Table */}
        <div className="overflow-x-auto max-h-[520px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-100 text-slate-700 font-semibold z-10 shadow-2xs">
              <tr className="border-b border-slate-200">
                <th className="py-2.5 px-3">ประเภท</th>
                <th className="py-2.5 px-3">รายการชิ้นส่วน / รหัส</th>
                <th className="py-2.5 px-3">เครื่องจักร / โครงการ</th>
                <th className="py-2.5 px-3 text-center">PD / Act Line</th>
                <th className="py-2.5 px-3 text-center">เป้าหมายที่ 1</th>
                <th className="py-2.5 px-3 text-center">เส้นทางเลื่อนเป้าหมาย (T1 ➔ ล่าสุด)</th>
                <th className="py-2.5 px-3 text-center">เป้าหมายล่าสุด</th>
                <th className="py-2.5 px-3 text-center">สถานะการส่งมอบ</th>
                <th className="py-2.5 px-3 text-right">แบบ DWG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {drilldownItems.slice(0, 100).map((item) => {
                const onTimeT1 = isItemOnTimeT1(item);
                const isRescheduled = isItemRescheduled(item);
                const isDelivered = item.status === 'ส่งแล้ว';
                const daysDiff = getDaysBetweenDates(item.target1, item.targetLatest);

                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    
                    {/* Work Tag */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {item.workTag === 'Project' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                          <FolderGit2 className="w-2.5 h-2.5" />
                          <span>โครงการ</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          <Wrench className="w-2.5 h-2.5" />
                          <span>Service</span>
                        </span>
                      )}
                    </td>

                    {/* Item Details */}
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-800 hover:text-emerald-700">
                        {item.itemName}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {formatItemCodeWithHyphens(item.itemCode)}
                      </div>
                    </td>

                    {/* Machine & Project */}
                    <td className="py-2.5 px-3">
                      {item.machineName && item.machineName !== '(ไม่ระบุเครื่องจักร)' ? (
                        <button
                          onClick={() => onSelectMachineByName?.(item.machineName)}
                          className="font-bold text-slate-700 hover:text-sky-600 transition flex items-center gap-1 cursor-pointer"
                        >
                          <Cpu className="w-3 h-3 text-slate-400" />
                          <span>{item.machineName}</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 italic">ไม่ระบุเครื่อง</span>
                      )}
                      <div className="text-[10px] text-slate-500 truncate max-w-xs">
                        {item.projectName || item.projectCode || '-'}
                      </div>
                    </td>

                    {/* PD / Act Line */}
                    <td className="py-2.5 px-3 text-center">
                      <div className="font-mono text-slate-700 font-medium">
                        {item.prodOrder || '-'}
                      </div>
                      {item.pdActLine && (
                        <div className="text-[10px] text-slate-400">Line: {item.pdActLine}</div>
                      )}
                    </td>

                    {/* Target 1 */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="font-semibold text-slate-800">
                        {item.target1 || '-'}
                      </div>
                    </td>

                    {/* Reschedule flow */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {isRescheduled ? (
                        <div className="flex items-center justify-center gap-1 text-[11px]">
                          <span className="text-slate-400 line-through">{item.target1 || 'เป้า1'}</span>
                          <ArrowRight className="w-3 h-3 text-amber-500" />
                          <span className="font-bold text-amber-700">{item.targetLatest}</span>
                          {daysDiff && daysDiff > 0 && (
                            <span className="text-[10px] font-bold px-1 rounded bg-amber-100 text-amber-800">
                              +{daysDiff} วัน
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">- ตรงตามเป้าหมาย -</span>
                      )}
                    </td>

                    {/* Target Latest */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="font-bold text-slate-900">
                        {item.targetLatest || '-'}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {isDelivered ? (
                        onTimeT1 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>ส่งตรงเป้า 1</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
                            <CheckCircle2 className="w-3 h-3 text-teal-600" />
                            <span>ส่งแล้ว (ตามเป้าเลื่อน)</span>
                          </span>
                        )
                      ) : item.isOverdue ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          <span>เกินกำหนดส่ง</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <Clock className="w-3 h-3 text-blue-500" />
                          <span>รอดำเนินการ</span>
                        </span>
                      )}
                    </td>

                    {/* Drawing DWG */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => searchAndOpenItemPdf(item.itemCode, item.itemName)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                        title="เปิดไฟล์แบบ drawing PDF"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {drilldownItems.length > 100 && (
          <div className="p-3 text-center text-xs text-slate-500 bg-slate-50 border-t border-slate-100">
            แสดง 100 รายการแรกจากทั้งหมด {drilldownItems.length} รายการ (ใช้ช่องค้นหาเพื่อเจาะจงรายการเพิ่มเติม)
          </div>
        )}
      </div>

    </div>
  );
};
