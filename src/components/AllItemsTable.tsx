import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  Cpu, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight,
  Layers,
  ArrowRight,
  Briefcase,
  TrendingUp
} from 'lucide-react';
import { DeliveryItem, MachineSummary, SearchCriteria } from '../types';
import { formatThaiDate, formatCompactDate } from '../utils/dateUtils';
import { isOverviewCompletedOrClosed } from '../services/sheetService';

interface AllItemsTableProps {
  items: DeliveryItem[];
  machines: MachineSummary[];
  searchCriteria: SearchCriteria;
  onSelectMachineByName: (name: string) => void;
}

export const AllItemsTable: React.FC<AllItemsTableProps> = ({
  items,
  machines,
  searchCriteria,
  onSelectMachineByName,
}) => {
  const [internalSearch, setInternalSearch] = useState('');
  const [selectedMachine, setSelectedMachine] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'delivered' | 'pending' | 'overdue' | 'rescheduled' | 'qc-passed'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 30;

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // 1. Document number Reference filter
      if (searchCriteria.docRef) {
        const term = searchCriteria.docRef.toLowerCase().trim();
        if (!item.docRef.toLowerCase().includes(term)) return false;
      }

      // 2. Project Code filter
      if (searchCriteria.projectCode) {
        const term = searchCriteria.projectCode.toLowerCase().trim();
        if (!item.projectCode.toLowerCase().includes(term)) return false;
      }

      // 3. Project Name filter
      if (searchCriteria.projectName) {
        const term = searchCriteria.projectName.toLowerCase().trim();
        if (!item.projectName.toLowerCase().includes(term)) return false;
      }

      // 4. Document Type filter
      if (searchCriteria.docType) {
        const term = searchCriteria.docType.toLowerCase().trim();
        if (!item.docType.toLowerCase().includes(term)) return false;
      }

      // 5. Machine Name filter
      if (searchCriteria.machineName) {
        const term = searchCriteria.machineName.toLowerCase().trim();
        if (!item.machineName.toLowerCase().includes(term)) return false;
      }

      // 6. Request Dept filter (from File 2)
      if (searchCriteria.requestDept) {
        const term = searchCriteria.requestDept.toLowerCase().trim();
        if (!item.requestDept || !item.requestDept.toLowerCase().includes(term)) return false;
      }

      // 7. Action Topic filter (from File 2)
      if (searchCriteria.actionTopic) {
        const term = searchCriteria.actionTopic.toLowerCase().trim();
        if (!item.actionTopic || !item.actionTopic.toLowerCase().includes(term)) return false;
      }

      // 8. QC Status filter
      if (searchCriteria.qcStatus === 'passed' && !item.isQcPassed) return false;
      if (searchCriteria.qcStatus === 'pending' && item.isQcPassed) return false;

      // 9. Overview Status filter
      if (searchCriteria.overviewStatus && searchCriteria.overviewStatus !== 'all') {
        if (searchCriteria.overviewStatus === 'none') {
          if (item.overviewStatus) return false;
        } else if (searchCriteria.overviewStatus === 'Completed') {
          if (!isOverviewCompletedOrClosed(item.overviewStatus)) return false;
        } else if ((item.overviewStatus || '').toLowerCase() !== searchCriteria.overviewStatus.toLowerCase()) {
          return false;
        }
      }

      // 10. Ready Operation filter
      if (searchCriteria.readyOpName && searchCriteria.readyOpName !== 'all') {
        if (searchCriteria.readyOpName === 'any_ready') {
          if (!item.hasReadyOp && !item.readyOp) return false;
        } else if (!item.readyOpDesc?.toLowerCase().includes(searchCriteria.readyOpName.toLowerCase()) &&
                   !item.readyOp?.toLowerCase().includes(searchCriteria.readyOpName.toLowerCase())) {
          return false;
        }
      }

      // 11. Operation Status filter
      if (searchCriteria.operationStatus && searchCriteria.operationStatus !== 'all') {
        if (searchCriteria.operationStatus === 'ready' && !item.hasReadyOp && !item.readyOp) return false;
        if (searchCriteria.operationStatus === 'active' && !item.activeOp) return false;
        if (searchCriteria.operationStatus === 'completed' && item.currentOpStatus !== 'Completed') return false;
      }

      // Additional dropdown Machine filter
      if (selectedMachine !== 'all' && item.machineName !== selectedMachine) {
        return false;
      }

      // Status filter
      if (selectedStatus === 'delivered' && item.status !== 'ส่งแล้ว') return false;
      if (selectedStatus === 'pending' && item.status === 'ส่งแล้ว') return false;
      if (selectedStatus === 'overdue' && !item.isOverdue) return false;
      if (selectedStatus === 'rescheduled' && (item.rescheduledCount || 0) === 0) return false;
      if (selectedStatus === 'qc-passed' && !item.isQcPassed) return false;

      // Internal quick search
      if (internalSearch) {
        const term = internalSearch.toLowerCase();
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

      return true;
    });
  }, [items, searchCriteria, internalSearch, selectedMachine, selectedStatus]);

  // Reset to page 1 on filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchCriteria, internalSearch, selectedMachine, selectedStatus]);

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // Export to CSV
  const handleExport = () => {
    const headers = [
      'Document number Reference',
      'เลขที่โครงการ',
      'ชื่อโครงการ',
      'ประเภท',
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
      'หมายเหตุ'
    ];

    const rows = filteredItems.map(i => [
      `"${i.docRef}"`,
      `"${i.projectCode}"`,
      `"${i.projectName.replace(/"/g, '""')}"`,
      `"${i.docType}"`,
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
      `"${i.remark.replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `PDTrack_Master_Items.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Control Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={internalSearch}
            onChange={(e) => setInternalSearch(e.target.value)}
            placeholder="ค้นหาชื่อชิ้นส่วน, รหัส Item, ผู้สั่ง, แผนก, PO, QC..."
            className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-sky-500 focus:bg-white"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Machine selector */}
          <div className="flex items-center gap-1 text-xs">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedMachine}
              onChange={(e) => setSelectedMachine(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none max-w-[170px] truncate"
            >
              <option value="all">ทุกเครื่องจักร ({machines.length})</option>
              {machines.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name} ({m.totalItems})
                </option>
              ))}
            </select>
          </div>

          {/* Status selector */}
          <div className="flex items-center gap-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none"
            >
              <option value="all">ทุกสถานะ</option>
              <option value="pending">รอส่งมอบ</option>
              <option value="overdue">เกินกำหนดส่ง</option>
              <option value="delivered">ส่งแล้วเสร็จ</option>
              <option value="rescheduled">มีการเลื่อนเป้า</option>
              <option value="qc-passed">ผ่าน QC แล้ว</option>
            </select>
          </div>

          {/* Export Button */}
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ส่งออก CSV ({filteredItems.length})</span>
          </button>
        </div>
      </div>

      {/* Master Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">ลำดับ</th>
                <th className="py-3 px-3 min-w-[110px]">Doc Number Ref</th>
                <th className="py-3 px-3 min-w-[130px]">ชื่อเครื่องจักร (ดัชนี)</th>
                <th className="py-3 px-3">เลขที่ Item</th>
                <th className="py-3 px-3 min-w-[180px]">ชื่อ Item / อะไหล่</th>
                <th className="py-3 px-3 text-center">จำนวน</th>
                <th className="py-3 px-3">Production Order</th>
                <th className="py-3 px-3 min-w-[130px]">เป้าหมาย 1 $\rightarrow$ 5</th>
                <th className="py-3 px-3">เป้าหมายล่าสุด</th>
                <th className="py-3 px-3 text-center">สถานะ</th>
                <th className="py-3 px-3 min-w-[150px]">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedItems.map((item, idx) => {
                const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                const isDelivered = item.status === 'ส่งแล้ว';

                return (
                  <tr 
                    key={item.id}
                    className={`hover:bg-sky-50/40 transition ${item.isOverdue ? 'bg-rose-50/40' : ''}`}
                  >
                    <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                      {globalIdx}
                    </td>

                    {/* Doc Number Ref */}
                    <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                      <div>{item.docRef || '-'}</div>
                      <div className="text-[10px] text-slate-400">{item.projectCode}</div>
                    </td>

                    {/* Machine Column (Clickable) */}
                    <td className="py-3 px-3 font-medium whitespace-nowrap">
                      <button
                        onClick={() => onSelectMachineByName(item.machineName)}
                        className="font-bold text-sky-700 hover:text-sky-900 hover:underline flex items-center gap-1"
                      >
                        <Cpu className="w-3.5 h-3.5 text-sky-500" />
                        <span>{item.machineName}</span>
                      </button>
                      <div className="text-[10px] text-slate-400 leading-snug" title={item.projectName}>
                        {item.projectName}
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                      {item.itemCode || '-'}
                    </td>

                    <td className="py-3 px-3 font-medium text-slate-900">
                      <div>{item.itemName}</div>
                    </td>

                    <td className="py-3 px-3 text-center font-bold text-slate-800">
                      {item.qty}
                    </td>

                    <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                      <div className="font-semibold text-slate-800">{item.prodOrder || '-'}</div>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
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
                            title={`ผ่านตรวจ QC: วันที่ ${item.qcDate || '-'} โดย ${item.qcInspector || '-'}`}
                          >
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> ผ่าน QC
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Milestones */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1 text-[11px] font-mono">
                        {item.target1 && (
                          <span className={item.target2 ? 'line-through text-slate-400' : 'text-slate-700'}>
                            {formatCompactDate(item.target1)}
                          </span>
                        )}
                        {item.target2 && (
                          <>
                            <ArrowRight className="w-2.5 h-2.5 text-slate-300" />
                            <span className={item.target3 ? 'line-through text-slate-400' : 'text-purple-700 font-medium'}>
                              {formatCompactDate(item.target2)}
                            </span>
                          </>
                        )}
                        {item.target3 && (
                          <>
                            <ArrowRight className="w-2.5 h-2.5 text-slate-300" />
                            <span className="text-purple-700 font-medium">
                              {formatCompactDate(item.target3)}
                            </span>
                          </>
                        )}
                        {!item.target1 && <span className="text-slate-400">-</span>}
                      </div>
                    </td>

                    {/* Latest Target */}
                    <td className="py-3 px-3 font-medium whitespace-nowrap">
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

                    {/* Status */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {isDelivered ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> ส่งแล้ว
                        </span>
                      ) : item.isOverdue ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
                          <AlertTriangle className="w-3 h-3" /> เกินกำหนด
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800">
                          <Clock className="w-3 h-3" /> รอส่ง
                        </span>
                      )}
                    </td>

                    {/* Remark */}
                    <td className="py-3 px-3 text-slate-600 text-[11px] min-w-[150px]">
                      {item.remark || '-'}
                    </td>
                  </tr>
                );
              })}

              {paginatedItems.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-16 text-center text-slate-400">
                    <Layers className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <span>ไม่พบชิ้นส่วนหรือรายการที่ตรงกับเงื่อนไข</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="bg-slate-50 p-3 sm:p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div>
            แสดง {filteredItems.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} ถึง {Math.min(currentPage * pageSize, filteredItems.length)} จากทั้งหมด <strong>{filteredItems.length}</strong> รายการ
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 font-medium"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>ก่อนหน้า</span>
            </button>

            <span className="px-2 font-semibold text-slate-800">
              หน้า {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 font-medium"
            >
              <span>ถัดไป</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
