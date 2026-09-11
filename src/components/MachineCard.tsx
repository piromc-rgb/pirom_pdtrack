import React from 'react';
import { 
  Cpu, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Calendar, 
  FolderKanban, 
  ChevronRight, 
  Boxes,
  History
} from 'lucide-react';
import { MachineSummary } from '../types';
import { formatThaiDate, isDateOverdue } from '../utils/dateUtils';

interface MachineCardProps {
  machine: MachineSummary;
  onSelect: (machine: MachineSummary) => void;
}

export const MachineCard: React.FC<MachineCardProps> = ({ machine, onSelect }) => {
  const isCompleted = machine.progressPercent === 100;
  const hasOverdue = machine.overdueItems > 0;
  const hasDueSoon = machine.dueSoonItems > 0;

  // Status color styles
  let badgeClasses = 'bg-blue-50 text-blue-700 border-blue-200';
  let badgeText = 'กำลังดำเนินการ';
  let badgeIcon = <Clock className="w-3.5 h-3.5" />;

  if (isCompleted) {
    badgeClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    badgeText = 'ส่งมอบครบถ้วน';
    badgeIcon = <CheckCircle2 className="w-3.5 h-3.5" />;
  } else if (hasOverdue) {
    badgeClasses = 'bg-rose-50 text-rose-700 border-rose-200';
    badgeText = `เกินกำหนด ${machine.overdueItems} รายการ`;
    badgeIcon = <AlertTriangle className="w-3.5 h-3.5" />;
  } else if (hasDueSoon) {
    badgeClasses = 'bg-amber-50 text-amber-700 border-amber-200';
    badgeText = `ใกล้กำหนด ${machine.dueSoonItems} รายการ`;
    badgeIcon = <Calendar className="w-3.5 h-3.5" />;
  }

  // Progress Bar color
  let progressBarColor = 'bg-sky-500';
  if (isCompleted) progressBarColor = 'bg-emerald-500';
  else if (hasOverdue) progressBarColor = 'bg-rose-500';

  return (
    <div 
      onClick={() => onSelect(machine)}
      className="group bg-white rounded-xl border border-slate-200/90 hover:border-sky-400 hover:shadow-lg transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer"
    >
      {/* Top Card Header */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${
              isCompleted 
                ? 'bg-emerald-100 text-emerald-700' 
                : hasOverdue 
                ? 'bg-rose-100 text-rose-700' 
                : 'bg-sky-100 text-sky-700'
            }`}>
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 group-hover:text-sky-600 transition flex items-center gap-1.5">
                {machine.name}
              </h3>
              <p className="text-xs text-slate-500 line-clamp-1">
                {machine.projects.length > 0 ? machine.projects[0] : 'โครงการทั่วไป'}
                {machine.projects.length > 1 && ` (+${machine.projects.length - 1} โครงการ)`}
              </p>
            </div>
          </div>

          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${badgeClasses}`}>
            {badgeIcon}
            <span>{badgeText}</span>
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5 my-3">
          <div className="flex justify-between text-xs font-medium text-slate-600">
            <span>ความคืบหน้าการส่งมอบ</span>
            <span className="font-bold text-slate-800">{machine.progressPercent}%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${progressBarColor}`}
              style={{ width: `${machine.progressPercent}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 my-3 py-2 border-y border-slate-100 text-xs">
          <div className="flex flex-col">
            <span className="text-slate-400">ชิ้นส่วนที่ส่งแล้ว:</span>
            <span className="font-semibold text-slate-800">
              {machine.deliveredItems} / {machine.totalItems} รายการ
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-400">จำนวนรวม (Qty):</span>
            <span className="font-semibold text-slate-800">
              {machine.totalQty} ชิ้น
            </span>
          </div>
        </div>

        {/* Target Delivery Info */}
        <div className="space-y-1 text-xs text-slate-500">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>เป้าส่งมอบล่าสุด:</span>
            </span>
            <span className="font-medium text-slate-700">
              {machine.latestTarget ? formatThaiDate(machine.latestTarget) : 'ตามแผนงาน'}
            </span>
          </div>

          {machine.rescheduledItems > 0 && (
            <div className="flex items-center justify-between text-purple-600 font-medium">
              <span className="flex items-center gap-1">
                <History className="w-3.5 h-3.5" />
                <span>มีการปรับเป้าหมาย:</span>
              </span>
              <span>{machine.rescheduledItems} รายการ</span>
            </div>
          )}

          {machine.qcPassedItems > 0 && (
            <div className="flex items-center justify-between text-emerald-700 font-medium">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>ผ่าน QC แล้ว:</span>
              </span>
              <span className="bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-semibold border border-emerald-200">
                {machine.qcPassedItems} รายการ
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Footer Button */}
      <div className="bg-slate-50 px-4 sm:px-5 py-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-slate-600 group-hover:bg-sky-50 group-hover:text-sky-700 transition">
        <span>ดูรายการชิ้นส่วนอะไหล่ ({machine.totalItems})</span>
        <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition" />
      </div>
    </div>
  );
};
