export interface DeliveryItem {
  id: string;
  docRef: string;
  projectCode: string;
  projectName: string;
  customer?: string;
  docType: string;
  machineName: string;
  hasMachine: boolean;
  itemCode: string;
  itemName: string;
  qty: number;
  prodOrder: string;
  pdActLine: string;
  notifyDate: string;
  target1: string;
  target2: string;
  target3: string;
  target4: string;
  target5: string;
  targetLatest: string;
  poPr: string;
  remark: string;
  status: 'ส่งแล้ว' | 'รอดำเนินการ';
  rawStatus: string;
  closed: string;
  
  // Production Register (File 2) Enriched Fields
  actionTopic?: string;       // หัวข้อแจ้งดำเนินการ (สาเหตุการสั่งทำ เช่น ปัญหาการออกแบบ, Rework)
  ncrNo?: string;             // NCR,IPR No.
  requestDept?: string;       // หน่วยงานที่แจ้งดำเนินการ (เช่น R&D, Engineering, Service)
  requesterName?: string;     // ชื่อผู้แจ้งดำเนินการ
  targetRequested?: string;   // เป้าหมายที่ต้องการ
  week?: string;              // Week

  // QC Inspection Enriched Fields (Google Sheet: gid=1814251242)
  isQcPassed?: boolean;       // ผ่าน QC แล้ว (ถ้ามีเลขที่ PD No. ปรากฏในไฟล์ QC)
  qcDate?: string;            // วันที่ตรวจ QC
  qcInspector?: string;       // ผู้ตรวจสอบ QC
  qcPassedQty?: string;       // จำนวนที่ผ่านตรวจ
  qcTopic?: string;           // หัวข้อการตรวจ เช่น ตรวจหลังผลิต / ตรวจหลังทำสี
  qcRemarks?: string;         // หมายเหตุ / รายละเอียดจาก QC
  qcPdList?: string[];        // รายการ PD ที่ผ่านตรวจ

  // Overview Status Enriched Fields (From Week 37 Status Overview)
  overviewStatus?: 'Completed' | 'Active' | 'Planned' | 'Ready to Start' | string;
  overviewCustomer?: string;
  overviewProject?: string;
  overviewItemCode?: string;

  // Computed fields
  isOverdue?: boolean;
  isDueSoon?: boolean;
  rescheduledCount?: number;
  parsedLatestDate?: Date | null;
}

export interface OverviewMeta {
  status: string;
  project?: string;
  customer?: string;
  itemCode?: string;
  description?: string;
  prodOrder?: string;
}

export interface MachineSummary {
  name: string;
  hasMachine: boolean;
  totalItems: number;
  deliveredItems: number;
  pendingItems: number;
  overdueItems: number;
  dueSoonItems: number;
  rescheduledItems: number;
  qcPassedItems: number;
  totalQty: number;
  deliveredQty: number;
  progressPercent: number;
  projects: string[];
  projectCodes: string[];
  productionOrders: string[];
  requestDepts: string[];
  actionTopics: string[];
  earliestTarget: string | null;
  latestTarget: string | null;
  status: 'completed' | 'overdue' | 'due-soon' | 'in-progress';
  items: DeliveryItem[];
}

export interface SearchCriteria {
  docRef: string;
  projectCode: string;
  projectName: string;
  docType: string;
  machineName: string;
  requestDept?: string;
  actionTopic?: string;
  qcStatus?: 'all' | 'passed' | 'pending';
}

export interface FilterState {
  searchCriteria: SearchCriteria;
  status: 'all' | 'in-progress' | 'overdue' | 'due-soon' | 'completed';
  project: string;
  sortBy: 'name' | 'urgent' | 'progress-asc' | 'progress-desc' | 'items-desc';
  viewMode: 'cards' | 'table';
}

export type ActiveTab = 'machines' | 'delivery-plan' | 'timeline' | 'items' | 'analytics';
