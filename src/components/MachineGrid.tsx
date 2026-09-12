import React, { useState, useMemo } from 'react';
import { 
  LayoutGrid, 
  List, 
  Filter, 
  ArrowUpDown, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Calendar,
  Layers,
  RotateCcw
} from 'lucide-react';
import { MachineSummary, SearchCriteria } from '../types';
import { MachineCard } from './MachineCard';
import { formatThaiDate } from '../utils/dateUtils';

interface MachineGridProps {
  machines: MachineSummary[];
  onSelectMachine: (machine: MachineSummary) => void;
  searchCriteria: SearchCriteria;
  statusFilter: 'all' | 'in-progress' | 'overdue' | 'due-soon' | 'completed';
  setStatusFilter: (status: 'all' | 'in-progress' | 'overdue' | 'due-soon' | 'completed') => void;
}

export const MachineGrid: React.FC<MachineGridProps> = ({
  machines,
  onSelectMachine,
  searchCriteria,
  statusFilter,
  setStatusFilter,
}) => {
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'urgent' | 'progress-asc' | 'progress-desc' | 'name' | 'items-desc'>('urgent');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Extract unique projects across all machines
  const allProjects = useMemo(() => {
    const set = new Set<string>();
    machines.forEach(m => m.projects.forEach(p => set.add(p)));
    return Array.from(set).sort();
  }, [machines]);

  // Filtered & Sorted Machines
  const filteredMachines = useMemo(() => {
    let result = machines.filter(machine => {
      // 1. Machine Name Filter (ชื่อเครื่องจักร)
      if (searchCriteria.machineName) {
        const term = searchCriteria.machineName.toLowerCase().trim();
        if (!machine.name.toLowerCase().includes(term)) return false;
      }

      // 2. Document number Reference Filter (Document number Reference)
      if (searchCriteria.docRef) {
        const term = searchCriteria.docRef.toLowerCase().trim();
        const matchDoc = machine.items.some(i => i.docRef.toLowerCase().includes(term));
        if (!matchDoc) return false;
      }

      // 3. Project Number Filter (เลขที่โครงการ)
      if (searchCriteria.projectCode) {
        const term = searchCriteria.projectCode.toLowerCase().trim();
        const matchCode = machine.projectCodes.some(c => c.toLowerCase().includes(term)) ||
                          machine.items.some(i => i.projectCode.toLowerCase().includes(term));
        if (!matchCode) return false;
      }

      // 4. Project Name Filter (ชื่อโครงการ)
      if (searchCriteria.projectName) {
        const term = searchCriteria.projectName.toLowerCase().trim();
        const matchProj = machine.projects.some(p => p.toLowerCase().includes(term)) ||
                          machine.items.some(i => i.projectName.toLowerCase().includes(term));
        if (!matchProj) return false;
      }

      // 5. Document Type Filter (ประเภท)
      if (searchCriteria.docType) {
        const term = searchCriteria.docType.toLowerCase().trim();
        const matchType = machine.items.some(i => i.docType.toLowerCase().includes(term));
        if (!matchType) return false;
      }

      // Status Filter
      if (statusFilter === 'completed' && machine.progressPercent !== 100) return false;
      if (statusFilter === 'overdue' && machine.overdueItems === 0) return false;
      if (statusFilter === 'due-soon' && machine.dueSoonItems === 0) return false;
      if (statusFilter === 'in-progress' && (machine.progressPercent === 100 || machine.overdueItems > 0)) return false;

      // Project dropdown filter
      if (selectedProject !== 'all' && !machine.projects.includes(selectedProject)) {
        return false;
      }

      return true;
    });

    // Sort
    result.sort((a, b) => {
      // Always put unassigned at end unless specifically filtered
      if (a.name === '(ไม่ระบุเครื่องจักร)') return 1;
      if (b.name === '(ไม่ระบุเครื่องจักร)') return -1;

      if (sortBy === 'urgent') {
        if (a.overdueItems > 0 && b.overdueItems === 0) return -1;
        if (b.overdueItems > 0 && a.overdueItems === 0) return 1;
        if (a.dueSoonItems > 0 && b.dueSoonItems === 0) return -1;
        if (b.dueSoonItems > 0 && a.dueSoonItems === 0) return 1;
        if (a.latestTarget && b.latestTarget) {
          return new Date(a.latestTarget).getTime() - new Date(b.latestTarget).getTime();
        }
        return a.progressPercent - b.progressPercent;
      }
      if (sortBy === 'progress-asc') {
        return a.progressPercent - b.progressPercent;
      }
      if (sortBy === 'progress-desc') {
        return b.progressPercent - a.progressPercent;
      }
      if (sortBy === 'items-desc') {
        return b.totalItems - a.totalItems;
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

    return result;
  }, [machines, searchCriteria, statusFilter, selectedProject, sortBy]);

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition whitespace-nowrap ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            เครื่องจักรทั้งหมด ({machines.length})
          </button>

          <button
            onClick={() => setStatusFilter('overdue')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition whitespace-nowrap flex items-center gap-1 ${
              statusFilter === 'overdue'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>เกินกำหนด ({machines.filter(m => m.overdueItems > 0).length})</span>
          </button>

          <button
            onClick={() => setStatusFilter('due-soon')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition whitespace-nowrap flex items-center gap-1 ${
              statusFilter === 'due-soon'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>ใกล้กำหนด ({machines.filter(m => m.dueSoonItems > 0).length})</span>
          </button>

          <button
            onClick={() => setStatusFilter('in-progress')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition whitespace-nowrap flex items-center gap-1 ${
              statusFilter === 'in-progress'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>กำลังส่งมอบ ({machines.filter(m => m.progressPercent > 0 && m.progressPercent < 100).length})</span>
          </button>

          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition whitespace-nowrap flex items-center gap-1 ${
              statusFilter === 'completed'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>ส่งครบแล้ว ({machines.filter(m => m.progressPercent === 100).length})</span>
          </button>
        </div>

        {/* Dropdowns & View toggles */}
        <div className="flex items-center gap-2 justify-between md:justify-end flex-wrap">
          
          {/* Reset button if statusFilter or selectedProject is active */}
          {(statusFilter !== 'all' || selectedProject !== 'all') && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setSelectedProject('all');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-lg transition active:scale-95 cursor-pointer shadow-2xs whitespace-nowrap"
              title="รีเซ็ตตัวกรองสถานะและโครงการกลับเป็นค่าเริ่มต้น"
            >
              <RotateCcw className="w-3 h-3 text-rose-600" />
              <span>Reset กรอง</span>
            </button>
          )}

          {/* Project filter dropdown */}
          <div className="flex items-center gap-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none max-w-[140px] sm:max-w-[180px] truncate"
            >
              <option value="all">ทุกโครงการ ({allProjects.length})</option>
              {allProjects.map((p, idx) => (
                <option key={idx} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Sort dropdown */}
          <div className="flex items-center gap-1 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none"
            >
              <option value="urgent">ความเร่งด่วน (Urgent)</option>
              <option value="progress-asc">% ความคืบหน้าน้อยสุด</option>
              <option value="progress-desc">% ความคืบหน้ามากสุด</option>
              <option value="items-desc">จำนวนชิ้นส่วนมากสุด</option>
              <option value="name">ชื่อเครื่องจักร (A-Z)</option>
            </select>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-100 p-0.5">
            <button
              onClick={() => setViewMode('cards')}
              title="มุมมองการ์ด (Card View)"
              className={`p-1.5 rounded-md transition ${viewMode === 'cards' ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              title="มุมมองตาราง (Table View)"
              className={`p-1.5 rounded-md transition ${viewMode === 'table' ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>แสดง <strong>{filteredMachines.length}</strong> เครื่องจักร จากทั้งหมด {machines.length} เครื่องจักร</span>
      </div>

      {/* Cards View */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMachines.map((machine) => (
            <MachineCard
              key={machine.name}
              machine={machine}
              onSelect={onSelectMachine}
            />
          ))}

          {filteredMachines.length === 0 && (
            <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-slate-300">
              <Cpu className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-base font-semibold text-slate-700">ไม่พบเครื่องจักรที่ตรงกับเงื่อนไขการค้นหา</h4>
              <p className="text-sm text-slate-500 mt-1">
                ลองตรวจสอบหรือล้างเงื่อนไขในช่องค้นหาแยกตามฟิลด์ด้านบน
              </p>
            </div>
          )}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">ชื่อเครื่องจักร</th>
                  <th className="py-3 px-4">โครงการ</th>
                  <th className="py-3 px-4 text-center">ความคืบหน้า</th>
                  <th className="py-3 px-4 text-center">เสร็จ/ผ่าน QC</th>
                  <th className="py-3 px-4 text-center">เกินกำหนด</th>
                  <th className="py-3 px-4">เป้ากำหนดส่งล่าสุด</th>
                  <th className="py-3 px-4 text-center">สถานะ</th>
                  <th className="py-3 px-4 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMachines.map((machine) => {
                  const isCompleted = machine.progressPercent === 100;
                  const hasOverdue = machine.overdueItems > 0;
                  return (
                    <tr 
                      key={machine.name}
                      onClick={() => onSelectMachine(machine)}
                      className="hover:bg-sky-50/50 cursor-pointer transition"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <Cpu className={`w-4 h-4 ${hasOverdue ? 'text-rose-500' : isCompleted ? 'text-emerald-500' : 'text-sky-500'}`} />
                          <span>{machine.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate" title={machine.projects.join(', ')}>
                        {machine.projects.length > 0 ? machine.projects[0] : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="w-24 mx-auto space-y-1">
                          <div className="flex justify-between text-[11px] font-medium text-slate-600">
                            <span>{machine.progressPercent}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${isCompleted ? 'bg-emerald-500' : hasOverdue ? 'bg-rose-500' : 'bg-sky-500'}`}
                              style={{ width: `${machine.progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-medium text-slate-800">
                        {machine.completedOrQcItems ?? machine.deliveredItems} / {machine.totalItems}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {hasOverdue ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
                            {machine.overdueItems} รายการ
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium whitespace-nowrap">
                        {machine.latestTarget ? formatThaiDate(machine.latestTarget) : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> ส่งครบ
                          </span>
                        ) : hasOverdue ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
                            <AlertTriangle className="w-3 h-3" /> เกินกำหนด
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800">
                            <Clock className="w-3 h-3" /> กำลังส่ง
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectMachine(machine);
                          }}
                          className="px-3 py-1 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition"
                        >
                          เปิดดู
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
