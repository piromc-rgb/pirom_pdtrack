import React, { useState, useMemo } from 'react';
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
  ChevronUp
} from 'lucide-react';
import { DeliveryItem, MachineSummary, SearchCriteria } from '../types';
import { formatThaiDate, parseDate, isDateOverdue } from '../utils/dateUtils';

interface DeliveryTimelineProps {
  items: DeliveryItem[];
  machines: MachineSummary[];
  searchCriteria: SearchCriteria;
  onSelectMachine: (machine: MachineSummary) => void;
}

export const DeliveryTimeline: React.FC<DeliveryTimelineProps> = ({
  items,
  machines,
  searchCriteria,
  onSelectMachine,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'pending' | 'overdue' | 'delivered'>('all');
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  // Group items by targetLatest date
  const dateGroups = useMemo(() => {
    const groups: { [key: string]: { dateStr: string; parsedDate: Date | null; items: DeliveryItem[] } } = {};

    items.forEach(item => {
      // 1. Document number Reference filter
      if (searchCriteria.docRef && !item.docRef.toLowerCase().includes(searchCriteria.docRef.toLowerCase().trim())) return;
      // 2. Project Code filter
      if (searchCriteria.projectCode && !item.projectCode.toLowerCase().includes(searchCriteria.projectCode.toLowerCase().trim())) return;
      // 3. Project Name filter
      if (searchCriteria.projectName && !item.projectName.toLowerCase().includes(searchCriteria.projectName.toLowerCase().trim())) return;
      // 4. Document Type filter
      if (searchCriteria.docType && !item.docType.toLowerCase().includes(searchCriteria.docType.toLowerCase().trim())) return;
      // 5. Machine Name filter
      if (searchCriteria.machineName && !item.machineName.toLowerCase().includes(searchCriteria.machineName.toLowerCase().trim())) return;

      // Status Filter
      if (filterType === 'pending' && item.status === 'ส่งแล้ว') return;
      if (filterType === 'delivered' && item.status !== 'ส่งแล้ว') return;
      if (filterType === 'overdue' && !item.isOverdue) return;

      const dateKey = item.targetLatest ? item.targetLatest.trim() : 'ไม่มีกำหนดวัน';
      if (!groups[dateKey]) {
        groups[dateKey] = {
          dateStr: dateKey,
          parsedDate: parseDate(dateKey),
          items: []
        };
      }
      groups[dateKey].items.push(item);
    });

    // Convert to sorted array
    const sorted = Object.values(groups).sort((a, b) => {
      if (!a.parsedDate) return 1;
      if (!b.parsedDate) return -1;
      return a.parsedDate.getTime() - b.parsedDate.getTime();
    });

    return sorted;
  }, [items, searchCriteria, filterType]);

  const toggleExpand = (dateKey: string) => {
    setExpandedDates(prev => ({
      ...prev,
      [dateKey]: !prev[dateKey]
    }));
  };

  const machineMap = useMemo(() => {
    const map = new Map<string, MachineSummary>();
    machines.forEach(m => map.set(m.name, m));
    return map;
  }, [machines]);

  return (
    <div className="space-y-5">
      {/* View Header & Filter */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-sky-600" />
            <span>กำหนดการส่งมอบตามลำดับเวลา (Delivery Schedule Timeline)</span>
          </h2>
          <p className="text-xs text-slate-500">
            จัดกลุ่มตามเป้าหมายวันส่งมอบล่าสุด เพื่อติดตามคิวการส่งมอบแต่ละเครื่องจักร
          </p>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition whitespace-nowrap ${
              filterType === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ทั้งหมด
          </button>
          <button
            onClick={() => setFilterType('overdue')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition whitespace-nowrap flex items-center gap-1 ${
              filterType === 'overdue'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>เกินกำหนด (Overdue)</span>
          </button>
          <button
            onClick={() => setFilterType('pending')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition whitespace-nowrap flex items-center gap-1 ${
              filterType === 'pending'
                ? 'bg-sky-600 text-white'
                : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>รอดำเนินการ</span>
          </button>
          <button
            onClick={() => setFilterType('delivered')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition whitespace-nowrap flex items-center gap-1 ${
              filterType === 'delivered'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>ส่งแล้ว</span>
          </button>
        </div>
      </div>

      {/* Timeline Stream */}
      <div className="space-y-4">
        {dateGroups.map((group) => {
          const isOverdue = group.dateStr !== 'ไม่มีกำหนดวัน' && isDateOverdue(group.dateStr);
          const totalInDate = group.items.length;
          const deliveredInDate = group.items.filter(i => i.status === 'ส่งแล้ว').length;
          const isExpanded = expandedDates[group.dateStr] !== false; // default expanded

          // Group by machine in this date
          const machineSubgroups = new Map<string, DeliveryItem[]>();
          group.items.forEach(i => {
            const mName = i.machineName || '(ไม่ระบุเครื่องจักร)';
            if (!machineSubgroups.has(mName)) machineSubgroups.set(mName, []);
            machineSubgroups.get(mName)!.push(i);
          });

          return (
            <div 
              key={group.dateStr}
              className={`bg-white rounded-xl border transition-all overflow-hidden ${
                isOverdue && deliveredInDate < totalInDate
                  ? 'border-rose-300 shadow-sm'
                  : 'border-slate-200'
              }`}
            >
              {/* Date Header Accordion */}
              <div 
                onClick={() => toggleExpand(group.dateStr)}
                className={`p-4 flex items-center justify-between cursor-pointer select-none transition ${
                  isOverdue && deliveredInDate < totalInDate
                    ? 'bg-rose-50/70 hover:bg-rose-100/50'
                    : 'bg-slate-50/80 hover:bg-slate-100/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    isOverdue && deliveredInDate < totalInDate
                      ? 'bg-rose-100 text-rose-700'
                      : deliveredInDate === totalInDate
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-sky-100 text-sky-700'
                  }`}>
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm sm:text-base text-slate-900">
                        {group.dateStr !== 'ไม่มีกำหนดวัน' ? formatThaiDate(group.dateStr) : 'ไม่มีกำหนดวันระบุ'}
                      </span>
                      {isOverdue && deliveredInDate < totalInDate && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-200 text-rose-800">
                          เกินกำหนดส่งมอบ
                        </span>
                      )}
                      {deliveredInDate === totalInDate && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-200 text-emerald-800">
                          ส่งครบแล้วทุกรายการ
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      เป้าส่งมอบ {machineSubgroups.size} เครื่องจักร ({totalInDate} รายการชิ้นส่วน)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <div className="text-xs font-semibold text-slate-700">
                      ส่งแล้ว {deliveredInDate} / {totalInDate}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {Math.round((deliveredInDate / totalInDate) * 100)}% สมบูรณ์
                    </div>
                  </div>

                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Items per Machine in this date */}
              {isExpanded && (
                <div className="p-4 sm:p-5 space-y-4 divide-y divide-slate-100">
                  {Array.from(machineSubgroups.entries()).map(([machName, machItems]) => {
                    const machSummary = machineMap.get(machName);
                    const machDelivered = machItems.filter(i => i.status === 'ส่งแล้ว').length;

                    return (
                      <div key={machName} className="pt-3 first:pt-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => machSummary && onSelectMachine(machSummary)}
                              className="font-bold text-sm text-sky-700 hover:text-sky-900 hover:underline flex items-center gap-1.5"
                            >
                              <Cpu className="w-4 h-4 text-sky-600" />
                              <span>{machName}</span>
                            </button>
                            <span className="text-xs text-slate-400">
                              ({machDelivered}/{machItems.length} รายการในงวดนี้)
                            </span>
                          </div>

                          {machSummary && (
                            <button
                              onClick={() => onSelectMachine(machSummary)}
                              className="text-xs font-medium text-slate-500 hover:text-sky-600 flex items-center gap-1"
                            >
                              <span>เปิดดูเครื่องจักร</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {/* Mini items list for this machine */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                          {machItems.map((item) => (
                            <div 
                              key={item.id}
                              className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-start justify-between gap-2 text-xs"
                            >
                              <div className="space-y-0.5">
                                <div className="font-semibold text-slate-800 line-clamp-1">
                                  {item.itemName}
                                </div>
                                <div className="text-slate-500 font-mono text-[11px]">
                                  รหัส: {item.itemCode || '-'} | จำนวน: <strong className="text-slate-700">{item.qty}</strong> ชิ้น
                                </div>
                                {item.remark && (
                                  <div className="text-[11px] text-slate-500 line-clamp-1 italic">
                                    หมายเหตุ: {item.remark}
                                  </div>
                                )}
                              </div>

                              <div className="min-w-max text-right">
                                {item.status === 'ส่งแล้ว' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                    <CheckCircle2 className="w-3 h-3" /> ส่งแล้ว
                                  </span>
                                ) : (
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    item.isOverdue ? 'bg-rose-100 text-rose-800' : 'bg-sky-100 text-sky-800'
                                  }`}>
                                    <Clock className="w-3 h-3" /> {item.isOverdue ? 'เกินกำหนด' : 'รอส่ง'}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {dateGroups.length === 0 && (
          <div className="py-16 text-center bg-white rounded-xl border border-dashed border-slate-300">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-semibold text-slate-700">ไม่มีรายการส่งมอบในเงื่อนไขที่เลือก</h4>
          </div>
        )}
      </div>
    </div>
  );
};
