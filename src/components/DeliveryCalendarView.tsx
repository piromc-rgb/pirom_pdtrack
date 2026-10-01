import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Cpu,
  Layers,
  Tag,
  Boxes,
  Search,
  X,
  FileText,
  Truck,
  Sparkles,
  Filter
} from 'lucide-react';
import { DeliveryItem, MachineSummary, SearchCriteria } from '../types';
import { parseDate, formatThaiDate, formatThaiDayOfWeek, extractCustomer } from '../utils/dateUtils';
import { matchItemWithQuickSearch, matchDocRefFilter } from '../utils/searchUtils';
import { isOverviewCompletedOrClosed } from '../services/sheetService';
import { searchAndOpenItemPdf, formatItemCodeWithHyphens } from '../utils/pdfFinder';

interface DeliveryCalendarViewProps {
  items: DeliveryItem[];
  machines: MachineSummary[];
  searchCriteria: SearchCriteria;
  onSelectMachineByName: (machineName: string) => void;
}

type CalendarViewMode = 'month' | 'week';
type DeliveryStatusFilter = 'all' | 'pending' | 'delivered' | 'overdue';
type WorkTypeFilter = 'all' | 'Service' | 'Project';

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

const THAI_DAYS_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const THAI_DAYS_FULL = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getStartOfWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay(); // 0 (Sun) to 6 (Sat)
  // Start week on Monday (1), or Sunday (0). Let's start on Sunday (0) to match standard calendar headers
  copy.setDate(copy.getDate() - day);
  return copy;
}

export const DeliveryCalendarView: React.FC<DeliveryCalendarViewProps> = ({
  items,
  searchCriteria,
  onSelectMachineByName,
}) => {
  // Local calendar controls
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<DeliveryStatusFilter>('all');
  const [workTypeFilter, setWorkTypeFilter] = useState<WorkTypeFilter>('all');
  const [localSearch, setLocalSearch] = useState<string>('');
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  // Determine initial reference date (today, or nearest date with items if current month has none)
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });

  // Helper to check if an item is considered "ส่งแล้ว / เสร็จแล้ว"
  const isItemDelivered = (item: DeliveryItem): boolean => {
    return item.status === 'ส่งแล้ว';
  };

  // Filter items using global searchCriteria + local Calendar filters
  const filteredItemsWithDate = useMemo(() => {
    return items
      .map((item) => {
        const parsed = item.parsedLatestDate || parseDate(item.targetLatest);
        return { item, parsedDate: parsed };
      })
      .filter(({ item, parsedDate }) => {
        if (!parsedDate) return false;

        // 1. Local Delivery Status Filter (รอส่ง / ส่งไปแล้ว / เกินกำหนด / ทั้งหมด)
        const delivered = isItemDelivered(item);
        if (deliveryStatusFilter === 'pending' && delivered) return false;
        if (deliveryStatusFilter === 'delivered' && !delivered) return false;
        if (deliveryStatusFilter === 'overdue' && (delivered || !item.isOverdue)) return false;

        // 2. Local Work Type Filter (Service / Project / ทั้งหมด)
        const itemTag = item.workTag || 'Service';
        if (workTypeFilter !== 'all' && itemTag !== workTypeFilter) return false;

        // 3. Global SearchCriteria filters
        if (searchCriteria.docRef && !matchDocRefFilter(item.docRef, searchCriteria.docRef)) {
          return false;
        }
        if (searchCriteria.projectCode && !item.projectCode.toLowerCase().includes(searchCriteria.projectCode.toLowerCase())) {
          return false;
        }
        if (searchCriteria.projectName && !item.projectName.toLowerCase().includes(searchCriteria.projectName.toLowerCase())) {
          return false;
        }
        if (searchCriteria.docType && !item.docType.toLowerCase().includes(searchCriteria.docType.toLowerCase())) {
          return false;
        }
        if (searchCriteria.machineName && !item.machineName.toLowerCase().includes(searchCriteria.machineName.toLowerCase())) {
          return false;
        }
        if (searchCriteria.requestDept && !(item.requestDept || '').toLowerCase().includes(searchCriteria.requestDept.toLowerCase())) {
          return false;
        }
        if (searchCriteria.actionTopic && !(item.actionTopic || '').toLowerCase().includes(searchCriteria.actionTopic.toLowerCase())) {
          return false;
        }
        if (searchCriteria.qcStatus === 'passed' && !item.isQcPassed) return false;
        if (searchCriteria.qcStatus === 'pending' && item.isQcPassed) return false;

        if (searchCriteria.overviewStatus && searchCriteria.overviewStatus !== 'all') {
          if (searchCriteria.overviewStatus === 'none') {
            if (item.overviewStatus) return false;
          } else if (searchCriteria.overviewStatus === 'Completed') {
            if (!isOverviewCompletedOrClosed(item.overviewStatus)) return false;
          } else if ((item.overviewStatus || '').toLowerCase() !== searchCriteria.overviewStatus.toLowerCase()) {
            return false;
          }
        }

        if (searchCriteria.readyOpName && searchCriteria.readyOpName !== 'all') {
          if (searchCriteria.readyOpName === 'any_ready') {
            if (!item.hasReadyOp) return false;
          } else if (item.readyOpDesc !== searchCriteria.readyOpName) {
            return false;
          }
        }

        if (searchCriteria.operationStatus && searchCriteria.operationStatus !== 'all') {
          if (searchCriteria.operationStatus === 'ready' && !item.hasReadyOp) return false;
          if (searchCriteria.operationStatus === 'active' && !item.activeOp) return false;
          if (searchCriteria.operationStatus === 'completed' && !item.isAllCompleted && !isOverviewCompletedOrClosed(item.overviewStatus)) return false;
          if (searchCriteria.operationStatus === 'none' && (item.hasReadyOp || item.activeOp || item.isAllCompleted)) return false;
        }

        const combinedQuick = (localSearch || searchCriteria.quickSearch || '').trim();
        if (combinedQuick && !matchItemWithQuickSearch(item, combinedQuick)) {
          return false;
        }

        return true;
      });
  }, [items, deliveryStatusFilter, workTypeFilter, searchCriteria, localSearch]);

  // Group items by YYYY-MM-DD key
  const itemsByDateKey = useMemo(() => {
    const map = new Map<string, DeliveryItem[]>();
    filteredItemsWithDate.forEach(({ item, parsedDate }) => {
      if (!parsedDate) return;
      const key = toDateKey(parsedDate);
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    });
    return map;
  }, [filteredItemsWithDate]);

  // Available months that have items (for quick jump dropdown)
  const availableMonths = useMemo(() => {
    const monthMap = new Map<string, { year: number; month: number; count: number; pending: number; delivered: number }>();
    filteredItemsWithDate.forEach(({ item, parsedDate }) => {
      if (!parsedDate) return;
      const y = parsedDate.getFullYear();
      const m = parsedDate.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const existing = monthMap.get(key) || { year: y, month: m, count: 0, pending: 0, delivered: 0 };
      existing.count++;
      if (isItemDelivered(item)) {
        existing.delivered++;
      } else {
        existing.pending++;
      }
      monthMap.set(key, existing);
    });
    return Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, val]) => ({ key, ...val }));
  }, [filteredItemsWithDate]);

  // Build calendar cells for Month View (42 cells = 6 weeks) or Week View (7 cells)
  const calendarDays = useMemo(() => {
    const today = new Date();
    if (viewMode === 'month') {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDayOfMonth = new Date(year, month, 1);
      const startDayOfWeek = firstDayOfMonth.getDay(); // 0..6
      const startDate = new Date(year, month, 1 - startDayOfWeek);

      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const totalCells = Math.ceil((startDayOfWeek + daysInMonth) / 7) * 7;

      const cells = [];
      for (let i = 0; i < totalCells; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
        const key = toDateKey(d);
        const dayItems = itemsByDateKey.get(key) || [];
        cells.push({
          date: d,
          dateKey: key,
          isCurrentMonth: d.getMonth() === month,
          isToday: isSameDay(d, today),
          items: dayItems,
        });
      }
      return cells;
    } else {
      // Week view (7 days from Sunday to Saturday)
      const startOfWeek = getStartOfWeek(currentDate);
      const cells = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + i);
        const key = toDateKey(d);
        const dayItems = itemsByDateKey.get(key) || [];
        cells.push({
          date: d,
          dateKey: key,
          isCurrentMonth: true,
          isToday: isSameDay(d, today),
          items: dayItems,
        });
      }
      return cells;
    }
  }, [currentDate, viewMode, itemsByDateKey]);

  // Summary statistics for the currently visible period (Month or Week)
  const periodStats = useMemo(() => {
    let total = 0;
    let pending = 0;
    let delivered = 0;
    let overdue = 0;
    let serviceCount = 0;
    let projectCount = 0;
    let totalQty = 0;

    calendarDays.forEach((cell) => {
      if (viewMode === 'month' && !cell.isCurrentMonth) return;
      cell.items.forEach((item) => {
        total++;
        totalQty += item.qty || 0;
        if (isItemDelivered(item)) {
          delivered++;
        } else {
          pending++;
          if (item.isOverdue) overdue++;
        }
        if (item.workTag === 'Project') {
          projectCount++;
        } else {
          serviceCount++;
        }
      });
    });

    return { total, pending, delivered, overdue, serviceCount, projectCount, totalQty };
  }, [calendarDays, viewMode]);

  // Navigation handlers
  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    } else {
      setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7));
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    } else {
      setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7));
    }
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    setSelectedDateKey(toDateKey(now));
  };

  // Period header title
  const periodTitle = useMemo(() => {
    if (viewMode === 'month') {
      const mName = THAI_MONTHS[currentDate.getMonth()];
      const yBE = currentDate.getFullYear() + 543;
      return `${mName} ${yBE} (${currentDate.getFullYear()})`;
    } else {
      const start = getStartOfWeek(currentDate);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      const sDay = start.getDate();
      const sMonth = THAI_MONTHS_SHORT[start.getMonth()];
      const sYear = start.getFullYear() + 543;
      const eDay = end.getDate();
      const eMonth = THAI_MONTHS_SHORT[end.getMonth()];
      const eYear = end.getFullYear() + 543;
      if (start.getMonth() === end.getMonth()) {
        return `สัปดาห์ที่ ${sDay} - ${eDay} ${sMonth} ${sYear}`;
      }
      return `สัปดาห์ที่ ${sDay} ${sMonth} ${sYear} - ${eDay} ${eMonth} ${eYear}`;
    }
  }, [currentDate, viewMode]);

  // Selected day items for detail panel
  const selectedDayCell = useMemo(() => {
    if (!selectedDateKey) return null;
    const itemsList = itemsByDateKey.get(selectedDateKey) || [];
    const parts = selectedDateKey.split('-');
    const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return {
      dateKey: selectedDateKey,
      date: dateObj,
      items: itemsList,
    };
  }, [selectedDateKey, itemsByDateKey]);

  const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Top Control & Filter Bar for Calendar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 sm:p-4 space-y-3">
        {/* Row 1: Navigation + Period Title + View Mode Switcher (Week / Month) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Prev / Today / Next + Period Title + Quick Month Jump */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5 shadow-2xs">
              <button
                onClick={handlePrev}
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition cursor-pointer"
                title={viewMode === 'month' ? 'เดือนก่อนหน้า' : 'สัปดาห์ก่อนหน้า'}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleToday}
                className="px-2.5 py-1 text-xs font-bold text-slate-700 hover:text-sky-700 hover:bg-white rounded-lg transition cursor-pointer"
                title="กลับไปที่วันนี้"
              >
                วันนี้
              </button>
              <button
                onClick={handleNext}
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition cursor-pointer"
                title={viewMode === 'month' ? 'เดือนถัดไป' : 'สัปดาห์ถัดไป'}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-sky-50 text-sky-600 border border-sky-200">
                <CalendarIcon className="w-4 h-4" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {periodTitle}
              </h2>
            </div>

            {/* Quick Jump to Months with Data */}
            {availableMonths.length > 0 && (
              <select
                value={currentMonthKey}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  const [y, m] = val.split('-').map(Number);
                  setCurrentDate(new Date(y, m - 1, 1));
                }}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white text-xs font-semibold text-slate-700 outline-none cursor-pointer transition"
                title="เลือกเดือนที่มีรายการส่งงาน"
              >
                {!availableMonths.some((m) => m.key === currentMonthKey) && (
                  <option value={currentMonthKey}>
                    {THAI_MONTHS[currentDate.getMonth()]} {currentDate.getFullYear() + 543} (0 รายการ)
                  </option>
                )}
                {availableMonths.map((m) => (
                  <option key={m.key} value={m.key}>
                    📅 {THAI_MONTHS[m.month]} {m.year + 543} ({m.count} งาน: รอส่ง {m.pending} / ส่งแล้ว {m.delivered})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Right: View Mode Toggle (Week / Month) */}
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'month'
                    ? 'bg-white text-sky-700 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>มุมมองเดือน (Month)</span>
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'week'
                    ? 'bg-white text-sky-700 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>มุมมองสัปดาห์ (Week)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Filters (สถานะการส่งงาน: ทั้งหมด / รอส่ง / ส่งแล้ว / เกินกำหนด + แยกประเภทงาน: ทั้งหมด / Service / Project + ค้นหา) */}
        <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* 1. สถานะการส่งงาน */}
            <div className="inline-flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
              <span className="text-[11px] font-bold text-slate-500 px-2 flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-sky-600" />
                <span>สถานะงาน:</span>
              </span>
              <button
                onClick={() => setDeliveryStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  deliveryStatusFilter === 'all'
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-white'
                }`}
              >
                ทั้งหมด
              </button>
              <button
                onClick={() => setDeliveryStatusFilter('pending')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  deliveryStatusFilter === 'pending'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'text-amber-800 hover:bg-white'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>งานรอส่ง</span>
              </button>
              <button
                onClick={() => setDeliveryStatusFilter('delivered')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  deliveryStatusFilter === 'delivered'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-emerald-800 hover:bg-white'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>ส่งไปแล้ว</span>
              </button>
              <button
                onClick={() => setDeliveryStatusFilter('overdue')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  deliveryStatusFilter === 'overdue'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-rose-700 hover:bg-white'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>เกินกำหนด</span>
              </button>
            </div>

            {/* 2. แยกประเภทงาน (Service / Project) */}
            <div className="inline-flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
              <span className="text-[11px] font-bold text-slate-500 px-2 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-indigo-600" />
                <span>ประเภทงาน:</span>
              </span>
              <button
                onClick={() => setWorkTypeFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  workTypeFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-white'
                }`}
              >
                ทุกประเภท
              </button>
              <button
                onClick={() => setWorkTypeFilter('Service')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  workTypeFilter === 'Service'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'text-sky-800 hover:bg-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                <span>Service</span>
              </button>
              <button
                onClick={() => setWorkTypeFilter('Project')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                  workTypeFilter === 'Project'
                    ? 'bg-violet-600 text-white shadow-2xs'
                    : 'text-violet-800 hover:bg-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-violet-400"></span>
                <span>Project</span>
              </button>
            </div>

            {/* 3. Quick Search in Calendar */}
            <div className="relative min-w-[190px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="ค้นหาในปฏิทิน (Item, PD, เครื่องจักร)..."
                className="w-full pl-8 pr-6 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-sky-500 outline-none transition"
              />
              {localSearch && (
                <button
                  onClick={() => setLocalSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Right: Period Summary Badges */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-bold border border-slate-200">
              รวม {periodStats.total} รายการ ({periodStats.totalQty} ชิ้น)
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 font-semibold border border-amber-200">
              รอส่ง {periodStats.pending}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
              ส่งแล้ว {periodStats.delivered}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 font-semibold border border-sky-200">
              Service: {periodStats.serviceCount}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-violet-50 text-violet-800 font-semibold border border-violet-200">
              Project: {periodStats.projectCount}
            </span>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* MONTH VIEW                                                          */}
      {/* =================================================================== */}
      {viewMode === 'month' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 bg-slate-100 border-b border-slate-200">
            {THAI_DAYS_SHORT.map((day, idx) => (
              <div
                key={day}
                className={`py-2.5 px-2 text-center text-xs font-bold ${
                  idx === 0
                    ? 'text-rose-600 bg-rose-50/40'
                    : idx === 6
                    ? 'text-indigo-600 bg-indigo-50/40'
                    : 'text-slate-700'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid Cells */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-200">
            {calendarDays.map((cell) => {
              const isSelected = selectedDateKey === cell.dateKey;
              const pendingCount = cell.items.filter((i) => !isItemDelivered(i)).length;
              const deliveredCount = cell.items.filter((i) => isItemDelivered(i)).length;
              const serviceCount = cell.items.filter((i) => (i.workTag || 'Service') === 'Service').length;
              const projectCount = cell.items.filter((i) => i.workTag === 'Project').length;
              const hasOverdue = cell.items.some((i) => !isItemDelivered(i) && i.isOverdue);

              return (
                <div
                  key={cell.dateKey}
                  onClick={() => setSelectedDateKey(isSelected ? null : cell.dateKey)}
                  className={`min-h-[125px] sm:min-h-[145px] p-2 flex flex-col justify-between transition cursor-pointer select-none ${
                    !cell.isCurrentMonth
                      ? 'bg-slate-50/60 text-slate-400'
                      : isSelected
                      ? 'bg-sky-50/70 ring-2 ring-inset ring-sky-500'
                      : cell.isToday
                      ? 'bg-amber-50/40 hover:bg-amber-50/70'
                      : 'bg-white hover:bg-slate-50/80'
                  }`}
                >
                  {/* Top of Cell: Date Number & Summary Badges */}
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          cell.isToday
                            ? 'bg-amber-500 text-white shadow-2xs'
                            : !cell.isCurrentMonth
                            ? 'text-slate-400'
                            : cell.date.getDay() === 0
                            ? 'text-rose-600'
                            : 'text-slate-800'
                        }`}
                      >
                        {cell.date.getDate()}
                      </span>

                      {cell.items.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap justify-end">
                          {serviceCount > 0 && (
                            <span
                              className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-sky-100 text-sky-800 border border-sky-200"
                              title={`งาน Service ${serviceCount} รายการ`}
                            >
                              S:{serviceCount}
                            </span>
                          )}
                          {projectCount > 0 && (
                            <span
                              className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-violet-100 text-violet-800 border border-violet-200"
                              title={`งาน Project ${projectCount} รายการ`}
                            >
                              P:{projectCount}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Mini Item Chips (Show up to 3 items, then "+N รายการ") */}
                    <div className="space-y-1">
                      {cell.items.slice(0, 3).map((item) => {
                        const delivered = isItemDelivered(item);
                        const isProj = item.workTag === 'Project';
                        return (
                          <div
                            key={item.id}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              if (item.itemCode && item.itemCode !== '-') {
                                searchAndOpenItemPdf(item.itemCode);
                              }
                            }}
                            title={`[${item.workTag || 'Service'}] ${item.machineName} - ${item.itemCode} ${item.itemName} (${item.qty} ชิ้น) | สถานะ: ${
                              delivered ? 'ส่งแล้ว' : item.isOverdue ? 'เกินกำหนด' : 'รอส่ง'
                            }\n(ดับเบิลคลิกเพื่อเปิด PDF)`}
                            className={`px-1.5 py-1 rounded-md text-[10px] leading-tight border truncate flex items-center gap-1 ${
                              delivered
                                ? 'bg-emerald-50/90 text-emerald-900 border-emerald-200'
                                : item.isOverdue
                                ? 'bg-rose-50/90 text-rose-900 border-rose-200'
                                : isProj
                                ? 'bg-violet-50/90 text-violet-900 border-violet-200'
                                : 'bg-sky-50/90 text-sky-900 border-sky-200'
                            }`}
                          >
                            {delivered ? (
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                            ) : item.isOverdue ? (
                              <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                            ) : (
                              <Clock className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                            )}
                            <span
                              className={`px-1 rounded text-[8.5px] font-bold shrink-0 ${
                                isProj ? 'bg-violet-200/80 text-violet-900' : 'bg-sky-200/80 text-sky-900'
                              }`}
                            >
                              {isProj ? 'P' : 'S'}
                            </span>
                            <span className="font-semibold truncate">
                              {item.machineName !== '(ไม่ระบุเครื่องจักร)' ? item.machineName : item.itemName}
                            </span>
                          </div>
                        );
                      })}

                      {cell.items.length > 3 && (
                        <div className="text-[10px] font-bold text-sky-700 bg-sky-50/80 hover:bg-sky-100 rounded px-1.5 py-0.5 text-center border border-sky-200/60">
                          + อีก {cell.items.length - 3} รายการ (คลิกดูทั้งหมด)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Status Pill inside cell */}
                  {cell.items.length > 0 && (
                    <div className="mt-1.5 pt-1 border-t border-slate-100 flex items-center justify-between text-[9.5px] font-semibold">
                      {pendingCount > 0 ? (
                        <span className={hasOverdue ? 'text-rose-600 font-bold' : 'text-amber-700'}>
                          รอส่ง {pendingCount}
                        </span>
                      ) : (
                        <span className="text-emerald-600">ครบแล้ว</span>
                      )}
                      {deliveredCount > 0 && (
                        <span className="text-emerald-700">ส่งแล้ว {deliveredCount}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* WEEK VIEW                                                           */}
      {/* =================================================================== */}
      {viewMode === 'week' && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {calendarDays.map((cell, idx) => {
            const isSelected = selectedDateKey === cell.dateKey;
            const pendingCount = cell.items.filter((i) => !isItemDelivered(i)).length;
            const deliveredCount = cell.items.filter((i) => isItemDelivered(i)).length;

            return (
              <div
                key={cell.dateKey}
                onClick={() => setSelectedDateKey(cell.dateKey)}
                className={`bg-white rounded-2xl border shadow-xs flex flex-col overflow-hidden transition cursor-pointer ${
                  isSelected
                    ? 'border-sky-500 ring-2 ring-sky-200'
                    : cell.isToday
                    ? 'border-amber-400 ring-1 ring-amber-200'
                    : 'border-slate-200'
                }`}
              >
                {/* Day Column Header */}
                <div
                  className={`p-3 border-b ${
                    cell.isToday
                      ? 'bg-amber-50 border-amber-200'
                      : idx === 0
                      ? 'bg-rose-50/50 border-slate-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold ${
                        idx === 0 ? 'text-rose-600' : 'text-slate-600'
                      }`}
                    >
                      {THAI_DAYS_FULL[cell.date.getDay()]}
                    </span>
                    {cell.isToday && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9.5px] font-bold bg-amber-500 text-white">
                        วันนี้
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-lg font-extrabold text-slate-900">
                      {cell.date.getDate()} {THAI_MONTHS_SHORT[cell.date.getMonth()]}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">
                      {cell.items.length} งาน
                    </span>
                  </div>
                  {cell.items.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-[10px] font-semibold">
                      {pendingCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                          รอส่ง {pendingCount}
                        </span>
                      )}
                      {deliveredCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          ส่งแล้ว {deliveredCount}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Day Column Items List */}
                <div className="p-2 space-y-2 flex-1 max-h-[520px] overflow-y-auto divide-y divide-slate-100">
                  {cell.items.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">
                      ไม่มีกำหนดส่งงาน
                    </div>
                  ) : (
                    cell.items.map((item) => {
                      const delivered = isItemDelivered(item);
                      const isProj = item.workTag === 'Project';
                      return (
                        <div
                          key={item.id}
                          className={`p-2.5 rounded-xl border text-xs space-y-1.5 transition ${
                            delivered
                              ? 'bg-emerald-50/40 border-emerald-200'
                              : item.isOverdue
                              ? 'bg-rose-50/50 border-rose-200'
                              : 'bg-white border-slate-200 hover:border-sky-300'
                          }`}
                        >
                          {/* WorkTag + Status Badge */}
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border ${
                                isProj
                                  ? 'bg-violet-100 text-violet-800 border-violet-300'
                                  : 'bg-sky-100 text-sky-800 border-sky-300'
                              }`}
                            >
                              {item.workTag || 'Service'}
                            </span>

                            {delivered ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                ส่งแล้ว
                              </span>
                            ) : item.isOverdue ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                เกินกำหนด
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                <Clock className="w-2.5 h-2.5" />
                                รอส่ง
                              </span>
                            )}
                          </div>

                          {/* Machine Name */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectMachineByName(item.machineName);
                            }}
                            className="font-bold text-sky-700 hover:underline flex items-center gap-1 text-left cursor-pointer truncate w-full"
                          >
                            <Cpu className="w-3 h-3 text-sky-500 shrink-0" />
                            <span className="truncate">{item.machineName}</span>
                          </button>

                          {/* Item Code (Double-click to open PDF) */}
                          {item.itemCode && item.itemCode !== '-' && (
                            <div
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                searchAndOpenItemPdf(item.itemCode);
                              }}
                              title={`ดับเบิลคลิกเพื่อค้นหาและเปิดไฟล์ PDF (${formatItemCodeWithHyphens(item.itemCode)})`}
                              className="font-mono text-[10.5px] font-semibold text-slate-700 hover:text-sky-700 hover:underline cursor-pointer truncate"
                            >
                              📄 {item.itemCode}
                            </div>
                          )}

                          {/* Item Name */}
                          <div className="font-medium text-slate-900 line-clamp-2 leading-snug" title={item.itemName}>
                            {item.itemName}
                          </div>

                          {/* Qty & PD */}
                          <div className="flex items-center justify-between text-[10.5px] text-slate-500 pt-1 border-t border-slate-100">
                            <span>
                              จำนวน: <strong className="text-slate-800">{item.qty}</strong> ชิ้น
                            </span>
                            {item.prodOrder && (
                              <span className="font-mono text-slate-600">{item.prodOrder}</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =================================================================== */}
      {/* SELECTED DAY DETAIL PANEL (Below Calendar when a date is clicked)   */}
      {/* =================================================================== */}
      {selectedDayCell && (
        <div className="bg-white rounded-2xl border-2 border-sky-500 shadow-md overflow-hidden animate-in fade-in duration-150">
          <div className="p-4 bg-gradient-to-r from-sky-600 to-blue-700 text-white flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <CalendarIcon className="w-5 h-5 text-sky-200" />
              <div>
                <h3 className="font-bold text-sm sm:text-base">
                  รายละเอียดงานประจำ{formatThaiDayOfWeek(`${selectedDayCell.date.getDate()}/${selectedDayCell.date.getMonth() + 1}/${selectedDayCell.date.getFullYear()}`)}
                </h3>
                <p className="text-xs text-sky-100">
                  ทั้งหมด {selectedDayCell.items.length} รายการ • รอส่ง{' '}
                  {selectedDayCell.items.filter((i) => !isItemDelivered(i)).length} รายการ • ส่งแล้ว{' '}
                  {selectedDayCell.items.filter((i) => isItemDelivered(i)).length} รายการ
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedDateKey(null)}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer flex items-center gap-1 text-xs font-semibold px-2.5"
            >
              <X className="w-4 h-4" />
              <span>ปิดรายละเอียด</span>
            </button>
          </div>

          {selectedDayCell.items.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              ไม่มีรายการส่งมอบในวันที่เลือกตามเงื่อนไขตัวกรองปัจจุบัน
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 font-semibold">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">ประเภท / ลูกค้า</th>
                    <th className="py-2.5 px-3">เครื่องจักร / โครงการ</th>
                    <th className="py-2.5 px-3">เลขที่ Item (Double-Click เปิด PDF)</th>
                    <th className="py-2.5 px-3">ชื่อชิ้นงาน</th>
                    <th className="py-2.5 px-3 text-center">จำนวน</th>
                    <th className="py-2.5 px-3">Production Order</th>
                    <th className="py-2.5 px-3 text-center">สถานะส่งมอบ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedDayCell.items.map((item, idx) => {
                    const delivered = isItemDelivered(item);
                    const customerName = item.customer || extractCustomer(item.projectName);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/90 transition">
                        <td className="py-2.5 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border ${
                                item.workTag === 'Project'
                                  ? 'bg-violet-100 text-violet-800 border-violet-300'
                                  : 'bg-sky-100 text-sky-800 border-sky-300'
                              }`}
                            >
                              {item.workTag || 'Service'}
                            </span>
                            <span className="font-bold text-slate-900">{customerName}</span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5">{item.projectCode}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <button
                            onClick={() => onSelectMachineByName(item.machineName)}
                            className="font-bold text-sky-700 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Cpu className="w-3.5 h-3.5 text-sky-500" />
                            <span>{item.machineName}</span>
                          </button>
                          <div className="text-[10px] text-slate-400">{item.projectName}</div>
                        </td>
                        <td
                          onDoubleClick={() =>
                            item.itemCode && item.itemCode !== '-' && searchAndOpenItemPdf(item.itemCode)
                          }
                          title={
                            item.itemCode && item.itemCode !== '-'
                              ? `ดับเบิลคลิกเพื่อค้นหาและเปิดไฟล์ PDF (${formatItemCodeWithHyphens(item.itemCode)})`
                              : undefined
                          }
                          className={`py-2.5 px-3 font-mono font-semibold text-slate-800 whitespace-nowrap ${
                            item.itemCode && item.itemCode !== '-'
                              ? 'cursor-pointer hover:text-sky-700 hover:bg-sky-50 hover:underline'
                              : ''
                          }`}
                        >
                          {item.itemCode || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">{item.itemName}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-900">{item.qty}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">{item.prodOrder || '-'}</td>
                        <td className="py-2.5 px-3 text-center">
                          {delivered ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3" />
                              ส่งแล้ว
                            </span>
                          ) : item.isOverdue ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <AlertTriangle className="w-3 h-3" />
                              เกินกำหนด
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <Clock className="w-3 h-3" />
                              รอส่ง
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
      )}
    </div>
  );
};
