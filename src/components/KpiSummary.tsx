import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Layers, 
  TrendingUp, 
  History,
  Boxes,
  Cpu,
  ArrowRight
} from 'lucide-react';
import { MachineSummary } from '../types';

interface KpiSummaryProps {
  machines: MachineSummary[];
  totalItems: number;
  deliveredItems: number;
  pendingItems: number;
  overdueItems: number;
  dueSoonItems: number;
  rescheduledItems: number;
  qcPassedItems?: number;
  pdCompletedItems?: number;
  onFilterStatus?: (status: 'all' | 'in-progress' | 'overdue' | 'due-soon' | 'completed') => void;
  onOpenDeliveryPlan?: () => void;
  activeStatusFilter?: string;
}

export const KpiSummary: React.FC<KpiSummaryProps> = ({
  machines,
  totalItems,
  deliveredItems,
  pendingItems,
  overdueItems,
  dueSoonItems,
  rescheduledItems,
  qcPassedItems = 0,
  pdCompletedItems,
  onFilterStatus,
  onOpenDeliveryPlan,
  activeStatusFilter = 'all',
}) => {
  const deliveryRate = totalItems > 0 ? Math.round((deliveredItems / totalItems) * 100) : 0;
  
  const completedMachines = machines.filter(m => m.progressPercent === 100).length;
  const inProgressMachines = machines.filter(m => m.progressPercent > 0 && m.progressPercent < 100).length;
  const zeroProgressMachines = machines.filter(m => m.progressPercent === 0).length;
  const overdueMachines = machines.filter(m => m.overdueItems > 0).length;

  return (
    <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-blue-900 rounded-2xl p-3 sm:p-3.5 text-white shadow-md relative overflow-hidden">
      {/* Subtle background decoration */}
      <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute left-1/3 bottom-0 translate-y-1/2 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>

      <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        {/* Left: Title, Badges & Overall Progress Gauge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between xl:justify-start gap-3 shrink-0">
          {/* Title & Quick Badges */}
          <div className="space-y-1 min-w-max">
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-white flex items-center gap-2">
              <span className="p-1 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30 shrink-0">
                <Cpu className="w-4 h-4" />
              </span>
              <span>ติดตามเป้าหมายการส่งมอบอะไหล่ & ชิ้นส่วน</span>
            </h1>
            <div className="flex items-center gap-1.5 flex-wrap">
              {pdCompletedItems !== undefined && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-semibold border border-blue-500/30 whitespace-nowrap">
                  <CheckCircle2 className="w-3 h-3 text-blue-400" />
                  <span>PD เสร็จแล้ว {pdCompletedItems}/{totalItems} ({totalItems > 0 ? ((pdCompletedItems / totalItems) * 100).toFixed(1).replace('.0', '') : 0}%)</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold border border-emerald-500/30 whitespace-nowrap">
                <CheckCircle2 className="w-3 h-3" />
                <span>ผ่าน QC แล้ว {qcPassedItems} รายการ</span>
              </span>
              {onOpenDeliveryPlan && (
                <button
                  onClick={onOpenDeliveryPlan}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/25 hover:bg-amber-500/35 text-amber-300 text-[10px] font-semibold border border-amber-500/40 transition cursor-pointer whitespace-nowrap"
                  title="เปิดแผนส่งมอบประจำวัน"
                >
                  <span>📦 แผนส่งมอบ ({pendingItems} รอส่ง)</span>
                  <ArrowRight className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </div>

          {/* Delivery Completion Gauge Card */}
          <div className="flex items-center gap-2.5 bg-white/10 backdrop-blur-xs px-3 py-2 rounded-xl border border-white/15 shrink-0">
            <div className="relative flex items-center justify-center">
              <svg className="w-11 h-11 transform -rotate-90">
                <circle
                  cx="22"
                  cy="22"
                  r="17"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-white/20"
                  fill="transparent"
                />
                <circle
                  cx="22"
                  cy="22"
                  r="17"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray={2 * Math.PI * 17}
                  strokeDashoffset={2 * Math.PI * 17 * (1 - deliveryRate / 100)}
                  strokeLinecap="round"
                  className="text-emerald-400 transition-all duration-1000 ease-out"
                  fill="transparent"
                />
              </svg>
              <span className="absolute text-[11px] font-bold text-white">
                {deliveryRate}%
              </span>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] font-medium text-slate-300 block">ภาพรวมส่งมอบ</span>
              <div className="text-xs font-bold text-white leading-tight">
                {deliveredItems} <span className="text-[10px] font-normal text-slate-300">/ {totalItems}</span>
              </div>
              <div className="text-[10px] text-emerald-300 flex items-center gap-0.5 font-medium leading-tight whitespace-nowrap">
                <CheckCircle2 className="w-2.5 h-2.5" />
                <span>ส่งแล้ว {deliveredItems} รายการ</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: 5 KPI Interactive Cards Grid (In 1 Row on Desktop) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2 flex-1 min-w-0">
          
          {/* Card 1: Total Machines */}
          <button
            onClick={() => onFilterStatus?.('all')}
            className={`p-2.5 rounded-xl border text-left transition-all duration-150 bg-white hover:shadow-md cursor-pointer ${
              activeStatusFilter === 'all'
                ? 'ring-2 ring-sky-500 border-sky-300 bg-sky-50/95'
                : 'border-slate-200/90 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-semibold text-slate-600 truncate">เครื่องจักรทั้งหมด</span>
              <div className="p-1 rounded-md bg-sky-100 text-sky-700 shrink-0">
                <Cpu className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-lg font-bold text-slate-900">{machines.length}</span>
              <span className="text-[10px] text-slate-500">เครื่อง</span>
            </div>
            <div className="mt-0.5 text-[10px] text-slate-500 flex items-center gap-1 truncate">
              <span className="text-emerald-600 font-semibold">{completedMachines}</span> ครบ 100% | 
              <span className="text-amber-600 font-semibold">{inProgressMachines}</span> ทำอยู่
            </div>
          </button>

          {/* Card 2: Delivered Items */}
          <button
            onClick={() => onFilterStatus?.('completed')}
            className={`p-2.5 rounded-xl border text-left transition-all duration-150 bg-white hover:shadow-md cursor-pointer ${
              activeStatusFilter === 'completed'
                ? 'ring-2 ring-emerald-500 border-emerald-300 bg-emerald-50/95'
                : 'border-slate-200/90 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-semibold text-slate-600 truncate">ส่งแล้วเสร็จ</span>
              <div className="p-1 rounded-md bg-emerald-100 text-emerald-700 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-lg font-bold text-emerald-600">{deliveredItems}</span>
              <span className="text-[10px] text-slate-500">รายการ</span>
            </div>
            <div className="mt-0.5 text-[10px] text-emerald-600 font-medium truncate">
              {deliveryRate}% ของชิ้นส่วนทั้งหมด
            </div>
          </button>

          {/* Card 3: Overdue Deliveries */}
          <button
            onClick={() => onFilterStatus?.('overdue')}
            className={`p-2.5 rounded-xl border text-left transition-all duration-150 bg-white hover:shadow-md cursor-pointer ${
              activeStatusFilter === 'overdue'
                ? 'ring-2 ring-rose-500 border-rose-300 bg-rose-50/95'
                : 'border-slate-200/90 hover:border-rose-200'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-semibold text-slate-600 truncate">เกินกำหนด (Overdue)</span>
              <div className={`p-1 rounded-md shrink-0 ${overdueItems > 0 ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-slate-100 text-slate-500'}`}>
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className={`text-lg font-bold ${overdueItems > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                {overdueItems}
              </span>
              <span className="text-[10px] text-slate-500">รายการ</span>
            </div>
            <div className="mt-0.5 text-[10px] text-rose-600 font-medium truncate">
              {overdueMachines > 0 ? `พบใน ${overdueMachines} เครื่องจักร` : 'ไม่มีรายการล่าช้า'}
            </div>
          </button>

          {/* Card 4: Pending / In-progress */}
          <button
            onClick={() => {
              if (onOpenDeliveryPlan) {
                onOpenDeliveryPlan();
              } else {
                onFilterStatus?.('in-progress');
              }
            }}
            className={`p-2.5 rounded-xl border text-left transition-all duration-150 bg-white hover:shadow-md cursor-pointer ${
              activeStatusFilter === 'in-progress'
                ? 'ring-2 ring-blue-500 border-blue-300 bg-blue-50/95'
                : 'border-slate-200/90 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-semibold text-slate-600 truncate">รอดำเนินการ / จัดส่ง</span>
              <div className="p-1 rounded-md bg-blue-100 text-blue-700 shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-lg font-bold text-blue-600">{pendingItems}</span>
              <span className="text-[10px] text-slate-500">รายการ</span>
            </div>
            <div className="mt-0.5 text-[10px] text-sky-600 font-medium flex items-center justify-between truncate">
              <span>ดูแผนส่งมอบ →</span>
              {dueSoonItems > 0 && <span className="text-amber-600 font-semibold">({dueSoonItems} ใกล้ครบ)</span>}
            </div>
          </button>

          {/* Card 5: Rescheduled items */}
          <div className="p-2.5 rounded-xl border border-slate-200/90 bg-white hover:shadow-md transition">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-semibold text-slate-600 truncate">เลื่อนเป้าส่งมอบ</span>
              <div className="p-1 rounded-md bg-purple-100 text-purple-700 shrink-0">
                <History className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-lg font-bold text-purple-700">{rescheduledItems}</span>
              <span className="text-[10px] text-slate-500">รายการ</span>
            </div>
            <div className="mt-0.5 text-[10px] text-purple-600 truncate">
              มีประวัติเป้าหมาย 2-5
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
