import React, { useMemo, useState } from 'react';
import { 
  Search, 
  X, 
  RotateCcw, 
  FileText, 
  Hash, 
  Building2, 
  Tag, 
  Cpu, 
  Filter,
  Check,
  Briefcase,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Layers,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Clock
} from 'lucide-react';
import { SearchCriteria, DeliveryItem } from '../types';
import { isOverviewCompletedOrClosed } from '../services/sheetService';

interface SearchFilterBarProps {
  searchCriteria: SearchCriteria;
  setSearchCriteria: React.Dispatch<React.SetStateAction<SearchCriteria>>;
  items: DeliveryItem[];
  tagCounts?: { all: number; Service: number; Project: number };
  matchedMachinesCount: number;
  matchedItemsCount: number;
  actions?: React.ReactNode;
  statusFilter?: string;
  onResetStatusFilter?: () => void;
  onResetAll?: () => void;
}

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  searchCriteria,
  setSearchCriteria,
  items,
  tagCounts,
  matchedMachinesCount,
  matchedItemsCount,
  actions,
  statusFilter,
  onResetStatusFilter,
  onResetAll,
}) => {
  // Extract distinct lists for datalists / suggestions + pending counts
  const { 
    docRefs, 
    projectCodes, 
    projectNames, 
    docTypes, 
    machineNames, 
    requestDepts, 
    actionTopics,
    readyOpsWithCount,
    overviewCounts,
    pendingStats,
  } = useMemo(() => {
    const refs = new Set<string>();
    const codes = new Set<string>();
    const names = new Set<string>();
    const types = new Set<string>();
    const machines = new Set<string>();
    const depts = new Set<string>();
    const topics = new Set<string>();
    const readyOpsMap = new Map<string, number>();

    const ovCounts: Record<string, number> = {
      all: 0,
      Active: 0,
      Planned: 0,
      'Ready to Start': 0,
      Completed: 0,
      none: 0,
      hasReadyOp: 0,
    };

    let pendingAll = 0;
    let pendingOverdue = 0;
    let pendingDueSoon = 0;
    let pendingQcReady = 0;

    items.forEach(i => {
      if (i.docRef) refs.add(i.docRef.trim());
      if (i.projectCode) codes.add(i.projectCode.trim());
      if (i.projectName) names.add(i.projectName.trim());
      if (i.docType) types.add(i.docType.trim());
      if (i.machineName && i.machineName !== '(ไม่ระบุเครื่องจักร)') machines.add(i.machineName.trim());
      if (i.requestDept) depts.add(i.requestDept.trim());
      if (i.actionTopic) topics.add(i.actionTopic.trim());

      if (i.status !== 'ส่งแล้ว') {
        pendingAll++;
        ovCounts.all++;
        if (i.isOverdue) pendingOverdue++;
        if (i.isDueSoon) pendingDueSoon++;
        if (i.isQcPassed) pendingQcReady++;

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
          readyOpsMap.set(desc, (readyOpsMap.get(desc) || 0) + 1);
        }
      }
    });

    const readyOpsSorted = Array.from(readyOpsMap.entries())
      .sort((a, b) => b[1] - a[1]);

    const pdPercent = ovCounts.all > 0 ? (ovCounts.Completed / ovCounts.all) * 100 : 0;
    const pdPercentText = pdPercent % 1 === 0 ? `${pdPercent}%` : `${pdPercent.toFixed(1)}%`;

    return {
      docRefs: Array.from(refs).sort(),
      projectCodes: Array.from(codes).sort(),
      projectNames: Array.from(names).sort(),
      docTypes: Array.from(types).sort(),
      machineNames: Array.from(machines).sort(),
      requestDepts: Array.from(depts).sort(),
      actionTopics: Array.from(topics).sort(),
      readyOpsWithCount: readyOpsSorted,
      overviewCounts: ovCounts,
      pendingStats: {
        all: pendingAll,
        overdue: pendingOverdue,
        dueSoon: pendingDueSoon,
        qcReady: pendingQcReady,
        pdPercentText,
      },
    };
  }, [items]);

  const hasAnyFilter = Boolean(
    (statusFilter && statusFilter !== 'all') ||
    (searchCriteria.workTag && searchCriteria.workTag !== 'all') ||
    searchCriteria.quickSearch ||
    (searchCriteria.dateWindow && searchCriteria.dateWindow !== 'all') ||
    searchCriteria.docRef ||
    searchCriteria.projectCode ||
    searchCriteria.projectName ||
    searchCriteria.docType ||
    searchCriteria.machineName ||
    searchCriteria.requestDept ||
    searchCriteria.actionTopic ||
    (searchCriteria.qcStatus && searchCriteria.qcStatus !== 'all') ||
    (searchCriteria.overviewStatus && searchCriteria.overviewStatus !== 'all') ||
    (searchCriteria.readyOpName && searchCriteria.readyOpName !== 'all') ||
    (searchCriteria.operationStatus && searchCriteria.operationStatus !== 'all')
  );

  const handleReset = () => {
    setSearchCriteria(prev => ({
      workTag: 'all',
      quickSearch: '',
      dateWindow: 'all',
      statusSource: prev.statusSource || 'overview',
      docRef: '',
      projectCode: '',
      projectName: '',
      docType: '',
      machineName: '',
      requestDept: '',
      actionTopic: '',
      qcStatus: 'all',
      overviewStatus: 'all',
      readyOpName: 'all',
      operationStatus: 'all',
    }));
    if (onResetStatusFilter) {
      onResetStatusFilter();
    }
    if (onResetAll) {
      onResetAll();
    }
  };

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('pdtrack_filter_collapsed');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('pdtrack_filter_collapsed', String(next));
      return next;
    });
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (statusFilter && statusFilter !== 'all') count++;
    if (searchCriteria.workTag && searchCriteria.workTag !== 'all') count++;
    if (searchCriteria.quickSearch) count++;
    if (searchCriteria.dateWindow && searchCriteria.dateWindow !== 'all') count++;
    if (searchCriteria.docRef) count++;
    if (searchCriteria.projectCode) count++;
    if (searchCriteria.projectName) count++;
    if (searchCriteria.docType) count++;
    if (searchCriteria.machineName) count++;
    if (searchCriteria.requestDept) count++;
    if (searchCriteria.actionTopic) count++;
    if (searchCriteria.qcStatus && searchCriteria.qcStatus !== 'all') count++;
    if (searchCriteria.overviewStatus && searchCriteria.overviewStatus !== 'all') count++;
    if (searchCriteria.readyOpName && searchCriteria.readyOpName !== 'all') count++;
    if (searchCriteria.operationStatus && searchCriteria.operationStatus !== 'all') count++;
    return count;
  }, [searchCriteria, statusFilter]);

  const updateField = (field: keyof SearchCriteria, value: string) => {
    setSearchCriteria(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const currentWorkTag = searchCriteria.workTag || 'all';

  const workTagSelector = (
    <div className="inline-flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-300 shadow-2xs">
      <span className="text-[11px] font-bold text-slate-600 px-2 flex items-center gap-1 select-none">
        <Tag className="w-3.5 h-3.5 text-indigo-600" />
        <span>แสดงข้อมูล:</span>
      </span>
      <button
        type="button"
        onClick={() => updateField('workTag', 'all')}
        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
          currentWorkTag === 'all'
            ? 'bg-slate-900 text-white shadow-xs'
            : 'text-slate-600 hover:bg-slate-100'
        }`}
        title="แสดงทั้งงาน Service และงานโครงการ (Project)"
      >
        <span>ทั้งคู่</span>
        {tagCounts && (
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
            currentWorkTag === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
          }`}>
            {tagCounts.all}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => updateField('workTag', 'Service')}
        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
          currentWorkTag === 'Service'
            ? 'bg-sky-600 text-white shadow-xs'
            : 'text-sky-700 hover:bg-sky-50'
        }`}
        title="แสดงเฉพาะงานเดิมจาก Check list ส่งมอบ (TAG: Service)"
      >
        <span className="w-2 h-2 rounded-full bg-current opacity-80"></span>
        <span>Service</span>
        {tagCounts && (
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
            currentWorkTag === 'Service' ? 'bg-white/20 text-white' : 'bg-sky-100 text-sky-800'
          }`}>
            {tagCounts.Service}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => updateField('workTag', 'Project')}
        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
          currentWorkTag === 'Project'
            ? 'bg-violet-600 text-white shadow-xs'
            : 'text-violet-700 hover:bg-violet-50'
        }`}
        title="แสดงเฉพาะงานโครงการ สั่งผลิตเครื่องจักรตาม Machine List (TAG: Project)"
      >
        <span className="w-2 h-2 rounded-full bg-current opacity-80"></span>
        <span>Project</span>
        {tagCounts && (
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
            currentWorkTag === 'Project' ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-800'
          }`}>
            {tagCounts.Project}
          </span>
        )}
      </button>
    </div>
  );

  // 1. Collapsed State: Compact 1-Icon Button + Always-Visible TAG Selector
  if (isCollapsed) {
    return (
      <div className="flex items-center justify-between gap-3 flex-wrap animate-in fade-in duration-150 py-1">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Prominent TAG Selector: ทั้งคู่ | Service | Project */}
          {workTagSelector}

          {/* The Single Icon Button to expand */}
          <button
            onClick={toggleCollapse}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold shadow-xs transition-all duration-150 cursor-pointer ${
              hasAnyFilter
                ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-blue-500/20'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 hover:border-slate-400'
            }`}
            title="คลิกเพื่อขยายระบบตัวกรองค้นหา (5 ฟิลด์หลัก & แผนก/QC)"
          >
            <div className={`p-1 rounded-lg ${hasAnyFilter ? 'bg-white/20 text-white' : 'bg-sky-100 text-sky-700'}`}>
              <Filter className="w-3.5 h-3.5" />
            </div>
            <span>ตัวกรองค้นหา (Filter)</span>
            {hasAnyFilter ? (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-blue-700">
                กำลังกรอง {activeFiltersCount}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-normal">
                (คลิกเพื่อขยาย)
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 opacity-70" />
          </button>

          {/* Active criteria chips when collapsed */}
          {hasAnyFilter && (
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              {searchCriteria.quickSearch && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-300 text-[11px] font-semibold">
                  <Search className="w-3 h-3 text-slate-500" />
                  <span>ค้นหา: {searchCriteria.quickSearch}</span>
                </span>
              )}
              {searchCriteria.dateWindow && searchCriteria.dateWindow !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 text-[11px] font-semibold">
                  <span>
                    ช่วงเวลา:{' '}
                    {searchCriteria.dateWindow === 'overdue'
                      ? 'เกินกำหนด'
                      : searchCriteria.dateWindow === '7days'
                      ? 'ภายใน 7 วัน'
                      : searchCriteria.dateWindow === 'qc-ready'
                      ? 'ผ่าน QC แล้วพร้อมส่ง'
                      : searchCriteria.dateWindow}
                  </span>
                </span>
              )}
              {searchCriteria.docRef && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 border border-sky-200 text-[11px] font-medium">
                  <span>Doc: {searchCriteria.docRef}</span>
                </span>
              )}
              {searchCriteria.projectCode && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 text-[11px] font-medium">
                  <span>โครงการ: {searchCriteria.projectCode}</span>
                </span>
              )}
              {searchCriteria.projectName && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-medium">
                  <span>ชื่อ: {searchCriteria.projectName}</span>
                </span>
              )}
              {searchCriteria.docType && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-medium">
                  <span>ประเภท: {searchCriteria.docType}</span>
                </span>
              )}
              {searchCriteria.machineName && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 text-[11px] font-medium">
                  <span>เครื่อง: {searchCriteria.machineName}</span>
                </span>
              )}
              {searchCriteria.requestDept && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-medium">
                  <span>แผนก: {searchCriteria.requestDept}</span>
                </span>
              )}
              {searchCriteria.actionTopic && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 text-[11px] font-medium">
                  <span>สาเหตุ: {searchCriteria.actionTopic}</span>
                </span>
              )}
              {searchCriteria.qcStatus && searchCriteria.qcStatus !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-medium">
                  <span>QC: {searchCriteria.qcStatus === 'passed' ? 'ผ่านแล้ว' : 'ยังไม่เข้า'}</span>
                </span>
              )}
              {searchCriteria.overviewStatus && searchCriteria.overviewStatus !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-medium">
                  <span>Overview: {searchCriteria.overviewStatus === 'Completed' ? '✓ เสร็จแล้ว' : searchCriteria.overviewStatus === 'none' ? 'ไม่มีสถานะ' : searchCriteria.overviewStatus}</span>
                </span>
              )}
              {searchCriteria.readyOpName && searchCriteria.readyOpName !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 text-[11px] font-semibold">
                  <Clock className="w-3 h-3 text-amber-600" />
                  <span>Op รอขึ้น: {searchCriteria.readyOpName === 'any_ready' ? 'มี Op รอขึ้น' : searchCriteria.readyOpName}</span>
                </span>
              )}
              {statusFilter && statusFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 border border-rose-200 text-[11px] font-medium">
                  <span>สถานะ: {statusFilter === 'overdue' ? 'เกินกำหนด' : statusFilter === 'due-soon' ? 'ใกล้กำหนด' : statusFilter === 'in-progress' ? 'กำลังส่งมอบ' : statusFilter === 'completed' ? 'ส่งครบแล้ว' : statusFilter}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right side: Actions + Results indicator & Reset Filter Button */}
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {actions}

          {/* Dedicated Reset Filter Button */}
          <button
            onClick={handleReset}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
              hasAnyFilter
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300 shadow-2xs font-bold'
                : 'bg-white hover:bg-slate-50 text-slate-500 border-slate-200 shadow-2xs'
            }`}
            title={hasAnyFilter ? "รีเซ็ตตัวกรองและเงื่อนไขค้นหาทั้งหมด" : "รีเซ็ตตัวกรอง"}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${hasAnyFilter ? 'text-rose-600' : 'text-slate-400'}`} />
            <span>Reset กรอง</span>
            {hasAnyFilter && (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
            )}
          </button>

          {hasAnyFilter && (
            <div className="text-xs px-2.5 py-1.5 rounded-xl bg-sky-50 text-sky-800 border border-sky-200 font-medium flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-sky-600" />
              <span>ผลลัพธ์: {matchedMachinesCount} เครื่อง ({matchedItemsCount} รายการ)</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. Expanded State: Full Filter Panel
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden space-y-0 animate-in fade-in zoom-in-98 duration-150">
      {/* Header Banner */}
      <div 
        onClick={toggleCollapse}
        className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-100/80 transition"
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className={`p-1.5 rounded-lg transition ${hasAnyFilter ? 'bg-blue-600 text-white shadow-xs' : 'bg-sky-100 text-sky-700'}`}>
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900">
                ตัวกรองค้นหาและควบคุมการแสดงผล (Unified Search & Filter)
              </h3>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                เชื่อมโยงฝ่ายผลิต (Production Linked)
              </span>
              {hasAnyFilter && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                  กำลังกรอง {activeFiltersCount} เงื่อนไข
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              ค้นหาด่วน, กรองตาม 5 ฟิลด์หลัก, ช่วงเวลาแผนส่งมอบ, สถานะ Overview, ขั้นตอนรอขึ้นทำงาน และแหล่งตรวจสอบสถานะ
            </p>
          </div>
        </div>

        {/* Results indicator & Reset & Actions & Collapse Button */}
        <div className="flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
          {workTagSelector}
          {actions}

          {/* Dedicated Reset Filter Button */}
          <button
            onClick={handleReset}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all active:scale-95 cursor-pointer ${
              hasAnyFilter
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300 shadow-2xs font-bold'
                : 'bg-white hover:bg-slate-50 text-slate-500 border-slate-200'
            }`}
            title={hasAnyFilter ? "รีเซ็ตตัวกรองและเงื่อนไขค้นหาทั้งหมด" : "รีเซ็ตตัวกรอง"}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${hasAnyFilter ? 'text-rose-600' : 'text-slate-400'}`} />
            <span>Reset กรอง</span>
            {hasAnyFilter && (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
            )}
          </button>

          {hasAnyFilter && (
            <div className="text-xs px-2.5 py-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200 font-medium flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-sky-600" />
              <span>ผลลัพธ์: {matchedMachinesCount} เครื่องจักร ({matchedItemsCount} รายการ)</span>
            </div>
          )}

          {/* Button to Collapse back to 1 Icon */}
          <button
            onClick={toggleCollapse}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition shadow-2xs cursor-pointer bg-white hover:bg-slate-100 text-slate-700 border-slate-300"
            title="ยุบเป็นไอคอน 1 ตัว (Collapse to Icon)"
          >
            <EyeOff className="w-3.5 h-3.5 text-slate-500" />
            <span>ยุบตัวกรอง</span>
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Filter Body */}
      <div className="divide-y divide-slate-100">
        {/* Row 1: Quick Search + Date Window Filter Buttons */}
        <div className="px-4 sm:px-5 py-3 bg-slate-50/40 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          {/* Quick Search Input */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchCriteria.quickSearch || ''}
              onChange={(e) => updateField('quickSearch', e.target.value)}
              placeholder="ค้นหาชื่อชิ้นงาน, เครื่องจักร, PD No., โครงการ..."
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-sky-500 shadow-2xs"
            />
            {searchCriteria.quickSearch && (
              <button
                onClick={() => updateField('quickSearch', '')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Date Window Filter Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-slate-500 text-[11px] font-semibold mr-1">ช่วงเวลาแผนส่งมอบ:</span>

            <button
              onClick={() => updateField('dateWindow', 'all')}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                !searchCriteria.dateWindow || searchCriteria.dateWindow === 'all'
                  ? 'bg-slate-800 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ทั้งหมด ({pendingStats.all})
            </button>

            <button
              onClick={() => updateField('dateWindow', searchCriteria.dateWindow === 'overdue' ? 'all' : 'overdue')}
              className={`px-3 py-1 rounded-lg font-medium flex items-center gap-1 transition cursor-pointer ${
                searchCriteria.dateWindow === 'overdue'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              เกินกำหนด ({pendingStats.overdue})
            </button>

            <button
              onClick={() => updateField('dateWindow', searchCriteria.dateWindow === '7days' ? 'all' : '7days')}
              className={`px-3 py-1 rounded-lg font-medium flex items-center gap-1 transition cursor-pointer ${
                searchCriteria.dateWindow === '7days'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <Clock className="w-3 h-3" />
              ภายใน 7 วัน ({pendingStats.dueSoon})
            </button>

            <button
              onClick={() => updateField('dateWindow', searchCriteria.dateWindow === 'qc-ready' ? 'all' : 'qc-ready')}
              className={`px-3 py-1 rounded-lg font-medium flex items-center gap-1 transition cursor-pointer ${
                searchCriteria.dateWindow === 'qc-ready'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              ผ่าน QC แล้วพร้อมส่ง ({pendingStats.qcReady})
            </button>
          </div>
        </div>

        {/* Row 2: 5 Primary Search Inputs */}
        <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        
        {/* 1. Document number Reference */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-sky-600" />
            <span>Document number Ref</span>
          </label>
          <div className="relative">
            <input
              type="text"
              list="datalist-docref"
              value={searchCriteria.docRef}
              onChange={(e) => updateField('docRef', e.target.value)}
              placeholder="เช่น EN 69-4-44..."
              className="w-full px-3 py-2 text-xs bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-sky-500 rounded-lg outline-none transition font-mono pr-7"
            />
            {searchCriteria.docRef && (
              <button
                onClick={() => updateField('docRef', '')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <datalist id="datalist-docref">
              {docRefs.map((r, i) => (
                <option key={i} value={r} />
              ))}
            </datalist>
          </div>
          <span className="text-[10px] text-slate-400 block truncate">
            {docRefs.length} เลขที่เอกสารในระบบ
          </span>
        </div>

        {/* 2. เลขที่โครงการ */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-indigo-600" />
            <span>เลขที่โครงการ</span>
          </label>
          <div className="relative">
            <input
              type="text"
              list="datalist-projcode"
              value={searchCriteria.projectCode}
              onChange={(e) => updateField('projectCode', e.target.value)}
              placeholder="เช่น BDM250044..."
              className="w-full px-3 py-2 text-xs bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-sky-500 rounded-lg outline-none transition font-mono pr-7"
            />
            {searchCriteria.projectCode && (
              <button
                onClick={() => updateField('projectCode', '')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <datalist id="datalist-projcode">
              {projectCodes.map((c, i) => (
                <option key={i} value={c} />
              ))}
            </datalist>
          </div>
          <span className="text-[10px] text-slate-400 block truncate">
            {projectCodes.length} รหัสโครงการ
          </span>
        </div>

        {/* 3. ชื่อโครงการ */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
            <span>ชื่อโครงการ</span>
          </label>
          <div className="relative">
            <input
              type="text"
              list="datalist-projname"
              value={searchCriteria.projectName}
              onChange={(e) => updateField('projectName', e.target.value)}
              placeholder="เช่น DH บุรีรัมย์, Dohome..."
              className="w-full px-3 py-2 text-xs bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-sky-500 rounded-lg outline-none transition pr-7"
            />
            {searchCriteria.projectName && (
              <button
                onClick={() => updateField('projectName', '')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <datalist id="datalist-projname">
              {projectNames.map((n, i) => (
                <option key={i} value={n} />
              ))}
            </datalist>
          </div>
          <span className="text-[10px] text-slate-400 block truncate">
            {projectNames.length} โครงการ
          </span>
        </div>

        {/* 4. ประเภท */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-emerald-600" />
            <span>ประเภท</span>
          </label>
          <div className="relative">
            <input
              type="text"
              list="datalist-doctype"
              value={searchCriteria.docType}
              onChange={(e) => updateField('docType', e.target.value)}
              placeholder="เช่น เอกสาร 04..."
              className="w-full px-3 py-2 text-xs bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-sky-500 rounded-lg outline-none transition pr-7"
            />
            {searchCriteria.docType && (
              <button
                onClick={() => updateField('docType', '')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <datalist id="datalist-doctype">
              {docTypes.map((t, i) => (
                <option key={i} value={t} />
              ))}
            </datalist>
          </div>
          <span className="text-[10px] text-slate-400 block truncate">
            เช่น {docTypes.join(', ')}
          </span>
        </div>

        {/* 5. ชื่อเครื่องจักร (ดัชนีหลัก) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-purple-600" />
            <span>ชื่อเครื่องจักร (ดัชนี)</span>
          </label>
          <div className="relative">
            <input
              type="text"
              list="datalist-machines"
              value={searchCriteria.machineName}
              onChange={(e) => updateField('machineName', e.target.value)}
              placeholder="เช่น MDPB-26-0165..."
              className="w-full px-3 py-2 text-xs bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-sky-500 rounded-lg outline-none transition font-bold text-slate-800 font-mono pr-7"
            />
            {searchCriteria.machineName && (
              <button
                onClick={() => updateField('machineName', '')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <datalist id="datalist-machines">
              {machineNames.map((m, i) => (
                <option key={i} value={m} />
              ))}
            </datalist>
          </div>
          <span className="text-[10px] text-slate-400 block truncate">
            {machineNames.length} ชื่อเครื่องจักร
          </span>
        </div>

      </div>

      {/* Row 3: Overview Status Quick Buttons & Ready Operation Filter */}
      <div className="px-5 py-2.5 bg-slate-50/70 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
        {/* Overview Status Quick Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-600 font-semibold flex items-center gap-1 text-[11px]">
            <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
            <span>ตัวกรองสถานะ Overview:</span>
          </span>
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 flex-wrap">
            <button
              onClick={() => updateField('overviewStatus', 'all')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                !searchCriteria.overviewStatus || searchCriteria.overviewStatus === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทั้งหมด
            </button>
            <button
              onClick={() => updateField('overviewStatus', searchCriteria.overviewStatus === 'Active' ? 'all' : 'Active')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                searchCriteria.overviewStatus === 'Active'
                  ? 'bg-blue-600 text-white shadow-2xs font-bold'
                  : 'text-blue-700 hover:bg-blue-50'
              }`}
            >
              ⚡ Active ({overviewCounts.Active})
            </button>
            <button
              onClick={() => updateField('overviewStatus', searchCriteria.overviewStatus === 'Planned' ? 'all' : 'Planned')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                searchCriteria.overviewStatus === 'Planned'
                  ? 'bg-purple-600 text-white shadow-2xs font-bold'
                  : 'text-purple-700 hover:bg-purple-50'
              }`}
            >
              📅 Planned ({overviewCounts.Planned})
            </button>
            <button
              onClick={() => updateField('overviewStatus', searchCriteria.overviewStatus === 'Ready to Start' ? 'all' : 'Ready to Start')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                searchCriteria.overviewStatus === 'Ready to Start'
                  ? 'bg-amber-600 text-white shadow-2xs font-bold'
                  : 'text-amber-700 hover:bg-amber-50'
              }`}
            >
              🕒 Ready to Start ({overviewCounts['Ready to Start']})
            </button>
            <button
              onClick={() => updateField('overviewStatus', searchCriteria.overviewStatus === 'Completed' ? 'all' : 'Completed')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                searchCriteria.overviewStatus === 'Completed'
                  ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
              title={`PD ที่เสร็จแล้ว ${overviewCounts.Completed} จาก ${overviewCounts.all} รายการ (${pendingStats.pdPercentText})`}
            >
              ✓ เสร็จแล้ว ({overviewCounts.Completed}/{overviewCounts.all} - {pendingStats.pdPercentText})
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
            onClick={() => updateField('readyOpName', searchCriteria.readyOpName === 'any_ready' ? 'all' : 'any_ready')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer border ${
              searchCriteria.readyOpName === 'any_ready'
                ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border-amber-200'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>เฉพาะมี Op รอขึ้น ({overviewCounts.hasReadyOp})</span>
          </button>

          {readyOpsWithCount.length > 0 && (
            <select
              value={searchCriteria.readyOpName && searchCriteria.readyOpName !== 'any_ready' ? searchCriteria.readyOpName : 'all'}
              onChange={(e) => updateField('readyOpName', e.target.value)}
              className={`px-2 py-1 rounded-lg border text-xs font-semibold outline-none max-w-[210px] truncate ${
                searchCriteria.readyOpName && searchCriteria.readyOpName !== 'all' && searchCriteria.readyOpName !== 'any_ready'
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
        </div>
      </div>

      {/* Row 4: Department, Topic, QC Status & Table Status Source Switcher */}
      <div className="px-5 py-2.5 bg-slate-50/70 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-slate-500 font-medium flex items-center gap-1">
            <Briefcase className="w-3.5 h-3.5 text-slate-400" />
            <span>กรองเพิ่มเติม:</span>
          </span>

          {/* Department Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">แผนกที่แจ้ง:</span>
            <select
              value={searchCriteria.requestDept || ''}
              onChange={(e) => updateField('requestDept', e.target.value)}
              className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 outline-none max-w-[150px]"
            >
              <option value="">ทุกแผนก ({requestDepts.length})</option>
              {requestDepts.map((d, i) => (
                <option key={i} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Action Topic Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">สาเหตุสั่งผลิต:</span>
            <select
              value={searchCriteria.actionTopic || ''}
              onChange={(e) => updateField('actionTopic', e.target.value)}
              className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 outline-none max-w-[180px] truncate"
            >
              <option value="">ทุกสาเหตุ ({actionTopics.length})</option>
              {actionTopics.map((t, i) => (
                <option key={i} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* QC Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">สถานะ QC:</span>
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs shadow-2xs">
              <button
                onClick={() => updateField('qcStatus', 'all')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                  !searchCriteria.qcStatus || searchCriteria.qcStatus === 'all'
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ทั้งหมด
              </button>
              <button
                onClick={() => updateField('qcStatus', 'passed')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition cursor-pointer ${
                  searchCriteria.qcStatus === 'passed'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                <Check className="w-3 h-3" />
                ผ่าน QC แล้ว
              </button>
              <button
                onClick={() => updateField('qcStatus', 'pending')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                  searchCriteria.qcStatus === 'pending'
                    ? 'bg-slate-600 text-white shadow-2xs'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                ยังไม่เข้า QC
              </button>
            </div>
          </div>
        </div>

        {/* Status Source View Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-600 font-bold flex items-center gap-1.5 text-[11px]">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>แหล่งตรวจสอบสถานะในตาราง:</span>
          </span>
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
            <button
              onClick={() => updateField('statusSource', 'overview')}
              className={`px-2.5 py-1 rounded-md text-xs transition cursor-pointer ${
                !searchCriteria.statusSource || searchCriteria.statusSource === 'overview'
                  ? 'bg-white text-blue-800 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              📊 Overview status
            </button>
            <button
              onClick={() => updateField('statusSource', 'qc')}
              className={`px-2.5 py-1 rounded-md text-xs transition cursor-pointer ${
                searchCriteria.statusSource === 'qc'
                  ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              🛡️ QC Record
            </button>
            <button
              onClick={() => updateField('statusSource', 'dual')}
              className={`px-2.5 py-1 rounded-md text-xs transition cursor-pointer ${
                searchCriteria.statusSource === 'dual'
                  ? 'bg-white text-purple-800 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              ⚡ แสดงทั้ง 2 แหล่ง (Dual)
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
