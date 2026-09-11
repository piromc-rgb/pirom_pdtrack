import React, { useState, useMemo } from 'react';
import { 
  GitCompare, 
  X, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Layers, 
  Filter, 
  Download, 
  Copy, 
  Check, 
  Sparkles,
  ShieldCheck,
  Building2,
  Cpu,
  Boxes,
  FileText,
  HelpCircle,
  ArrowRight,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { DeliveryItem, OverviewMeta } from '../types';
import { overviewStatusMap, qcStatusMap, extractPdNumbers } from '../services/sheetService';
import { formatCompactDate } from '../utils/dateUtils';

export type ComparisonSource = 'overview' | 'qc' | 'dual';
export type ComparatorTab = 'system-items' | 'direct-input';

interface ProductionOrderComparatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: DeliveryItem[];
}

interface BatchResultRow {
  pdNo: string;
  inSystem: boolean;
  systemItem?: DeliveryItem;
  overviewStatus: string;
  overviewProject: string;
  overviewCustomer: string;
  overviewItemCode: string;
  overviewDescription: string;
  qcPassed: boolean;
  qcDate: string;
  qcInspector: string;
  qcTopic: string;
  qcRemarks: string;
}

export const ProductionOrderComparatorModal: React.FC<ProductionOrderComparatorModalProps> = ({
  isOpen,
  onClose,
  items,
}) => {
  // Source selection: 'overview' | 'qc' | 'dual'
  const [source, setSource] = useState<ComparisonSource>('overview');
  
  // Tab selection: 'system-items' | 'direct-input'
  const [activeTab, setActiveTab] = useState<ComparatorTab>('system-items');

  // Filters for system items tab
  const [systemSearch, setSystemSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'pending' | 'delivered'>('pending');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Batch / Direct search state
  const [batchInput, setBatchInput] = useState('');
  const [batchResults, setBatchResults] = useState<BatchResultRow[]>([]);
  const [copiedBatch, setCopiedBatch] = useState(false);

  // 1. Filtered System Items
  const filteredSystemItems = useMemo(() => {
    return items.filter(item => {
      // Scope filter
      if (scopeFilter === 'pending' && item.status === 'ส่งแล้ว') return false;
      if (scopeFilter === 'delivered' && item.status !== 'ส่งแล้ว') return false;

      // Text search
      if (systemSearch) {
        const term = systemSearch.toLowerCase().trim();
        const matchCode = item.itemCode?.toLowerCase().includes(term);
        const matchName = item.itemName?.toLowerCase().includes(term);
        const matchPD = item.prodOrder?.toLowerCase().includes(term);
        const matchMach = item.machineName?.toLowerCase().includes(term);
        const matchCust = item.customer?.toLowerCase().includes(term) || item.projectName?.toLowerCase().includes(term);
        if (!matchCode && !matchName && !matchPD && !matchMach && !matchCust) return false;
      }

      // Status chip filter
      if (statusFilter !== 'all') {
        if (source === 'overview') {
          if (['Completed', 'Active', 'Ready to Start', 'Planned'].includes(statusFilter)) {
            if (item.overviewStatus !== statusFilter) return false;
          } else if (statusFilter === 'ไม่พบข้อมูล') {
            if (item.overviewStatus || !item.prodOrder) return false;
          } else if (statusFilter === 'ไม่มีเลข PD') {
            if (item.overviewStatus || item.prodOrder) return false;
          }
        } else if (source === 'qc') {
          if (statusFilter === 'qc-passed' && !item.isQcPassed) return false;
          if (statusFilter === 'qc-pending' && (item.isQcPassed || !item.prodOrder)) return false;
          if (statusFilter === 'no-pd' && item.prodOrder) return false;
        } else if (source === 'dual') {
          if (statusFilter === 'both-done' && (!item.isQcPassed || item.overviewStatus !== 'Completed')) return false;
          if (statusFilter === 'prod-done-qc-pending' && (item.overviewStatus !== 'Completed' || item.isQcPassed)) return false;
          if (statusFilter === 'in-production' && (!['Active', 'Planned', 'Ready to Start'].includes(item.overviewStatus || ''))) return false;
          if (statusFilter === 'no-pd' && item.prodOrder) return false;
        }
      }

      return true;
    });
  }, [items, scopeFilter, systemSearch, statusFilter, source]);

  // Statistics for System Items
  const stats = useMemo(() => {
    const scopeItems = items.filter(it => {
      if (scopeFilter === 'pending') return it.status !== 'ส่งแล้ว';
      if (scopeFilter === 'delivered') return it.status === 'ส่งแล้ว';
      return true;
    });

    const total = scopeItems.length;
    let withPdCount = 0;
    
    // Overview status counts
    let ovCompleted = 0;
    let ovActive = 0;
    let ovPlanned = 0;
    let ovReady = 0;
    let ovNotFound = 0;
    let ovNoPd = 0;

    // QC status counts
    let qcPassed = 0;
    let qcPending = 0;
    let qcNoPd = 0;

    // Dual status counts
    let bothDone = 0;
    let prodDoneQcPending = 0;
    let inProd = 0;

    scopeItems.forEach(it => {
      const pds = extractPdNumbers(it.prodOrder);
      const hasPd = pds.length > 0;
      if (hasPd) withPdCount++;

      // Overview status counts (อิงตามเลขที่ item หรือ PD)
      const st = it.overviewStatus;
      if (st === 'Completed') ovCompleted++;
      else if (st === 'Active') ovActive++;
      else if (st === 'Planned') ovPlanned++;
      else if (st === 'Ready to Start') ovReady++;
      else if (hasPd) ovNotFound++;
      else ovNoPd++;

      // QC status counts
      if (it.isQcPassed) qcPassed++;
      else if (hasPd) qcPending++;
      else qcNoPd++;

      // Dual status counts
      if (st === 'Completed' && it.isQcPassed) bothDone++;
      else if (st === 'Completed' && !it.isQcPassed) prodDoneQcPending++;
      else if (['Active', 'Planned', 'Ready to Start'].includes(st || '')) inProd++;
    });

    return {
      total,
      withPdCount,
      ovCompleted,
      ovActive,
      ovPlanned,
      ovReady,
      ovNotFound,
      ovNoPd,
      qcPassed,
      qcPending,
      qcNoPd,
      bothDone,
      prodDoneQcPending,
      inProd,
    };
  }, [items, scopeFilter]);

  // 2. Direct / Batch PD Execution
  const handleRunBatchCheck = (customInput?: string) => {
    const textToProcess = customInput !== undefined ? customInput : batchInput;
    if (!textToProcess.trim()) {
      setBatchResults([]);
      return;
    }

    // Extract all PD patterns
    const foundPds = textToProcess.match(/PD\d+/gi) || [];
    const uniquePds = Array.from(new Set(foundPds.map(p => p.toUpperCase())));

    // Create lookup map of system items by PD
    const systemPdMap = new Map<string, DeliveryItem>();
    items.forEach(it => {
      const pds = extractPdNumbers(it.prodOrder);
      pds.forEach(p => {
        if (!systemPdMap.has(p)) systemPdMap.set(p, it);
      });
    });

    const rows: BatchResultRow[] = uniquePds.map(pd => {
      const sysItem = systemPdMap.get(pd);
      const ov = overviewStatusMap[pd];
      const qc = qcStatusMap[pd];

      return {
        pdNo: pd,
        inSystem: Boolean(sysItem),
        systemItem: sysItem,
        overviewStatus: ov?.status || (sysItem?.overviewStatus || 'ไม่พบใน Overview'),
        overviewProject: ov?.project || (sysItem?.projectCode || '-'),
        overviewCustomer: ov?.customer || (sysItem?.customer || '-'),
        overviewItemCode: ov?.itemCode || (sysItem?.itemCode || '-'),
        overviewDescription: ov?.description || (sysItem?.itemName || '-'),
        qcPassed: Boolean(qc) || Boolean(sysItem?.isQcPassed),
        qcDate: qc?.qcDate || (sysItem?.qcDate || '-'),
        qcInspector: qc?.inspector || (sysItem?.qcInspector || '-'),
        qcTopic: qc?.topic || (sysItem?.qcTopic || '-'),
        qcRemarks: qc?.remarks || (sysItem?.qcRemarks || '-'),
      };
    });

    setBatchResults(rows);
  };

  // Quick sample loader
  const handleLoadSamplePds = () => {
    const sample = 'PD2603206\nPD2607609\nPD2600941\nPD2604595\nPD2603619\nPD2601357\nPD2408169\nPD2506305';
    setBatchInput(sample);
    handleRunBatchCheck(sample);
  };

  // Load all system PDs into batch input
  const handleLoadSystemPds = () => {
    const pds = items
      .flatMap(it => extractPdNumbers(it.prodOrder))
      .filter((p, i, arr) => arr.indexOf(p) === i);
    const text = pds.join('\n');
    setBatchInput(text);
    handleRunBatchCheck(text);
  };

  // Copy batch results to TSV
  const handleCopyBatchResults = () => {
    if (batchResults.length === 0) return;
    const headers = [
      'เลขที่ PD',
      'มีในระบบ PDTrack',
      'สถานะ Overview',
      'สถานะ QC',
      'วันที่ตรวจ QC',
      'ผู้ตรวจ QC',
      'เลขที่ Item',
      'รายละเอียดชิ้นงาน',
      'โครงการ / ลูกค้า'
    ];
    const rows = batchResults.map(r => [
      r.pdNo,
      r.inSystem ? 'ใช่' : 'ไม่พบในระบบหลัก',
      r.overviewStatus,
      r.qcPassed ? 'ผ่าน QC แล้ว' : 'ยังไม่เข้า QC',
      r.qcDate,
      r.qcInspector,
      r.overviewItemCode,
      r.overviewDescription,
      `${r.overviewProject} / ${r.overviewCustomer}`
    ].join('\t'));

    const tsv = [headers.join('\t'), ...rows].join('\n');
    navigator.clipboard.writeText(tsv).then(() => {
      setCopiedBatch(true);
      setTimeout(() => setCopiedBatch(false), 2000);
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* ======================================================== */}
        {/* MODAL HEADER                                             */}
        {/* ======================================================== */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between gap-4 flex-shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/30 border border-blue-400/40 text-blue-300">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
                <span>ตัวเทียบสถานะ Production Order (PD)</span>
                <span className="text-[11px] font-medium bg-blue-500/20 text-blue-200 border border-blue-400/30 px-2 py-0.5 rounded-full">
                  Status Comparator
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                เลือกแหล่งข้อมูลเพื่อเปรียบเทียบและตรวจสอบสถานะ Production Order ระหว่าง Overview status (ฝ่ายผลิต) และ QC Record (ตรวจรับคุณภาพ)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ======================================================== */}
        {/* SOURCE SELECTOR BAR (แถบเลือกแหล่งข้อมูลเปรียบเทียบ)      */}
        {/* ======================================================== */}
        <div className="bg-slate-100 border-b border-slate-200 px-5 py-3 flex items-center justify-between gap-4 flex-wrap flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>เลือกแหล่งข้อมูลเปรียบเทียบ:</span>
            </span>
            
            {/* 3 Source Options */}
            <div className="inline-flex rounded-xl bg-white p-1 border border-slate-300 shadow-2xs">
              <button
                onClick={() => { setSource('overview'); setStatusFilter('all'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  source === 'overview'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>📊 Overview status (ฝ่ายผลิต)</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  source === 'overview' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  9,788 PDs
                </span>
              </button>

              <button
                onClick={() => { setSource('qc'); setStatusFilter('all'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  source === 'qc'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>🛡️ QC Record (ตรวจรับคุณภาพ)</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  source === 'qc' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  1,939 PDs
                </span>
              </button>

              <button
                onClick={() => { setSource('dual'); setStatusFilter('all'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  source === 'dual'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>⚡ เทียบ 2 แหล่งพร้อมกัน (Dual)</span>
              </button>
            </div>
          </div>

          {/* Mode Tabs (System items vs Batch Input) */}
          <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('system-items')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'system-items'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>รายการในระบบ ({items.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('direct-input')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'direct-input'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>ป้อนเลข PD ตรวจสอบโดยตรง</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: SYSTEM ITEMS COMPARISON VIEW                      */}
        {/* ======================================================== */}
        {activeTab === 'system-items' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* KPI Summary & Quick Filter Chips */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3 flex-shrink-0">
              
              {/* Top Controls: Search + Scope */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[240px] max-w-md">
                  <input
                    type="text"
                    value={systemSearch}
                    onChange={e => setSystemSearch(e.target.value)}
                    placeholder="ค้นหาเลข PD, เลขที่ Item, ชื่อชิ้นงาน, เครื่องจักร..."
                    className="w-full py-1.5 pl-8 pr-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-semibold">ขอบเขตงาน:</span>
                  <select
                    value={scopeFilter}
                    onChange={e => setScopeFilter(e.target.value as any)}
                    className="py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="pending">เฉพาะงานยังไม่ส่ง ({items.filter(i => i.status !== 'ส่งแล้ว').length} รายการ)</option>
                    <option value="all">รายการทั้งหมด ({items.length} รายการ)</option>
                    <option value="delivered">เฉพาะงานที่ส่งแล้ว ({items.filter(i => i.status === 'ส่งแล้ว').length} รายการ)</option>
                  </select>
                </div>
              </div>

              {/* Status Breakdown Chips Based on Selected Source */}
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <span className="text-slate-500 font-semibold mr-1">กรองสถานะ:</span>
                
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  ทั้งหมด ({stats.total})
                </button>

                {source === 'overview' && (
                  <>
                    <button
                      onClick={() => setStatusFilter('Completed')}
                      className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer ${
                        statusFilter === 'Completed'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                      }`}
                    >
                      ✓ Completed ({stats.ovCompleted})
                    </button>
                    <button
                      onClick={() => setStatusFilter('Active')}
                      className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer ${
                        statusFilter === 'Active'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100'
                      }`}
                    >
                      ⚙️ Active ({stats.ovActive})
                    </button>
                    <button
                      onClick={() => setStatusFilter('Ready to Start')}
                      className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer ${
                        statusFilter === 'Ready to Start'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                      }`}
                    >
                      ⏳ Ready to Start ({stats.ovReady})
                    </button>
                    <button
                      onClick={() => setStatusFilter('Planned')}
                      className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer ${
                        statusFilter === 'Planned'
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-purple-50 text-purple-800 border-purple-300 hover:bg-purple-100'
                      }`}
                    >
                      📅 Planned ({stats.ovPlanned})
                    </button>
                    {stats.ovNotFound > 0 && (
                      <button
                        onClick={() => setStatusFilter('ไม่พบข้อมูล')}
                        className={`px-2.5 py-1 rounded-lg font-medium border transition cursor-pointer ${
                          statusFilter === 'ไม่พบข้อมูล'
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        ไม่พบใน Overview ({stats.ovNotFound})
                      </button>
                    )}
                    <button
                      onClick={() => setStatusFilter('ไม่มีเลข PD')}
                      className={`px-2.5 py-1 rounded-lg font-medium border transition cursor-pointer ${
                        statusFilter === 'ไม่มีเลข PD'
                          ? 'bg-slate-600 text-white border-slate-600'
                          : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      ไม่มีเลข PD / อะไหล่ซื้อ ({stats.ovNoPd})
                    </button>
                  </>
                )}

                {source === 'qc' && (
                  <>
                    <button
                      onClick={() => setStatusFilter('qc-passed')}
                      className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer ${
                        statusFilter === 'qc-passed'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3 inline mr-1 text-emerald-600" />
                      ผ่าน QC แล้ว ({stats.qcPassed})
                    </button>
                    <button
                      onClick={() => setStatusFilter('qc-pending')}
                      className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer ${
                        statusFilter === 'qc-pending'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                      }`}
                    >
                      <Clock className="w-3 h-3 inline mr-1 text-amber-600" />
                      ยังไม่เข้า QC ({stats.qcPending})
                    </button>
                    <button
                      onClick={() => setStatusFilter('no-pd')}
                      className={`px-2.5 py-1 rounded-lg font-medium border transition cursor-pointer ${
                        statusFilter === 'no-pd'
                          ? 'bg-slate-600 text-white border-slate-600'
                          : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      ไม่มีเลข PD ({stats.qcNoPd})
                    </button>
                  </>
                )}

                {source === 'dual' && (
                  <>
                    <button
                      onClick={() => setStatusFilter('both-done')}
                      className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer ${
                        statusFilter === 'both-done'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                      }`}
                    >
                      🌟 ผลิตเสร็จ + ผ่าน QC แล้ว ({stats.bothDone})
                    </button>
                    <button
                      onClick={() => setStatusFilter('prod-done-qc-pending')}
                      className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer ${
                        statusFilter === 'prod-done-qc-pending'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                      }`}
                    >
                      ⚡ ผลิตเสร็จแล้ว แต่ยังไม่เข้า QC ({stats.prodDoneQcPending})
                    </button>
                    <button
                      onClick={() => setStatusFilter('in-production')}
                      className={`px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer ${
                        statusFilter === 'in-production'
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100'
                      }`}
                    >
                      ⚙️ อยู่ระหว่างผลิต (Active/Ready) ({stats.inProd})
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* System Items Comparison Table */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 sticky top-0 z-10 shadow-2xs">
                    <tr>
                      <th className="py-2.5 px-2 text-center w-10 border-r border-slate-200">#</th>
                      <th className="py-2.5 px-2.5 w-[110px] font-mono border-r border-slate-200">เลขที่ Item</th>
                      <th className="py-2.5 px-3 min-w-[200px] border-r border-slate-200">ชื่อ Item / โครงการ</th>
                      <th className="py-2.5 px-2 text-center w-14 border-r border-slate-200">จำนวน</th>
                      <th className="py-2.5 px-2.5 w-32 font-mono border-r border-slate-200">Production Order</th>
                      
                      {/* Dynamic Columns based on Source */}
                      {source === 'overview' && (
                        <>
                          <th className="py-2.5 px-3 w-36 text-center border-r border-slate-200">สถานะ Overview</th>
                          <th className="py-2.5 px-3 min-w-[150px]">ข้อมูลจากไฟล์ Overview</th>
                        </>
                      )}

                      {source === 'qc' && (
                        <>
                          <th className="py-2.5 px-3 w-36 text-center border-r border-slate-200">สถานะ QC Record</th>
                          <th className="py-2.5 px-3 min-w-[180px]">รายละเอียดการตรวจ QC</th>
                        </>
                      )}

                      {source === 'dual' && (
                        <>
                          <th className="py-2.5 px-3 w-36 text-center border-r border-slate-200 bg-blue-50/70 text-blue-900">
                            1. สถานะ Overview (ฝ่ายผลิต)
                          </th>
                          <th className="py-2.5 px-3 w-40 text-center border-r border-slate-200 bg-emerald-50/70 text-emerald-900">
                            2. สถานะ QC Record
                          </th>
                          <th className="py-2.5 px-3 min-w-[150px]">สรุปผลเทียบ 2 แหล่ง</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {filteredSystemItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <Boxes className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                          <p className="font-semibold text-slate-600">ไม่พบรายการตามเงื่อนไขตัวกรอง</p>
                          <p className="text-xs text-slate-400 mt-0.5">ลองค้นหาด้วยคำอื่นหรือกด "ทั้งหมด"</p>
                        </td>
                      </tr>
                    ) : (
                      filteredSystemItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition">
                          {/* # */}
                          <td className="py-2.5 px-2 text-center text-slate-400 font-mono border-r border-slate-200 text-[11px]">
                            {idx + 1}
                          </td>

                          {/* Item Code */}
                          <td className="py-2.5 px-2.5 font-mono text-slate-900 font-semibold border-r border-slate-200 whitespace-nowrap text-[11px]">
                            {item.itemCode || '-'}
                          </td>

                          {/* Description + Project + Machine */}
                          <td className="py-2.5 px-3 border-r border-slate-200">
                            <div className="font-semibold text-slate-900 line-clamp-1" title={item.itemName}>
                              {item.itemName}
                            </div>
                            <div className="text-[10.5px] text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-slate-700 font-medium">{item.customer}</span>
                              <span className="text-slate-300">•</span>
                              <span className="font-mono text-slate-600">{item.projectCode}</span>
                              {item.machineName && item.machineName !== '(ไม่ระบุเครื่องจักร)' && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span className="font-mono text-sky-800 font-bold">{item.machineName}</span>
                                </>
                              )}
                            </div>
                          </td>

                          {/* Qty */}
                          <td className="py-2.5 px-2 text-center font-bold text-slate-900 border-r border-slate-200">
                            {item.qty}
                          </td>

                          {/* Production Order */}
                          <td className="py-2.5 px-2.5 font-mono border-r border-slate-200 text-[11px]">
                            {item.prodOrder ? (
                              <span className="font-bold text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                {item.prodOrder}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">ไม่มีเลข PD</span>
                            )}
                          </td>

                          {/* 1. SOURCE = OVERVIEW */}
                          {source === 'overview' && (
                            <>
                              <td className="py-2.5 px-3 text-center border-r border-slate-200">
                                {item.overviewStatus === 'Completed' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10.5px]">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    Completed
                                  </span>
                                )}
                                {item.overviewStatus === 'Active' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold bg-blue-100 text-blue-800 border border-blue-300 text-[10.5px]">
                                    <TrendingUp className="w-3 h-3 text-blue-600" />
                                    Active
                                  </span>
                                )}
                                {item.overviewStatus === 'Ready to Start' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold bg-amber-100 text-amber-800 border border-amber-300 text-[10.5px]">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    Ready to Start
                                  </span>
                                )}
                                {item.overviewStatus === 'Planned' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold bg-purple-100 text-purple-800 border border-purple-300 text-[10.5px]">
                                    📅 Planned
                                  </span>
                                )}
                                {!item.overviewStatus && item.prodOrder && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium bg-slate-100 text-slate-500 border border-slate-200 text-[10.5px]">
                                    ไม่พบข้อมูล
                                  </span>
                                )}
                                {!item.overviewStatus && !item.prodOrder && (
                                  <span className="text-slate-400 italic text-[10px]">
                                    (อะไหล่สั่งซื้อ)
                                  </span>
                                )}
                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                  {item.targetLatest ? formatCompactDate(item.targetLatest) : item.notifyDate ? formatCompactDate(item.notifyDate) : '-'}
                                </div>
                              </td>

                              <td className="py-2.5 px-3 text-[11px] text-slate-600">
                                {item.overviewProject || item.overviewCustomer ? (
                                  <div>
                                    <span className="font-semibold text-slate-800">{item.overviewProject}</span>
                                    {item.overviewCustomer && (
                                      <span className="text-slate-500"> ({item.overviewCustomer})</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                            </>
                          )}

                          {/* 2. SOURCE = QC */}
                          {source === 'qc' && (
                            <>
                              <td className="py-2.5 px-3 text-center border-r border-slate-200">
                                {item.isQcPassed ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10.5px]">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    ผ่าน QC แล้ว
                                  </span>
                                ) : item.prodOrder ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium bg-slate-100 text-slate-600 border border-slate-200 text-[10.5px]">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    ยังไม่เข้า QC
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic text-[10px]">
                                    ไม่มีเลข PD
                                  </span>
                                )}
                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                  {item.isQcPassed && item.qcDate ? formatCompactDate(item.qcDate) : '-'}
                                </div>
                              </td>

                              <td className="py-2.5 px-3 text-[11px]">
                                {item.isQcPassed ? (
                                  <div className="space-y-0.5">
                                    <div className="font-semibold text-emerald-800 flex items-center gap-1.5">
                                      <span>วันที่: {item.qcDate || '-'}</span>
                                      {item.qcInspector && <span>(ผู้ตรวจ: {item.qcInspector})</span>}
                                    </div>
                                    {item.qcTopic && (
                                      <div className="text-slate-600 text-[10px]">{item.qcTopic}</div>
                                    )}
                                    {item.qcRemarks && (
                                      <div className="text-slate-500 italic text-[10px]">หมายเหตุ: {item.qcRemarks}</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic">ยังไม่มีบันทึกการตรวจในสเปรดชีต QC</span>
                                )}
                              </td>
                            </>
                          )}

                          {/* 3. SOURCE = DUAL */}
                          {source === 'dual' && (
                            <>
                              {/* Overview status column */}
                              <td className="py-2.5 px-3 text-center border-r border-slate-200 bg-blue-50/20">
                                {item.overviewStatus === 'Completed' ? (
                                  <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10.5px] inline-block">
                                    ✓ Completed
                                  </span>
                                ) : item.overviewStatus ? (
                                  <span className="font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[10.5px] inline-block">
                                    {item.overviewStatus}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[10.5px]">-</span>
                                )}
                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                  {item.targetLatest ? formatCompactDate(item.targetLatest) : item.notifyDate ? formatCompactDate(item.notifyDate) : '-'}
                                </div>
                              </td>

                              {/* QC status column */}
                              <td className="py-2.5 px-3 text-center border-r border-slate-200 bg-emerald-50/20">
                                {item.isQcPassed ? (
                                  <span className="font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded text-[10.5px] inline-flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    ผ่าน QC แล้ว
                                  </span>
                                ) : (
                                  <span className="text-slate-500 text-[10.5px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-block">
                                    ยังไม่เข้า QC
                                  </span>
                                )}
                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                  {item.isQcPassed && item.qcDate ? formatCompactDate(item.qcDate) : '-'}
                                </div>
                              </td>

                              {/* Comparison insight */}
                              <td className="py-2.5 px-3 text-[11px]">
                                {item.overviewStatus === 'Completed' && item.isQcPassed && (
                                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    พร้อมส่งมอบสมบูรณ์ (ผลิตเสร็จ + QC ผ่าน)
                                  </span>
                                )}
                                {item.overviewStatus === 'Completed' && !item.isQcPassed && (
                                  <span className="text-amber-800 font-medium">
                                    ⚡ ฝ่ายผลิตเสร็จแล้ว แต่รอคิวตรวจ QC
                                  </span>
                                )}
                                {item.overviewStatus && item.overviewStatus !== 'Completed' && (
                                  <span className="text-blue-700">
                                    ⚙️ อยู่ระหว่างผลิตในโรงงาน ({item.overviewStatus})
                                  </span>
                                )}
                                {!item.overviewStatus && (
                                  <span className="text-slate-400 italic">ไม่มีข้อมูล Overview</span>
                                )}
                              </td>
                            </>
                          )}

                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Summary Bar */}
            <div className="bg-slate-100 border-t border-slate-200 px-5 py-2.5 flex items-center justify-between text-xs text-slate-600 flex-shrink-0">
              <div className="flex items-center gap-4 flex-wrap">
                <span>แสดงผล: <strong>{filteredSystemItems.length}</strong> จาก <strong>{stats.total}</strong> รายการ</span>
                <span>• มีเลขที่ PD: <strong className="text-blue-900">{stats.withPdCount}</strong> รายการ</span>
                {source === 'overview' && (
                  <span>• สถานะ Completed: <strong className="text-emerald-700">{stats.ovCompleted}</strong> รายการ</span>
                )}
                {source === 'qc' && (
                  <span>• ผ่านการตรวจ QC: <strong className="text-emerald-700">{stats.qcPassed}</strong> รายการ</span>
                )}
              </div>
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: DIRECT SEARCH & BATCH INPUT                       */}
        {/* ======================================================== */}
        {activeTab === 'direct-input' && (
          <div className="flex-1 flex flex-col overflow-hidden p-5 space-y-4">
            
            {/* Input Box & Action Controls */}
            <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 space-y-3 flex-shrink-0 shadow-2xs">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>วางเลขที่ Production Order ที่ต้องการเทียบ (แยกด้วยขึ้นบรรทัดใหม่, ช่องว่าง หรือจุลภาค):</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleLoadSamplePds}
                    className="text-xs text-blue-700 hover:text-blue-900 hover:underline font-semibold cursor-pointer"
                  >
                    + ใส่ตัวอย่าง 8 รายการ
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={handleLoadSystemPds}
                    className="text-xs text-purple-700 hover:text-purple-900 hover:underline font-semibold cursor-pointer"
                  >
                    + ดึง PD ทั้งหมดจากระบบ ({items.filter(i => i.prodOrder).length} รายการ)
                  </button>
                </div>
              </div>

              <textarea
                value={batchInput}
                onChange={e => setBatchInput(e.target.value)}
                placeholder="ตัวอย่าง:&#10;PD2603206&#10;PD2607609&#10;PD2600941&#10;PD2604595"
                rows={4}
                className="w-full font-mono text-xs p-3 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />

              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  ระบบจะเทียบข้อมูลกับฐานข้อมูลหลัก <strong>9,788 PDs</strong> ใน Overview และ <strong>1,939 PDs</strong> ใน QC Checklist
                </div>

                <div className="flex items-center gap-2">
                  {batchResults.length > 0 && (
                    <button
                      onClick={handleCopyBatchResults}
                      className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-xs font-semibold transition cursor-pointer"
                    >
                      {copiedBatch ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedBatch ? 'คัดลอกเรียบร้อย!' : 'คัดลอกผลลัพธ์'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleRunBatchCheck()}
                    className="flex items-center gap-1.5 py-1.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>ตรวจสอบสถานะ</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Batch Results Table */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 sticky top-0 z-10 shadow-2xs">
                  <tr>
                    <th className="py-2.5 px-2 text-center w-10 border-r border-slate-200">#</th>
                    <th className="py-2.5 px-3 w-32 font-mono border-r border-slate-200">เลขที่ PD</th>
                    <th className="py-2.5 px-2 text-center w-24 border-r border-slate-200">ในระบบหลัก</th>
                    <th className="py-2.5 px-3 w-36 text-center border-r border-slate-200 bg-blue-50/70 text-blue-950">
                      สถานะ Overview
                    </th>
                    <th className="py-2.5 px-3 w-36 text-center border-r border-slate-200 bg-emerald-50/70 text-emerald-950">
                      สถานะ QC Record
                    </th>
                    <th className="py-2.5 px-3 min-w-[180px] border-r border-slate-200">รายละเอียดชิ้นงาน / Item</th>
                    <th className="py-2.5 px-3 min-w-[150px]">โครงการ / ลูกค้า</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {batchResults.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-slate-400">
                        <Search className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-slate-600">ยังไม่มีรายการที่ตรวจสอบ</p>
                        <p className="text-xs text-slate-400 mt-0.5">วางเลขที่ PD ด้านบนแล้วกด "ตรวจสอบสถานะ"</p>
                      </td>
                    </tr>
                  ) : (
                    batchResults.map((r, idx) => (
                      <tr key={r.pdNo} className="hover:bg-slate-50/80 transition">
                        {/* # */}
                        <td className="py-2.5 px-2 text-center text-slate-400 font-mono border-r border-slate-200 text-[11px]">
                          {idx + 1}
                        </td>

                        {/* PD No */}
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-900 border-r border-slate-200 text-[11.5px]">
                          {r.pdNo}
                        </td>

                        {/* In System */}
                        <td className="py-2.5 px-2 text-center border-r border-slate-200">
                          {r.inSystem ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                              มีในระบบ
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">
                              เฉพาะใน Master
                            </span>
                          )}
                        </td>

                        {/* Overview Status */}
                        <td className="py-2.5 px-3 text-center border-r border-slate-200 bg-blue-50/20">
                          {r.overviewStatus === 'Completed' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10.5px]">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Completed
                            </span>
                          )}
                          {r.overviewStatus === 'Active' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold bg-blue-100 text-blue-800 border border-blue-300 text-[10.5px]">
                              <TrendingUp className="w-3 h-3 text-blue-600" />
                              Active
                            </span>
                          )}
                          {r.overviewStatus === 'Ready to Start' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold bg-amber-100 text-amber-800 border border-amber-300 text-[10.5px]">
                              ⏳ Ready to Start
                            </span>
                          )}
                          {r.overviewStatus === 'Planned' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold bg-purple-100 text-purple-800 border border-purple-300 text-[10.5px]">
                              📅 Planned
                            </span>
                          )}
                          {(!r.overviewStatus || r.overviewStatus === 'ไม่พบใน Overview') && (
                            <span className="text-slate-400 text-[10.5px] italic">
                              ไม่พบใน Overview
                            </span>
                          )}
                        </td>

                        {/* QC Status */}
                        <td className="py-2.5 px-3 text-center border-r border-slate-200 bg-emerald-50/20">
                          {r.qcPassed ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10.5px]">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                ผ่าน QC แล้ว
                              </span>
                              {r.qcDate && (
                                <div className="text-[9.5px] text-slate-500 mt-0.5">
                                  {r.qcDate} {r.qcInspector ? `(${r.qcInspector})` : ''}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-500 border border-slate-200 text-[10px]">
                              <Clock className="w-3 h-3 text-slate-400" />
                              ยังไม่เข้า QC
                            </span>
                          )}
                        </td>

                        {/* Description / Item */}
                        <td className="py-2.5 px-3 border-r border-slate-200 text-[11px]">
                          <div className="font-semibold text-slate-900">{r.overviewDescription || '-'}</div>
                          {r.overviewItemCode && r.overviewItemCode !== '-' && (
                            <div className="font-mono text-slate-500 text-[10px] mt-0.5">
                              Item: {r.overviewItemCode}
                            </div>
                          )}
                        </td>

                        {/* Project / Customer */}
                        <td className="py-2.5 px-3 text-[11px] text-slate-700">
                          <div className="font-semibold">{r.overviewProject || '-'}</div>
                          {r.overviewCustomer && r.overviewCustomer !== '-' && (
                            <div className="text-slate-500 text-[10px]">{r.overviewCustomer}</div>
                          )}
                        </td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL FOOTER                                             */}
        {/* ======================================================== */}
        <div className="bg-slate-100 border-t border-slate-200 px-5 py-3 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-blue-500" />
            <span>
              <strong>คำแนะนำ:</strong> สามารถสลับดูระหว่าง "Overview status" (ฝ่ายผลิต) และ "QC Record" (ตรวจรับ) หรือเลือก "Dual" เพื่อดูผลคู่กัน
            </span>
          </div>

          <button
            onClick={onClose}
            className="py-1.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
};
