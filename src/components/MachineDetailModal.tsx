import React, { useState, useMemo } from 'react';
import { 
  X, 
  Cpu, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Calendar, 
  Download, 
  Search, 
  Filter, 
  History, 
  FileText, 
  ArrowRight,
  Boxes,
  Building2,
  Share2,
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import { MachineSummary, DeliveryItem } from '../types';
import { formatThaiDate, formatCompactDate } from '../utils/dateUtils';
import { isOverviewCompletedOrClosed } from '../services/sheetService';

interface MachineDetailModalProps {
  machine: MachineSummary | null;
  onClose: () => void;
}

export const MachineDetailModal: React.FC<MachineDetailModalProps> = ({ machine, onClose }) => {
  if (!machine) return null;

  const [itemSearch, setItemSearch] = useState('');
  const [itemStatusFilter, setItemStatusFilter] = useState<'all' | 'delivered' | 'pending' | 'overdue' | 'rescheduled' | 'qc-passed' | 'done-or-qc'>('all');

  // Calculate completed or QC passed count (Item ที่เสร็จแล้ว หรือ ผ่าน QC แล้ว)
  const completedOrQcCount = useMemo(() => {
    if (machine.completedOrQcItems !== undefined) return machine.completedOrQcItems;
    return machine.items.filter(item => 
      item.status === 'ส่งแล้ว' || 
      isOverviewCompletedOrClosed(item.overviewStatus) || 
      Boolean(item.isQcPassed)
    ).length;
  }, [machine]);

  const progressPercent = useMemo(() => {
    return machine.totalItems > 0 ? Math.round((completedOrQcCount / machine.totalItems) * 100) : 0;
  }, [completedOrQcCount, machine.totalItems]);

  // Filter items of this machine
  const filteredItems = useMemo(() => {
    return machine.items.filter(item => {
      // Search
      if (itemSearch) {
        const term = itemSearch.toLowerCase();
        const matchName = item.itemName.toLowerCase().includes(term);
        const matchCode = item.itemCode.toLowerCase().includes(term);
        const matchPO = item.prodOrder.toLowerCase().includes(term) || item.poPr.toLowerCase().includes(term);
        const matchRemark = item.remark.toLowerCase().includes(term);
        const matchDept = item.requestDept?.toLowerCase().includes(term);
        const matchReq = item.requesterName?.toLowerCase().includes(term);
        const matchTopic = item.actionTopic?.toLowerCase().includes(term);
        const matchQC = item.isQcPassed && ('ผ่าน qc'.includes(term) || item.qcInspector?.toLowerCase().includes(term));
        if (!matchName && !matchCode && !matchPO && !matchRemark && !matchDept && !matchReq && !matchTopic && !matchQC) {
          return false;
        }
      }

      // Status
      if (itemStatusFilter === 'delivered' && item.status !== 'ส่งแล้ว') return false;
      if (itemStatusFilter === 'pending' && item.status === 'ส่งแล้ว') return false;
      if (itemStatusFilter === 'overdue' && !item.isOverdue) return false;
      if (itemStatusFilter === 'rescheduled' && (item.rescheduledCount || 0) === 0) return false;
      if (itemStatusFilter === 'qc-passed' && !item.isQcPassed) return false;
      if (itemStatusFilter === 'done-or-qc' && !(item.status === 'ส่งแล้ว' || isOverviewCompletedOrClosed(item.overviewStatus) || item.isQcPassed)) return false;

      return true;
    });
  }, [machine, itemSearch, itemStatusFilter]);

  // Export to CSV
  const handleExportCsv = () => {
    const headers = [
      'ชื่อเครื่องจักร',
      'เลขที่ Item',
      'ชื่อ Item',
      'จำนวน',
      'Production Order',
      'สถานะ QC',
      'วันที่ตรวจ QC',
      'ผู้ตรวจ QC',
      'เป้าหมาย 1',
      'เป้าหมาย 2',
      'เป้าหมาย 3',
      'เป้าหมาย 4',
      'เป้าหมาย 5',
      'เป้าหมายล่าสุด',
      'สถานะ',
      'Closed (*)',
      'หมายเหตุ',
      'ชื่อโครงการ'
    ];

    const rows = machine.items.map(i => [
      `"${i.machineName}"`,
      `"${i.itemCode}"`,
      `"${i.itemName.replace(/"/g, '""')}"`,
      i.qty,
      `"${i.prodOrder}"`,
      i.isQcPassed ? '"ผ่าน QC แล้ว"' : '"ยังไม่เข้า QC"',
      `"${i.qcDate || ''}"`,
      `"${i.qcInspector || ''}"`,
      `"${i.target1 || ''}"`,
      `"${i.target2}"`,
      `"${i.target3}"`,
      `"${i.target4}"`,
      `"${i.target5}"`,
      `"${i.targetLatest}"`,
      `"${i.status}"`,
      `"${i.closed}"`,
      `"${i.remark.replace(/"/g, '""')}"`,
      `"${i.projectName.replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Delivery_Plan_${machine.name}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isCompleted = machine.progressPercent === 100;
  const hasOverdue = machine.overdueItems > 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-3 md:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[97vw] 2xl:max-w-[1780px] max-h-[94vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Cpu className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  เครื่องจักร: {machine.name}
                </h2>
                {isCompleted ? (
                  <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" /> ส่งมอบครบ 100%
                  </span>
                ) : hasOverdue ? (
                  <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    <AlertTriangle className="w-3.5 h-3.5" /> เกินกำหนด {machine.overdueItems} รายการ
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    <Clock className="w-3.5 h-3.5" /> อยู่ระหว่างดำเนินการ
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 mt-2 text-xs text-slate-300 flex-wrap">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>{machine.projects.join(', ') || 'ไม่ระบุโครงการ'}</span>
                </span>
                <span>•</span>
                <span>เป้ากำหนดส่งล่าสุด: <strong>{machine.latestTarget ? formatThaiDate(machine.latestTarget) : '-'}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-center">
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-700 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ส่งออก CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Machine Stats Ribbon */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-xs">
          <div>
            <span className="text-slate-400">ความคืบหน้าภาพรวม</span>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${progressPercent === 100 ? 'bg-emerald-500' : hasOverdue ? 'bg-rose-500' : 'bg-sky-500'}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="font-bold text-slate-800">{progressPercent}%</span>
            </div>
          </div>

          <div>
            <span className="text-slate-400">เสร็จแล้ว หรือ ผ่าน QC แล้ว</span>
            <div className="font-semibold text-slate-800 text-sm mt-0.5">
              {completedOrQcCount} / {machine.totalItems} รายการ
            </div>
          </div>

          <div>
            <span className="text-slate-400">เป้ากำหนดส่งล่าสุด</span>
            <div className="flex items-center gap-1.5 font-semibold text-sm mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className={hasOverdue ? 'text-rose-600 font-bold' : 'text-slate-800'}>
                {machine.latestTarget ? formatThaiDate(machine.latestTarget) : 'ตามแผนงาน'}
              </span>
            </div>
          </div>

          <div>
            <span className="text-slate-400">จำนวนอะไหล่ทั้งหมด (Qty)</span>
            <div className="font-semibold text-slate-800 text-sm mt-0.5">
              {machine.deliveredQty} / {machine.totalQty} ชิ้น
            </div>
          </div>

          <div>
            <span className="text-slate-400">รายการที่ปรับเป้าหมาย</span>
            <div className="font-semibold text-purple-700 text-sm mt-0.5">
              {machine.rescheduledItems} รายการ
            </div>
          </div>
        </div>

        {/* Modal Controls & Search */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              placeholder="ค้นหาชื่อชิ้นส่วน, รหัส, ผู้สั่ง, แผนก, PO..."
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-sky-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar">
            <button
              onClick={() => setItemStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                itemStatusFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ทั้งหมด ({machine.items.length})
            </button>
            <button
              onClick={() => setItemStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                itemStatusFilter === 'pending'
                  ? 'bg-sky-600 text-white'
                  : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
              }`}
            >
              รอส่งมอบ ({machine.pendingItems})
            </button>
            <button
              onClick={() => setItemStatusFilter('overdue')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                itemStatusFilter === 'overdue'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              เกินกำหนด ({machine.overdueItems})
            </button>
            <button
              onClick={() => setItemStatusFilter('delivered')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                itemStatusFilter === 'delivered'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              ส่งแล้ว ({machine.deliveredItems})
            </button>
            <button
              onClick={() => setItemStatusFilter('done-or-qc')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap flex items-center gap-1 ${
                itemStatusFilter === 'done-or-qc'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 font-semibold'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>เสร็จ/ผ่าน QC ({completedOrQcCount})</span>
            </button>
            <button
              onClick={() => setItemStatusFilter('rescheduled')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                itemStatusFilter === 'rescheduled'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
              }`}
            >
              เลื่อนเป้า ({machine.rescheduledItems})
            </button>
            {machine.qcPassedItems > 0 && (
              <button
                onClick={() => setItemStatusFilter('qc-passed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap flex items-center gap-1 ${
                  itemStatusFilter === 'qc-passed'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                ผ่าน QC แล้ว ({machine.qcPassedItems})
              </button>
            )}
          </div>
        </div>

        {/* Modal Items Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3.5">ลำดับ</th>
                    <th className="py-3 px-3.5">เลขที่ Item</th>
                    <th className="py-3 px-3.5 min-w-[200px]">ชื่อ Item / รายละเอียดอะไหล่</th>
                    <th className="py-3 px-3.5 text-center">จำนวน</th>
                    <th className="py-3 px-3.5">Production Order / PO</th>
                    <th className="py-3 px-3.5 text-center">วันที่แจ้งทำ</th>
                    <th className="py-3 px-3.5 min-w-[170px]">ประวัติเป้าหมาย (1 $\rightarrow$ 5)</th>
                    <th className="py-3 px-3.5">เป้าหมายล่าสุด</th>
                    <th className="py-3 px-3.5 text-center">สถานะ</th>
                    <th className="py-3 px-3.5 min-w-[180px]">หมายเหตุ / ข้อมูลจัดส่ง</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item, idx) => {
                    const isDelivered = item.status === 'ส่งแล้ว';
                    
                    return (
                      <tr 
                        key={item.id} 
                        className={`hover:bg-slate-50 transition ${item.isOverdue ? 'bg-rose-50/40' : ''}`}
                      >
                        <td className="py-3 px-3.5 text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3.5 font-mono font-medium text-slate-800 whitespace-nowrap">
                          {item.itemCode || '-'}
                        </td>
                        <td className="py-3 px-3.5 font-medium text-slate-900">
                          <div>{item.itemName}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {item.projectName}
                          </div>
                        </td>

                        <td className="py-3 px-3.5 text-center font-bold text-slate-800">
                          {item.qty}
                        </td>
                        <td className="py-3 px-3.5 text-slate-600 font-mono text-[11px]">
                          <div className="font-semibold text-slate-800">{item.prodOrder || '-'}</div>
                          {item.poPr && <div className="text-slate-400">{item.poPr}</div>}
                          <div className="flex items-center gap-1 mt-1 flex-wrap font-sans">
                            {item.overviewStatus && (
                              <span className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded ${
                                isOverviewCompletedOrClosed(item.overviewStatus)
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : item.overviewStatus === 'Active'
                                  ? 'bg-blue-100 text-blue-800'
                                  : item.overviewStatus === 'Ready to Start'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}>
                                {isOverviewCompletedOrClosed(item.overviewStatus) ? '✓ เสร็จแล้ว' : item.overviewStatus}
                              </span>
                            )}
                            {item.activeOp ? (
                              <span 
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9.5px] font-semibold rounded bg-blue-50 text-blue-900 border border-blue-200"
                                title={`Operation กำลังทำ: ${item.activeOp}`}
                              >
                                <TrendingUp className="w-2 h-2 text-blue-600" />
                                <span>กำลังทำ: {item.activeOpDesc || item.activeOp}</span>
                              </span>
                            ) : item.readyOp ? (
                              <span 
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9.5px] font-semibold rounded bg-amber-50 text-amber-900 border border-amber-300"
                                title={`Operation รอขึ้นทำงาน: ${item.readyOp}`}
                              >
                                <Clock className="w-2 h-2 text-amber-600" />
                                <span>รอขึ้น: {item.readyOpDesc || item.readyOp}</span>
                              </span>
                            ) : null}
                            {item.isQcPassed && (
                              <span 
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300"
                                title={`ผ่านการตรวจ QC: วันที่ ${item.qcDate || '-'} โดย ${item.qcInspector || '-'}`}
                              >
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> ผ่าน QC แล้ว
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-center text-slate-500 whitespace-nowrap">
                          {item.notifyDate ? formatCompactDate(item.notifyDate) : '-'}
                        </td>

                        {/* Milestone Targets Progression */}
                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-1 flex-wrap">
                            {item.target1 && (
                              <span className={`px-1.5 py-0.5 rounded text-[11px] font-mono ${
                                item.target2 ? 'line-through text-slate-400 bg-slate-100' : 'text-slate-700 bg-slate-100 font-medium'
                              }`}>
                                {formatCompactDate(item.target1)}
                              </span>
                            )}
                            {item.target2 && (
                              <>
                                <ArrowRight className="w-3 h-3 text-slate-300" />
                                <span className={`px-1.5 py-0.5 rounded text-[11px] font-mono ${
                                  item.target3 ? 'line-through text-slate-400 bg-slate-100' : 'text-purple-700 bg-purple-50 font-medium border border-purple-200'
                                }`}>
                                  {formatCompactDate(item.target2)}
                                </span>
                              </>
                            )}
                            {item.target3 && (
                              <>
                                <ArrowRight className="w-3 h-3 text-slate-300" />
                                <span className={`px-1.5 py-0.5 rounded text-[11px] font-mono ${
                                  item.target4 ? 'line-through text-slate-400 bg-slate-100' : 'text-purple-700 bg-purple-50 font-medium border border-purple-200'
                                }`}>
                                  {formatCompactDate(item.target3)}
                                </span>
                              </>
                            )}
                            {item.target4 && (
                              <>
                                <ArrowRight className="w-3 h-3 text-slate-300" />
                                <span className={`px-1.5 py-0.5 rounded text-[11px] font-mono ${
                                  item.target5 ? 'line-through text-slate-400 bg-slate-100' : 'text-purple-700 bg-purple-50 font-medium border border-purple-200'
                                }`}>
                                  {formatCompactDate(item.target4)}
                                </span>
                              </>
                            )}
                            {item.target5 && (
                              <>
                                <ArrowRight className="w-3 h-3 text-slate-300" />
                                <span className="px-1.5 py-0.5 rounded text-[11px] font-mono text-purple-700 bg-purple-50 font-medium border border-purple-200">
                                  {formatCompactDate(item.target5)}
                                </span>
                              </>
                            )}
                            {!item.target1 && !item.targetLatest && (
                              <span className="text-slate-400">-</span>
                            )}
                          </div>
                        </td>

                        {/* Latest Target */}
                        <td className="py-3 px-3.5 font-medium whitespace-nowrap">
                          <span className={`${
                            item.isOverdue 
                              ? 'text-rose-600 font-bold bg-rose-100 px-2 py-0.5 rounded' 
                              : item.isDueSoon 
                              ? 'text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded' 
                              : 'text-slate-800'
                          }`}>
                            {item.targetLatest ? formatThaiDate(item.targetLatest) : '-'}
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          {isDelivered ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> ส่งแล้ว
                            </span>
                          ) : item.isOverdue ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                              <AlertTriangle className="w-3 h-3" /> เกินกำหนด
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800 border border-sky-200">
                              <Clock className="w-3 h-3" /> รอดำเนินการ
                            </span>
                          )}
                          {(item.closed === '*' || item.closed?.toLowerCase().includes('close') || item.remark?.includes('*') || item.remark?.toLowerCase().includes('close')) && (
                            <span className="ml-1 text-[10px] text-amber-600 font-bold" title="Closed (*) / ส่งงานแล้ว">
                              ★
                            </span>
                          )}
                        </td>

                        {/* Remark */}
                        <td className="py-3 px-3.5 text-slate-600 text-[11px] min-w-[150px]">
                          {item.remark || '-'}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredItems.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400">
                        ไม่พบรายการที่ตรงตามเงื่อนไข
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            แสดง <strong>{filteredItems.length}</strong> จาก {machine.items.length} รายการของเครื่องจักร {machine.name}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 font-medium rounded-lg transition"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
};
