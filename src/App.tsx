import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { KpiSummary } from './components/KpiSummary';
import { SearchFilterBar } from './components/SearchFilterBar';
import { MachineGrid } from './components/MachineGrid';
import { MachineDetailModal } from './components/MachineDetailModal';
import { DeliveryTimeline } from './components/DeliveryTimeline';
import { DeliveryPlanView } from './components/DeliveryPlanView';
import { AllItemsTable } from './components/AllItemsTable';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsModal } from './components/SettingsModal';
import { ProductionOrderComparatorModal } from './components/ProductionOrderComparatorModal';
import { 
  fetchDeliveryData, 
  buildMachineSummaries, 
  getLastSyncTime 
} from './services/sheetService';
import { DeliveryItem, MachineSummary, ActiveTab, SearchCriteria } from './types';
import { 
  AlertCircle, 
  CheckCircle2, 
  BarChart3, 
  LayoutGrid, 
  Calendar, 
  Layers,
  Cpu,
  GitCompare,
  RefreshCw,
  Download,
  Printer
} from 'lucide-react';

export function App() {
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(getLastSyncTime());
  const [isLive, setIsLive] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('machines');
  const [selectedMachine, setSelectedMachine] = useState<MachineSummary | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isComparatorOpen, setIsComparatorOpen] = useState<boolean>(false);
  const [deliveryActions, setDeliveryActions] = useState<{ exportCsv: () => void; openPrint: () => void } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'in-progress' | 'overdue' | 'due-soon' | 'completed'>('all');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'warning' | 'info'; text: string } | null>(null);

  // 5 Specific Search Fields + Production Department & Action Topic Filters + QC Status + Overview & Ready Operation
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>({
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
  });


  // Compute machine summaries whenever items change
  const machines = useMemo(() => {
    return buildMachineSummaries(items);
  }, [items]);

  // Overall KPI counts
  const totalItems = items.length;
  const deliveredItems = useMemo(() => items.filter(i => i.status === 'ส่งแล้ว').length, [items]);
  const pendingItems = totalItems - deliveredItems;
  const overdueItems = useMemo(() => items.filter(i => i.isOverdue).length, [items]);
  const dueSoonItems = useMemo(() => items.filter(i => i.isDueSoon).length, [items]);
  const rescheduledItems = useMemo(() => items.filter(i => (i.rescheduledCount || 0) > 0).length, [items]);
  const qcPassedItems = useMemo(() => items.filter(i => i.isQcPassed).length, [items]);

  // Compute matching counts for the SearchFilterBar
  const { matchedMachinesCount, matchedItemsCount } = useMemo(() => {
    const matchedItems = items.filter(item => {
      if (searchCriteria.docRef && !item.docRef.toLowerCase().includes(searchCriteria.docRef.toLowerCase().trim())) return false;
      if (searchCriteria.projectCode && !item.projectCode.toLowerCase().includes(searchCriteria.projectCode.toLowerCase().trim())) return false;
      if (searchCriteria.projectName && !item.projectName.toLowerCase().includes(searchCriteria.projectName.toLowerCase().trim())) return false;
      if (searchCriteria.docType && !item.docType.toLowerCase().includes(searchCriteria.docType.toLowerCase().trim())) return false;
      if (searchCriteria.machineName && !item.machineName.toLowerCase().includes(searchCriteria.machineName.toLowerCase().trim())) return false;
      if (searchCriteria.requestDept && (!item.requestDept || !item.requestDept.toLowerCase().includes(searchCriteria.requestDept.toLowerCase().trim()))) return false;
      if (searchCriteria.actionTopic && (!item.actionTopic || !item.actionTopic.toLowerCase().includes(searchCriteria.actionTopic.toLowerCase().trim()))) return false;
      if (searchCriteria.qcStatus === 'passed' && !item.isQcPassed) return false;
      if (searchCriteria.qcStatus === 'pending' && item.isQcPassed) return false;
      if (searchCriteria.overviewStatus && searchCriteria.overviewStatus !== 'all') {
        if (searchCriteria.overviewStatus === 'none') {
          if (item.overviewStatus) return false;
        } else if ((item.overviewStatus || '').toLowerCase() !== searchCriteria.overviewStatus.toLowerCase()) {
          return false;
        }
      }
      if (searchCriteria.readyOpName && searchCriteria.readyOpName !== 'all') {
        if (searchCriteria.readyOpName === 'any_ready') {
          if (!item.hasReadyOp && !item.readyOp) return false;
        } else if (!item.readyOpDesc?.toLowerCase().includes(searchCriteria.readyOpName.toLowerCase()) &&
                   !item.readyOp?.toLowerCase().includes(searchCriteria.readyOpName.toLowerCase())) {
          return false;
        }
      }
      if (searchCriteria.operationStatus && searchCriteria.operationStatus !== 'all') {
        if (searchCriteria.operationStatus === 'ready' && !item.hasReadyOp && !item.readyOp) return false;
        if (searchCriteria.operationStatus === 'active' && !item.activeOp) return false;
        if (searchCriteria.operationStatus === 'completed' && item.currentOpStatus !== 'Completed') return false;
      }
      return true;
    });

    const uniqueMachines = new Set(matchedItems.map(i => i.machineName));
    return {
      matchedMachinesCount: uniqueMachines.size,
      matchedItemsCount: matchedItems.length,
    };
  }, [items, searchCriteria]);

  // Show auto-dismiss toast
  const showToast = useCallback((type: 'success' | 'warning' | 'info', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  }, []);

  // Fetch / Sync Data from all Google Sheets (Up to 4 sources)
  const loadData = useCallback(async (
    customUrl?: string, 
    customProdUrl?: string, 
    customQcUrl?: string,
    customOverviewUrl?: string
  ) => {
    setIsLoading(true);
    try {
      const result = await fetchDeliveryData(customUrl, customProdUrl, customQcUrl, customOverviewUrl);
      setItems(result.items);
      setIsLive(result.fromLive);
      setLastSyncTime(new Date().toISOString());

      if (result.fromLive) {
        showToast('success', `เชื่อมโยงสเปรดชีตสดสำเร็จ (${result.items.length} รายการ พร้อมข้อมูลฝ่ายผลิต, QC & Status Overview)`);
      } else {
        showToast('warning', result.error || 'โหลดข้อมูลสำรองที่เชื่อมโยงเรียบร้อยแล้ว');
      }
    } catch (err: any) {
      console.error('Failed to load delivery data:', err);
      showToast('warning', 'เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + (err.message || 'Error'));
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // Initial load on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handler to select machine by name
  const handleSelectMachineByName = useCallback((machineName: string) => {
    const found = machines.find(m => m.name === machineName);
    if (found) {
      setSelectedMachine(found);
    }
  }, [machines]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-['Prompt',sans-serif]">
      
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRefresh={() => loadData()}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenComparator={() => setIsComparatorOpen(true)}
        isLoading={isLoading}
        isLive={isLive}
        lastSyncTime={lastSyncTime}
        totalMachines={machines.length}
        totalItems={totalItems}
        pendingItemsCount={pendingItems}
      />

      {/* Toast notification banner */}
      {toastMessage && (
        <div className="max-w-[98vw] 2xl:max-w-[1800px] mx-auto px-3 sm:px-5 lg:px-8 w-full pt-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs sm:text-sm font-medium shadow-sm ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : toastMessage.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-sky-50 border-sky-200 text-sky-800'
          }`}>
            <div className="flex items-center gap-2">
              {toastMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              )}
              <span>{toastMessage.text}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-xs opacity-70 hover:opacity-100 underline"
            >
              ปิด
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-[98vw] 2xl:max-w-[1800px] mx-auto px-3 sm:px-5 lg:px-8 py-6 w-full space-y-6">
        
        {/* Top KPI Metrics Section */}
        <KpiSummary
          machines={machines}
          totalItems={totalItems}
          deliveredItems={deliveredItems}
          pendingItems={pendingItems}
          overdueItems={overdueItems}
          dueSoonItems={dueSoonItems}
          rescheduledItems={rescheduledItems}
          qcPassedItems={qcPassedItems}
          onFilterStatus={(status) => {
            setStatusFilter(status);
            setActiveTab('machines');
          }}
          activeStatusFilter={statusFilter}
          onOpenDeliveryPlan={() => setActiveTab('delivery-plan')}
        />

        {/* 5-Field Dedicated Search Filter Panel with Production Dept & Topic */}
        <SearchFilterBar
          searchCriteria={searchCriteria}
          setSearchCriteria={setSearchCriteria}
          items={items}
          matchedMachinesCount={matchedMachinesCount}
          matchedItemsCount={matchedItemsCount}
          actions={
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap shrink-0">
              <button
                onClick={() => setIsComparatorOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition active:scale-95 cursor-pointer"
                title="เปิดหน้าต่างเปรียบเทียบสถานะ Production Order"
              >
                <GitCompare className="w-3.5 h-3.5 text-blue-200" />
                <span>ตัวเทียบ Production Order</span>
              </button>
              <button
                onClick={() => loadData()}
                disabled={isLoading}
                title="กดเพื่อดึงข้อมูลล่าสุดจาก Google Sheets และอัปเดตเลขที่ PD"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-sky-400' : 'text-sky-400'}`} />
                <span>{isLoading ? 'กำลังอัปเดต...' : 'อัปเดตข้อมูล'}</span>
              </button>
              {activeTab === 'delivery-plan' && (
                <>
                  <button
                    onClick={() => deliveryActions?.exportCsv()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white text-slate-800 hover:bg-slate-100 border border-slate-300 shadow-xs transition active:scale-95 cursor-pointer"
                    title="ดาวน์โหลดข้อมูลแผนส่งมอบประจำวันเป็นไฟล์ CSV"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-600" />
                    <span>ส่งออกแผนส่งมอบ (CSV)</span>
                  </button>
                  <button
                    onClick={() => deliveryActions?.openPrint()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-xs transition active:scale-95 cursor-pointer border border-sky-400/30"
                    title="พิมพ์หรือบันทึกแผนส่งมอบเป็นเอกสาร PDF"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>พิมพ์แผน / บันทึกเป็น PDF</span>
                  </button>
                </>
              )}
            </div>
          }
        />

        {/* Tab 1: Machine Index (Primary Request) */}
        {activeTab === 'machines' && (
          <MachineGrid
            machines={machines}
            onSelectMachine={(m) => setSelectedMachine(m)}
            searchCriteria={searchCriteria}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
          />
        )}

        {/* Tab 2: Delivery Plan (งานรอส่ง จัดตามเป้าส่งวันต่อวัน) */}
        {activeTab === 'delivery-plan' && (
          <DeliveryPlanView
            items={items}
            machines={machines}
            searchCriteria={searchCriteria}
            onSelectMachineByName={handleSelectMachineByName}
            onRefresh={() => loadData()}
            onOpenComparator={() => setIsComparatorOpen(true)}
            isLoading={isLoading}
            onRegisterActions={setDeliveryActions}
          />
        )}

        {/* Tab 3: Delivery Timeline & Schedule */}
        {activeTab === 'timeline' && (
          <DeliveryTimeline
            items={items}
            machines={machines}
            searchCriteria={searchCriteria}
            onSelectMachine={(m) => setSelectedMachine(m)}
          />
        )}

        {/* Tab 4: Master Items Table */}
        {activeTab === 'items' && (
          <AllItemsTable
            items={items}
            machines={machines}
            searchCriteria={searchCriteria}
            onSelectMachineByName={handleSelectMachineByName}
          />
        )}

        {/* Tab 5: Analytics */}
        {activeTab === 'analytics' && (
          <AnalyticsView
            machines={machines}
            items={items}
            onSelectMachine={(m) => setSelectedMachine(m)}
          />
        )}

      </main>

      {/* Machine Detail Modal */}
      <MachineDetailModal
        machine={selectedMachine}
        onClose={() => setSelectedMachine(null)}
      />

      {/* Google Sheets Dual-Sync Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onRefreshData={loadData}
        lastSyncTime={lastSyncTime}
        isLive={isLive}
        totalItems={totalItems}
      />

      {/* Production Order Status Comparator Modal */}
      <ProductionOrderComparatorModal
        isOpen={isComparatorOpen}
        onClose={() => setIsComparatorOpen(false)}
        items={items}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-12">
        <div className="max-w-[98vw] 2xl:max-w-[1800px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">PDTrack</span>
            <span>- ระบบติดตามเป้าหมายการส่งมอบโดยใช้ชื่อเครื่องจักรเป็นดัชนี</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400 flex-wrap">
            <span>ผสาน 4 แหล่งข้อมูล: Check list ส่งมอบ + Record ฝ่ายผลิต + QC + Status Overview</span>
            <span>•</span>
            <span>สถานะ: {isLive ? 'Online Multi-Sync' : 'Offline Linked Cache'}</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default App;
