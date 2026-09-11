import React, { useMemo } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { SearchCriteria, DeliveryItem } from '../types';

interface SearchFilterBarProps {
  searchCriteria: SearchCriteria;
  setSearchCriteria: React.Dispatch<React.SetStateAction<SearchCriteria>>;
  items: DeliveryItem[];
  matchedMachinesCount: number;
  matchedItemsCount: number;
}

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  searchCriteria,
  setSearchCriteria,
  items,
  matchedMachinesCount,
  matchedItemsCount,
}) => {
  // Extract distinct lists for datalists / suggestions
  const { docRefs, projectCodes, projectNames, docTypes, machineNames, requestDepts, actionTopics } = useMemo(() => {
    const refs = new Set<string>();
    const codes = new Set<string>();
    const names = new Set<string>();
    const types = new Set<string>();
    const machines = new Set<string>();
    const depts = new Set<string>();
    const topics = new Set<string>();

    items.forEach(i => {
      if (i.docRef) refs.add(i.docRef.trim());
      if (i.projectCode) codes.add(i.projectCode.trim());
      if (i.projectName) names.add(i.projectName.trim());
      if (i.docType) types.add(i.docType.trim());
      if (i.machineName && i.machineName !== '(ไม่ระบุเครื่องจักร)') machines.add(i.machineName.trim());
      if (i.requestDept) depts.add(i.requestDept.trim());
      if (i.actionTopic) topics.add(i.actionTopic.trim());
    });

    return {
      docRefs: Array.from(refs).sort(),
      projectCodes: Array.from(codes).sort(),
      projectNames: Array.from(names).sort(),
      docTypes: Array.from(types).sort(),
      machineNames: Array.from(machines).sort(),
      requestDepts: Array.from(depts).sort(),
      actionTopics: Array.from(topics).sort(),
    };
  }, [items]);

  const hasAnyFilter = Boolean(
    searchCriteria.docRef ||
    searchCriteria.projectCode ||
    searchCriteria.projectName ||
    searchCriteria.docType ||
    searchCriteria.machineName ||
    searchCriteria.requestDept ||
    searchCriteria.actionTopic ||
    (searchCriteria.qcStatus && searchCriteria.qcStatus !== 'all')
  );

  const handleReset = () => {
    setSearchCriteria({
      docRef: '',
      projectCode: '',
      projectName: '',
      docType: '',
      machineName: '',
      requestDept: '',
      actionTopic: '',
      qcStatus: 'all',
    });
  };

  const updateField = (field: keyof SearchCriteria, value: string) => {
    setSearchCriteria(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden space-y-0">
      {/* Header Banner */}
      <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-sky-100 text-sky-700">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                ค้นหาแยกตามฟิลด์ข้อมูล (Field-Specific Search)
              </h3>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                เชื่อมโยงฝ่ายผลิต (Production Linked)
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              ระบุเงื่อนไขค้นหาตาม 5 ฟิลด์หลัก หรือกรองตามหน่วยงานที่แจ้งและสาเหตุการสั่งผลิต
            </p>
          </div>
        </div>

        {/* Results indicator & Reset */}
        <div className="flex items-center gap-2">
          {hasAnyFilter && (
            <div className="text-xs px-2.5 py-1 rounded-full bg-sky-50 text-sky-800 border border-sky-200 font-medium flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-sky-600" />
              <span>ผลลัพธ์: {matchedMachinesCount} เครื่องจักร ({matchedItemsCount} รายการ)</span>
            </div>
          )}

          {hasAnyFilter && (
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>ล้างการค้นหา</span>
            </button>
          )}
        </div>
      </div>

      {/* 5 Primary Search Inputs */}
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

      {/* Linked Production & QC Data Quick Filters */}
      <div className="px-5 py-2.5 bg-slate-50/70 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs">
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
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                !searchCriteria.qcStatus || searchCriteria.qcStatus === 'all'
                  ? 'bg-slate-800 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ทั้งหมด
            </button>
            <button
              onClick={() => updateField('qcStatus', 'passed')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition ${
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
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                searchCriteria.qcStatus === 'pending'
                  ? 'bg-slate-600 text-white shadow-2xs'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              ยังไม่เข้า QC
            </button>
          </div>
        </div>

        {(searchCriteria.requestDept || searchCriteria.actionTopic || (searchCriteria.qcStatus && searchCriteria.qcStatus !== 'all')) && (
          <button
            onClick={() => {
              updateField('requestDept', '');
              updateField('actionTopic', '');
              updateField('qcStatus', 'all');
            }}
            className="text-[11px] text-rose-600 hover:text-rose-800 underline font-medium ml-auto"
          >
            ล้างตัวกรองเสริม
          </button>
        )}
      </div>

    </div>
  );
};
