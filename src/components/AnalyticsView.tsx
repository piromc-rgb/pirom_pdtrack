import React from 'react';
import { 
  BarChart3, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Layers, 
  Building2,
  TrendingUp
} from 'lucide-react';
import { MachineSummary, DeliveryItem } from '../types';

interface AnalyticsViewProps {
  machines: MachineSummary[];
  items: DeliveryItem[];
  onSelectMachine: (machine: MachineSummary) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  machines,
  items,
  onSelectMachine,
}) => {
  // Machines sorted by progress
  const sortedByProgress = [...machines]
    .filter(m => m.name !== '(ไม่ระบุเครื่องจักร)')
    .sort((a, b) => b.progressPercent - a.progressPercent);

  // Top overdue machines
  const overdueRankings = [...machines]
    .filter(m => m.overdueItems > 0)
    .sort((a, b) => b.overdueItems - a.overdueItems);

  // Project distribution
  const projectStats = React.useMemo(() => {
    const map = new Map<string, { total: number; delivered: number }>();
    items.forEach(i => {
      const p = i.projectName || 'ไม่ระบุโครงการ';
      if (!map.has(p)) map.set(p, { total: 0, delivered: 0 });
      const current = map.get(p)!;
      current.total++;
      if (i.status === 'ส่งแล้ว') current.delivered++;
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        total: data.total,
        delivered: data.delivered,
        rate: Math.round((data.delivered / data.total) * 100)
      }))
      .sort((a, b) => b.total - a.total);
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-sky-600" />
            <span>การวิเคราะห์ความคืบหน้ารายเครื่องจักร (Machine Analytics)</span>
          </h2>
          <p className="text-xs text-slate-500">
            เปรียบเทียบอัตราการส่งมอบสำเร็จและความเสี่ยงความล่าช้าของแต่ละเครื่องจักร
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Machine Delivery Progress Rankings */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-sky-600" />
              <span>ลำดับความคืบหน้าการส่งมอบรายเครื่องจักร (% Completion)</span>
            </h3>
            <span className="text-xs text-slate-400">{sortedByProgress.length} เครื่อง</span>
          </div>

          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {sortedByProgress.map((m) => {
              const isCompleted = m.progressPercent === 100;
              const hasOverdue = m.overdueItems > 0;
              return (
                <div 
                  key={m.name}
                  onClick={() => onSelectMachine(m)}
                  className="p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition border border-slate-100"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-slate-800 hover:text-sky-600 flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-slate-400" />
                      {m.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-[11px]">
                        {m.deliveredItems}/{m.totalItems} รายการ
                      </span>
                      <span className={`font-bold ${
                        isCompleted ? 'text-emerald-600' : hasOverdue ? 'text-rose-600' : 'text-sky-600'
                      }`}>
                        {m.progressPercent}%
                      </span>
                    </div>
                  </div>

                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        isCompleted ? 'bg-emerald-500' : hasOverdue ? 'bg-rose-500' : 'bg-sky-500'
                      }`}
                      style={{ width: `${m.progressPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Overdue Risk & Rescheduled Monitor */}
        <div className="space-y-6">
          
          {/* Overdue alert block */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>เครื่องจักรที่มีรายการเกินกำหนดส่ง (Overdue Machines)</span>
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                {overdueRankings.length} เครื่องจักร
              </span>
            </div>

            {overdueRankings.length > 0 ? (
              <div className="space-y-2.5">
                {overdueRankings.map((m) => (
                  <div 
                    key={m.name}
                    onClick={() => onSelectMachine(m)}
                    className="p-3 rounded-lg bg-rose-50/50 border border-rose-200/70 hover:bg-rose-100/50 cursor-pointer transition flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-xs text-rose-900 flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-rose-600" />
                        <span>{m.name}</span>
                      </div>
                      <div className="text-[11px] text-rose-600 mt-0.5">
                        {m.projects[0] || 'ไม่ระบุโครงการ'}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-200 text-rose-900">
                        เกินกำหนด {m.overdueItems} รายการ
                      </span>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        ค้างส่งทั้งหมด {m.pendingItems} รายการ
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <span>ยอดเยี่ยม! ไม่มีเครื่องจักรใดมีรายการเกินกำหนดส่งมอบ</span>
              </div>
            )}
          </div>

          {/* Project Breakdown */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-sky-600" />
              <span>การกระจายตามโครงการหลัก (Project Distribution)</span>
            </h3>

            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {projectStats.map((p, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 truncate max-w-xs" title={p.name}>
                      {p.name}
                    </span>
                    <span className="font-semibold text-slate-900 text-[11px]">
                      {p.delivered}/{p.total} ({p.rate}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${p.rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
