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
    <div className="space-y-4">
      {/* Top Banner with overall Delivery Progress */}
      <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-blue-900 rounded-2xl p-5 sm:p-6 text-white shadow-lg relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute left-1/3 bottom-0 translate-y-1/2 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-medium border border-sky-500/30">
                <Cpu className="w-3.5 h-3.5" />
                <span>ดัชนีเครื่องจักรทั้งหมด {machines.length} เครื่องจักร ({totalItems} รายการ)</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>ผ่าน QC แล้ว {qcPassedItems} รายการ</span>
              </div>
              {onOpenDeliveryPlan && (
                <button
                  onClick={onOpenDeliveryPlan}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold border border-amber-500/40 transition cursor-pointer"
                >
                  <span>📦 ดูแผนส่งมอบ ({pendingItems} รอส่ง)</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              ติดตามเป้าหมายการส่งมอบอะไหล่ & ชิ้นส่วนเครื่องจักร
            </h1>
            <p className="text-sm text-slate-300">
              ประมวลผลสถานะส่งมอบแบบเรียลไทม์ ตรวจสอบประวัติการปรับเป้าหมายส่งมอบ 1-5 และแจ้งเตือนรายการค้างส่ง
            </p>
          </div>

          {/* Delivery Completion Gauge Card */}
          <div className="flex items-center gap-5 bg-white/10 backdrop-blur-md px-5 py-4 rounded-xl border border-white/10 min-w-max">
            <div className="relative flex items-center justify-center">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  stroke="currentColor"
                  strokeWidth="6"
                  className="text-white/20"
                  fill="transparent"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeDasharray={2 * Math.PI * 26}
                  strokeDashoffset={2 * Math.PI * 26 * (1 - deliveryRate / 100)}
                  strokeLinecap="round"
                  className="text-emerald-400 transition-all duration-1000 ease-out"
                  fill="transparent"
                />
              </svg>
              <span className="absolute text-base font-bold text-white">
                {deliveryRate}%
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-300">ภาพรวมการส่งมอบ</span>
              <div className="text-xl font-bold text-white">
                {deliveredItems} <span className="text-xs font-normal text-slate-300">/ {totalItems} รายการ</span>
              </div>
              <div className="text-xs text-emerald-300 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>ส่งแล้วสมบูรณ์ {deliveredItems} รายการ</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        
        {/* Card 1: Total Machines */}
        <button
          onClick={() => onFilterStatus?.('all')}
          className={`p-4 rounded-xl border text-left transition-all duration-200 bg-white hover:shadow-md ${
            activeStatusFilter === 'all'
              ? 'ring-2 ring-sky-500 border-sky-300 bg-sky-50/40'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">เครื่องจักรทั้งหมด</span>
            <div className="p-2 rounded-lg bg-sky-100 text-sky-700">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{machines.length}</span>
            <span className="text-xs text-slate-500">เครื่อง</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
            <span className="text-emerald-600 font-semibold">{completedMachines}</span> ครบ 100% | 
            <span className="text-amber-600 font-semibold">{inProgressMachines}</span> กำลังทำ
          </div>
        </button>

        {/* Card 2: Delivered Items */}
        <button
          onClick={() => onFilterStatus?.('completed')}
          className={`p-4 rounded-xl border text-left transition-all duration-200 bg-white hover:shadow-md ${
            activeStatusFilter === 'completed'
              ? 'ring-2 ring-emerald-500 border-emerald-300 bg-emerald-50/40'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">ส่งแล้วเสร็จ</span>
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600">{deliveredItems}</span>
            <span className="text-xs text-slate-500">รายการ</span>
          </div>
          <div className="mt-2 text-xs text-emerald-600 font-medium">
            {deliveryRate}% ของชิ้นส่วนทั้งหมด
          </div>
        </button>

        {/* Card 3: Overdue Deliveries */}
        <button
          onClick={() => onFilterStatus?.('overdue')}
          className={`p-4 rounded-xl border text-left transition-all duration-200 bg-white hover:shadow-md ${
            activeStatusFilter === 'overdue'
              ? 'ring-2 ring-rose-500 border-rose-300 bg-rose-50/40'
              : 'border-slate-200/80 hover:border-rose-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">เกินกำหนดส่ง (Overdue)</span>
            <div className={`p-2 rounded-lg ${overdueItems > 0 ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-slate-100 text-slate-500'}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${overdueItems > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {overdueItems}
            </span>
            <span className="text-xs text-slate-500">รายการ</span>
          </div>
          <div className="mt-2 text-xs text-rose-600 font-medium">
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
          className={`p-4 rounded-xl border text-left transition-all duration-200 bg-white hover:shadow-md cursor-pointer ${
            activeStatusFilter === 'in-progress'
              ? 'ring-2 ring-blue-500 border-blue-300 bg-blue-50/40'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">รอดำเนินการ / จัดส่ง</span>
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-600">{pendingItems}</span>
            <span className="text-xs text-slate-500">รายการ</span>
          </div>
          <div className="mt-1 text-xs text-sky-600 font-medium flex items-center justify-between">
            <span>ดูแผนส่งมอบตามวัน →</span>
            {dueSoonItems > 0 && <span className="text-amber-600 font-semibold">({dueSoonItems} ใกล้ครบ)</span>}
          </div>
        </button>

        {/* Card 5: Rescheduled items */}
        <div className="col-span-2 sm:col-span-2 lg:col-span-1 p-4 rounded-xl border border-slate-200/80 bg-white hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">มีการเลื่อนเป้าส่งมอบ</span>
            <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
              <History className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-purple-700">{rescheduledItems}</span>
            <span className="text-xs text-slate-500">รายการ</span>
          </div>
          <div className="mt-2 text-xs text-purple-600">
            มีประวัติเป้าหมาย 2-5
          </div>
        </div>

      </div>
    </div>
  );
};
