import React, { useMemo, useState, useRef, useEffect } from 'react';
import { 
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
  Clock,
  X
} from 'lucide-react';
import { SearchCriteria, DeliveryItem } from '../types';
import { isOverviewCompletedOrClosed } from '../services/sheetService';

interface SearchableComboboxProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  allLabel?: string;
  activeColorClass?: string;
  fontMono?: boolean;
}

const SearchableCombobox: React.FC<SearchableComboboxProps> = ({
  value,
  onChange,
  options,
  placeholder = 'ค้นหา...',
  allLabel = 'ทุกรหัส',
  activeColorClass = 'bg-indigo-50 text-indigo-900 border-indigo-400 font-bold',
  fontMono = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ปิดรายการเมื่อคลิกนอกพื้นที่
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // กรองตัวเลือกตามข้อความที่พิมพ์
  const filteredOptions = useMemo(() => {
    if (!value) return options;
    const term = value.toLowerCase().trim();
    return options.filter(opt => opt.toLowerCase().includes(term));
  }, [options, value]);

  const handleSelect = (selectedVal: string) => {
    onChange(selectedVal);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(true);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter') {
      if (filteredOptions.length > 0) {
        handleSelect(filteredOptions[0]);
      } else {
        setIsOpen(false);
      }
    } else if (e.key === 'ArrowDown') {
      if (!isOpen) setIsOpen(true);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          title="พิมพ์เพื่อค้นหา หรือคลิกเพื่อเลือกจากรายการ"
          className={`w-full pl-2 pr-12 py-1.5 rounded-lg border text-xs outline-none transition truncate cursor-text ${
            fontMono ? 'font-mono' : ''
          } ${
            value
              ? activeColorClass
              : 'bg-slate-50 hover:bg-slate-100/70 text-slate-700 border-slate-200 font-medium'
          }`}
        />
        <div className="absolute right-1 flex items-center gap-0.5">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition cursor-pointer"
              title="ล้างข้อความ"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setIsOpen(prev => !prev);
              if (!isOpen) inputRef.current?.focus();
            }}
            className="p-1 text-slate-400 hover:text-slate-600 transition cursor-pointer"
            tabIndex={-1}
            title={isOpen ? 'ปิดรายการ' : 'เปิดรายการ'}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Floating Dropdown List */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-full min-w-[200px] max-h-60 overflow-y-auto bg-white rounded-lg border border-slate-200 shadow-xl z-50 py-1 text-xs animate-in fade-in duration-100">
          <div
            onClick={() => handleSelect('')}
            className={`px-2.5 py-1.5 cursor-pointer hover:bg-indigo-50 transition flex items-center justify-between text-slate-700 ${
              !value ? 'bg-indigo-50/70 font-bold text-indigo-700' : ''
            }`}
          >
            <span>{allLabel} ({options.length})</span>
            {!value && <Check className="w-3 h-3 text-indigo-600 shrink-0" />}
          </div>

          <div className="h-px bg-slate-100 my-1" />

          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, i) => {
              const isSelected = value.trim().toLowerCase() === opt.toLowerCase();
              return (
                <div
                  key={i}
                  onClick={() => handleSelect(opt)}
                  className={`px-2.5 py-1.5 cursor-pointer hover:bg-indigo-50 transition flex items-center justify-between ${
                    fontMono ? 'font-mono' : ''
                  } ${
                    isSelected ? 'bg-indigo-50 font-bold text-indigo-900' : 'text-slate-700'
                  }`}
                >
                  <span className="truncate">{opt}</span>
                  {isSelected && <Check className="w-3 h-3 text-indigo-600 shrink-0 ml-1.5" />}
                </div>
              );
            })
          ) : (
            <div className="px-2.5 py-2 text-center text-slate-400 text-[11px] italic">
              ไม่พบรหัสที่ตรงกับ "{value}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

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
    (searchCriteria.operationStatus && searchCriteria.operationStatus !== 'all')
  );

  const handleReset = () => {
    setSearchCriteria(prev => ({
      workTag: 'all',
      quickSearch: '',
      dateWindow: 'all',
      statusSource: prev.statusSource || 'dual',
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

  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);

  const toggleCollapse = () => {
    setIsCollapsed(prev => !prev);
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (statusFilter && statusFilter !== 'all') count++;
    if (searchCriteria.workTag && searchCriteria.workTag !== 'all') count++;
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

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm divide-y divide-slate-200/80 animate-in fade-in duration-150">
      {/* แถวที่ 1: มุมมองการดู (Dropdown และเรียงเป็นบรรทัดเดียวกันทั้งหมด) */}
      <div className="px-3.5 sm:px-4 py-2 bg-slate-50/80 rounded-t-2xl flex items-center justify-between gap-2 flex-nowrap overflow-x-auto whitespace-nowrap">
        {/* Left: มุมมองการดู (Dropdowns) */}
        <div className="flex items-center gap-2 flex-nowrap shrink-0">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1 select-none shrink-0">
            <Eye className="w-3.5 h-3.5 text-indigo-600" />
            <span>มุมมองการดู:</span>
          </span>

          {/* 1. มุมมองประเภทงาน (Dropdown: ทั้งคู่ / Service / Project) */}
          <div className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-300 shadow-2xs shrink-0">
            <Tag className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-500 select-none">ข้อมูล:</span>
            <select
              value={currentWorkTag}
              onChange={(e) => updateField('workTag', e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
            >
              <option value="all">ทั้งคู่ ({tagCounts ? tagCounts.all : items.length})</option>
              <option value="Service">Service ({tagCounts ? tagCounts.Service : '-'})</option>
              <option value="Project">Project ({tagCounts ? tagCounts.Project : '-'})</option>
            </select>
          </div>

          {/* 2. มุมมองแหล่งตรวจสอบสถานะในตาราง (Dropdown: Overview / QC Record / Dual) */}
          <div className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-300 shadow-2xs shrink-0">
            <Layers className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-500 select-none">สถานะตาราง:</span>
            <select
              value={searchCriteria.statusSource || 'dual'}
              onChange={(e) => updateField('statusSource', e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
            >
              <option value="overview">📊 Overview status</option>
              <option value="qc">🛡️ QC Record</option>
              <option value="dual">⚡ แสดงทั้ง 2 แหล่ง (Dual)</option>
            </select>
          </div>
        </div>

        {/* Right: ปุ่มเครื่องมือ + ปุ่มเปิด/พับตัวกรอง + Reset (บรรทัดเดียวกัน) */}
        <div className="flex items-center gap-1.5 flex-nowrap shrink-0 ml-auto">
          {actions}

          {/* Toggle Filter Row Button */}
          <button
            onClick={toggleCollapse}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer shrink-0 ${
              hasAnyFilter
                ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-2xs'
            }`}
            title={isCollapsed ? 'คลิกเพื่อแสดงแถวตัวกรอง' : 'คลิกเพื่อซ่อนแถวตัวกรอง'}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>ตัวกรองค้นหา</span>
            {hasAnyFilter && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-white text-blue-700">
                {activeFiltersCount}
              </span>
            )}
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>

          {/* Reset Filter Button */}
          <button
            onClick={handleReset}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition active:scale-95 cursor-pointer shrink-0 ${
              hasAnyFilter
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300 shadow-2xs font-bold'
                : 'bg-white hover:bg-slate-50 text-slate-500 border-slate-200 shadow-2xs'
            }`}
            title="รีเซ็ตตัวกรองทั้งหมด"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${hasAnyFilter ? 'text-rose-600' : 'text-slate-400'}`} />
            <span>Reset กรอง</span>
          </button>

          {hasAnyFilter && (
            <div className="text-xs px-2.5 py-1 rounded-xl bg-sky-50 text-sky-800 border border-sky-200 font-semibold flex items-center gap-1 shrink-0">
              <Check className="w-3.5 h-3.5 text-sky-600" />
              <span>{matchedMachinesCount} เครื่อง ({matchedItemsCount} รายการ)</span>
            </div>
          )}
        </div>
      </div>

      {/* แถวที่ 2: หัวข้อการกรองเรียงเป็นแนวบรรทัดเดียว และแต่ละหัวข้อเป็น Dropdown เลือก */}
      {!isCollapsed && (
        <div className="px-3.5 sm:px-4 py-2.5 bg-white rounded-b-2xl">
          <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-5 xl:grid-cols-10 gap-2 items-end">
            {/* 1. เลขที่เอกสาร 04 (Dropdown) */}
            <div className="space-y-1 min-w-0">
              <label className="text-[10px] font-bold text-slate-600 flex items-center gap-1 truncate">
                <Cpu className="w-3 h-3 text-purple-600 shrink-0" />
                <span className="truncate">เลขที่เอกสาร 04</span>
              </label>
              <select
                value={searchCriteria.machineName || ''}
                onChange={(e) => updateField('machineName', e.target.value)}
                className={`w-full px-2 py-1.5 rounded-lg border text-xs outline-none transition truncate cursor-pointer font-mono ${
                  searchCriteria.machineName
                    ? 'bg-purple-50 text-purple-900 border-purple-400 font-bold'
                    : 'bg-slate-50 hover:bg-slate-100/70 text-slate-700 border-slate-200 font-medium'
                }`}
              >
                <option value="">ทุกเอกสาร 04 ({machineNames.length})</option>
                {machineNames.map((m, i) => (
                  <option key={i} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* 2. แผนกที่แจ้ง (Dropdown) */}
            <div className="space-y-1 min-w-0">
              <label className="text-[10px] font-bold text-slate-600 flex items-center gap-1 truncate">
                <Briefcase className="w-3 h-3 text-amber-600 shrink-0" />
                <span className="truncate">แผนกที่แจ้ง</span>
              </label>
              <select
                value={searchCriteria.requestDept || ''}
                onChange={(e) => updateField('requestDept', e.target.value)}
                className={`w-full px-2 py-1.5 rounded-lg border text-xs outline-none transition truncate cursor-pointer ${
                  searchCriteria.requestDept
                    ? 'bg-amber-50 text-amber-900 border-amber-400 font-bold'
                    : 'bg-slate-50 hover:bg-slate-100/70 text-slate-700 border-slate-200 font-medium'
                }`}
              >
                <option value="">ทุกแผนก ({requestDepts.length})</option>
                {requestDepts.map((d, i) => (
                  <option key={i} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* 3. Document Ref (Dropdown) */}
            <div className="space-y-1 min-w-0">
              <label className="text-[10px] font-bold text-slate-600 flex items-center gap-1 truncate">
                <FileText className="w-3 h-3 text-sky-600 shrink-0" />
                <span className="truncate">Document Ref</span>
              </label>
              <select
                value={searchCriteria.docRef || ''}
                onChange={(e) => updateField('docRef', e.target.value)}
                className={`w-full px-2 py-1.5 rounded-lg border text-xs outline-none transition truncate cursor-pointer font-mono ${
                  searchCriteria.docRef
                    ? 'bg-sky-50 text-sky-900 border-sky-400 font-bold'
                    : 'bg-slate-50 hover:bg-slate-100/70 text-slate-700 border-slate-200 font-medium'
                }`}
              >
                <option value="">ทุกเอกสาร ({docRefs.length})</option>
                {docRefs.map((r, i) => (
                  <option key={i} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* 4. ช่วงเวลาแผนส่งมอบ (Dropdown) */}
            <div className="space-y-1 min-w-0">
              <label className="text-[10px] font-bold text-slate-600 flex items-center gap-1 truncate">
                <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                <span className="truncate">ช่วงเวลาส่งมอบ</span>
              </label>
              <select
                value={searchCriteria.dateWindow || 'all'}
                onChange={(e) => updateField('dateWindow', e.target.value)}
                className={`w-full px-2 py-1.5 rounded-lg border text-xs outline-none transition truncate cursor-pointer ${
                  searchCriteria.dateWindow && searchCriteria.dateWindow !== 'all'
                    ? 'bg-rose-50 text-rose-900 border-rose-400 font-bold'
                    : 'bg-slate-50 hover:bg-slate-100/70 text-slate-700 border-slate-200 font-medium'
                }`}
              >
                <option value="all">ทั้งหมด ({pendingStats.all})</option>
                <option value="overdue">⚠️ เกินกำหนด ({pendingStats.overdue})</option>
                <option value="7days">⏳ ภายใน 7 วัน ({pendingStats.dueSoon})</option>
                <option value="qc-ready">✅ ผ่าน QC พร้อมส่ง ({pendingStats.qcReady})</option>
              </select>
            </div>

            {/* 5. สถานะ Overview (Dropdown) */}
            <div className="space-y-1 min-w-0">
              <label className="text-[10px] font-bold text-slate-600 flex items-center gap-1 truncate">
                <TrendingUp className="w-3 h-3 text-blue-600 shrink-0" />
                <span className="truncate">สถานะ Overview</span>
              </label>
              <select
                value={searchCriteria.overviewStatus || 'all'}
                onChange={(e) => updateField('overviewStatus', e.target.value)}
                className={`w-full px-2 py-1.5 rounded-lg border text-xs outline-none transition truncate cursor-pointer ${
                  searchCriteria.overviewStatus && searchCriteria.overviewStatus !== 'all'
                    ? 'bg-blue-50 text-blue-900 border-blue-400 font-bold'
                    : 'bg-slate-50 hover:bg-slate-100/70 text-slate-700 border-slate-200 font-medium'
                }`}
              >
                <option value="all">ทุกสถานะ ({overviewCounts.all})</option>
                <option value="Active">⚡ Active ({overviewCounts.Active})</option>
                <option value="Planned">📅 Planned ({overviewCounts.Planned})</option>
                <option value="Ready to Start">🕒 Ready to Start ({overviewCounts['Ready to Start']})</option>
                <option value="Completed">✓ เสร็จแล้ว ({overviewCounts.Completed}/{overviewCounts.all} - {pendingStats.pdPercentText})</option>
                <option value="none">ไม่มีสถานะ ({overviewCounts.none})</option>
              </select>
            </div>

            {/* 6. สถานะ QC (Dropdown) */}
            <div className="space-y-1 min-w-0">
              <label className="text-[10px] font-bold text-slate-600 flex items-center gap-1 truncate">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                <span className="truncate">สถานะ QC</span>
              </label>
              <select
                value={searchCriteria.qcStatus || 'all'}
                onChange={(e) => updateField('qcStatus', e.target.value)}
                className={`w-full px-2 py-1.5 rounded-lg border text-xs outline-none transition truncate cursor-pointer ${
                  searchCriteria.qcStatus && searchCriteria.qcStatus !== 'all'
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-400 font-bold'
                    : 'bg-slate-50 hover:bg-slate-100/70 text-slate-700 border-slate-200 font-medium'
                }`}
              >
                <option value="all">ทั้งหมด</option>
                <option value="prd">คลัง PRD</option>
                <option value="semi">คลัง SEMI</option>
                <option value="not_in_warehouse">ยังไม่ส่งเข้าคลัง</option>
                <option value="passed">✓ ผ่าน QC (คลัง PRD / SEMI)</option>
                <option value="pending">ยังไม่ส่งเข้าคลัง / ยังไม่ตรวจ</option>
              </select>
            </div>

            {/* 7. ชื่อโครงการ (Dropdown) */}
            <div className="space-y-1 min-w-0">
              <label className="text-[10px] font-bold text-slate-600 flex items-center gap-1 truncate">
                <Building2 className="w-3 h-3 text-blue-600 shrink-0" />
                <span className="truncate">ชื่อโครงการ</span>
              </label>
              <select
                value={searchCriteria.projectName || ''}
                onChange={(e) => updateField('projectName', e.target.value)}
                className={`w-full px-2 py-1.5 rounded-lg border text-xs outline-none transition truncate cursor-pointer ${
                  searchCriteria.projectName
                    ? 'bg-blue-50 text-blue-900 border-blue-400 font-bold'
                    : 'bg-slate-50 hover:bg-slate-100/70 text-slate-700 border-slate-200 font-medium'
                }`}
              >
                <option value="">ทุกโครงการ ({projectNames.length})</option>
                {projectNames.map((n, i) => (
                  <option key={i} value={n}>{n}</option>
                ))}
              </select>
            </div>

            {/* 8. เลขที่โครงการ (Key ค้นหาได้ + เลือกจาก Dropdown ได้) */}
            <div className="space-y-1 min-w-0">
              <label className="text-[10px] font-bold text-slate-600 flex items-center gap-1 truncate">
                <Hash className="w-3 h-3 text-indigo-600 shrink-0" />
                <span className="truncate">เลขที่โครงการ</span>
              </label>
              <SearchableCombobox
                value={searchCriteria.projectCode || ''}
                onChange={(val) => updateField('projectCode', val)}
                options={projectCodes}
                placeholder={`ทุกรหัส (${projectCodes.length})`}
                allLabel="ทุกรหัส"
                activeColorClass="bg-indigo-50 text-indigo-900 border-indigo-400 font-bold"
                fontMono={true}
              />
            </div>

            {/* 9. ประเภท (Dropdown) */}
            <div className="space-y-1 min-w-0">
              <label className="text-[10px] font-bold text-slate-600 flex items-center gap-1 truncate">
                <Tag className="w-3 h-3 text-emerald-600 shrink-0" />
                <span className="truncate">ประเภท</span>
              </label>
              <select
                value={searchCriteria.docType || ''}
                onChange={(e) => updateField('docType', e.target.value)}
                className={`w-full px-2 py-1.5 rounded-lg border text-xs outline-none transition truncate cursor-pointer ${
                  searchCriteria.docType
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-400 font-bold'
                    : 'bg-slate-50 hover:bg-slate-100/70 text-slate-700 border-slate-200 font-medium'
                }`}
              >
                <option value="">ทุกประเภท ({docTypes.length})</option>
                {docTypes.map((t, i) => (
                  <option key={i} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* 10. สาเหตุสั่งผลิต (Dropdown) */}
            <div className="space-y-1 min-w-0">
              <label className="text-[10px] font-bold text-slate-600 flex items-center gap-1 truncate">
                <SlidersHorizontal className="w-3 h-3 text-teal-600 shrink-0" />
                <span className="truncate">สาเหตุสั่งผลิต</span>
              </label>
              <select
                value={searchCriteria.actionTopic || ''}
                onChange={(e) => updateField('actionTopic', e.target.value)}
                className={`w-full px-2 py-1.5 rounded-lg border text-xs outline-none transition truncate cursor-pointer ${
                  searchCriteria.actionTopic
                    ? 'bg-teal-50 text-teal-900 border-teal-400 font-bold'
                    : 'bg-slate-50 hover:bg-slate-100/70 text-slate-700 border-slate-200 font-medium'
                }`}
              >
                <option value="">ทุกสาเหตุ ({actionTopics.length})</option>
                {actionTopics.map((t, i) => (
                  <option key={i} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
