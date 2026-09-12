import React from 'react';
import { 
  Cog, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Calendar, 
  LayoutGrid, 
  Layers, 
  BarChart3,
  ExternalLink,
  Truck,
  GitCompare
} from 'lucide-react';
import { ActiveTab } from '../types';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onRefresh: () => void;
  onOpenSettings: () => void;
  onOpenComparator?: () => void;
  isLoading: boolean;
  isLive: boolean;
  lastSyncTime: string | null;
  totalMachines: number;
  totalItems: number;
  pendingItemsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onRefresh,
  onOpenSettings,
  onOpenComparator,
  isLoading,
  isLive,
  lastSyncTime,
  totalMachines,
  totalItems,
  pendingItemsCount = 0,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
      <div className="max-w-[98vw] 2xl:max-w-[1800px] mx-auto px-3 sm:px-5 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & System Name */}
          <div className="flex items-center gap-3 min-w-max">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-blue-700 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
              <Cog className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-slate-900">AMW PD<span className="text-sky-600">Track</span></span>
              </div>
              <p className="text-xs text-slate-500 hidden md:block">
                ระบบติดตามเป้าหมายการส่งมอบอะไหล่ & ชิ้นส่วน
              </p>
            </div>
          </div>

          {/* Live Sync Status & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex flex-col items-end text-right text-xs">
              <div className="flex items-center gap-1.5 font-medium">
                {isLive ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Google Sheet สด
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-600">
                    <AlertCircle className="w-3.5 h-3.5" />
                    ข้อมูลแคชสำรอง
                  </span>
                )}
              </div>
              <span className="text-slate-400">
                {lastSyncTime ? `ซิงค์: ${new Date(lastSyncTime).toLocaleTimeString('th-TH')}` : 'ยังไม่ระบุ'}
              </span>
            </div>

            {/* Direct Delivery Plan Button */}
            <button
              onClick={() => setActiveTab('delivery-plan')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg border transition active:scale-95 cursor-pointer ${
                activeTab === 'delivery-plan'
                  ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                  : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
              }`}
              title="ดูแผนการส่งมอบประจำวัน (เฉพาะงานที่ยังไม่ส่ง)"
            >
              <Truck className="w-4 h-4 text-amber-600" />
              <span>แผนการส่งมอบ</span>
              {pendingItemsCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === 'delivery-plan' ? 'bg-white text-sky-800' : 'bg-amber-200 text-amber-900'
                }`}>
                  {pendingItemsCount} รอส่ง
                </span>
              )}
            </button>

            <button
              onClick={onRefresh}
              disabled={isLoading}
              title="กดเพื่อดึงข้อมูลล่าสุดจาก Google Sheets และเชื่อมโยงเลขที่ PD / QC"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-800 bg-white hover:bg-slate-50 hover:text-blue-700 active:scale-95 rounded-lg border border-slate-300 shadow-2xs transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : 'text-blue-600'}`} />
              <span>{isLoading ? 'กำลังอัปเดต...' : 'อัปเดตข้อมูล'}</span>
            </button>

            {onOpenComparator && (
              <button
                onClick={onOpenComparator}
                title="เปิดตัวเทียบสถานะ Production Order ระหว่าง Overview status และ QC Record"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 hover:text-blue-950 active:scale-95 rounded-lg border border-blue-200 shadow-2xs transition cursor-pointer"
              >
                <GitCompare className="w-3.5 h-3.5 text-blue-600" />
                <span>ตัวเทียบ PD</span>
              </button>
            )}

            <button
              onClick={onOpenSettings}
              title="ตั้งค่าแหล่งข้อมูล Google Sheet"
              className="p-1.5 sm:px-2.5 sm:py-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition flex items-center gap-1 cursor-pointer"
            >
              <Cog className="w-4 h-4" />
              <span className="text-xs font-medium hidden sm:inline">ตั้งค่า</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-1 -mb-px overflow-x-auto no-scrollbar">
          <nav className="flex space-x-2 sm:space-x-4">
            <button
              onClick={() => setActiveTab('machines')}
              className={`flex items-center gap-2 py-2.5 px-3 border-b-2 font-medium text-sm transition whitespace-nowrap cursor-pointer ${
                activeTab === 'machines'
                  ? 'border-sky-600 text-sky-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>ดัชนีเครื่องจักร ({totalMachines})</span>
            </button>

            <button
              onClick={() => setActiveTab('delivery-plan')}
              className={`flex items-center gap-2 py-2.5 px-3 border-b-2 font-medium text-sm transition whitespace-nowrap cursor-pointer ${
                activeTab === 'delivery-plan'
                  ? 'border-sky-600 text-sky-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Truck className="w-4 h-4 text-sky-500" />
              <span>แผนการส่งมอบ (งานรอส่ง {pendingItemsCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('timeline')}
              className={`flex items-center gap-2 py-2.5 px-3 border-b-2 font-medium text-sm transition whitespace-nowrap cursor-pointer ${
                activeTab === 'timeline'
                  ? 'border-sky-600 text-sky-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>กำหนดส่งมอบ / ไทม์ไลน์</span>
            </button>

            <button
              onClick={() => setActiveTab('items')}
              className={`flex items-center gap-2 py-2.5 px-3 border-b-2 font-medium text-sm transition whitespace-nowrap cursor-pointer ${
                activeTab === 'items'
                  ? 'border-sky-600 text-sky-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>รายการชิ้นส่วนทั้งหมด ({totalItems})</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
