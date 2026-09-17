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

  // Operation Enriched Fields (From Week 37 Status Overview Routing & Operations)
  readyOp?: string;           // Operation ที่พร้อม/รอขึ้นทำงาน เช่น "Op 20: CNC VF4 (DEA024)"
  readyOpDesc?: string;       // ชื่อ Operation เช่น "CNC VF4", "เครื่องอัดไฮดรอลิก"
  readyOpWc?: string;         // Work Center เช่น "DEA024"
  readyOpNo?: number | string;// หมายเลข Operation เช่น 20
  hasReadyOp?: boolean;       // มี Operation ที่รอขึ้นทำงาน
  activeOp?: string;          // Operation ที่กำลังทำอยู่ เช่น "Op 10: เลื่อย (DEA011)"
  activeOpDesc?: string;      // ชื่อ Operation กำลังทำ
  activeOpWc?: string;
  activeOpNo?: number | string;
  currentOp?: string;         // สถานะขั้นตอนปัจจุบัน
  currentOpDesc?: string;
  currentOpStatus?: string;
  lastCompletedOp?: string;   // ขั้นตอนล่าสุดที่เสร็จแล้ว เช่น "Op 10"
  lastCompletedOpDesc?: string;// รายละเอียดขั้นตอนล่าสุดที่เสร็จแล้ว เช่น "CNC Laser 2"
  lastCompletedOpWc?: string;  // Work Center ขั้นตอนล่าสุดที่เสร็จแล้ว
  lastCompletedOpNo?: number | string; // เลข Op ล่าสุดที่เสร็จแล้ว เช่น 10
  isAllCompleted?: boolean;   // เสร็จสิ้นทุกขั้นตอน

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
  readyOp?: string;
  readyOpDesc?: string;
  readyOpWc?: string;
  readyOpNo?: number | string;
  hasReadyOp?: boolean;
  activeOp?: string;
  activeOpDesc?: string;
  activeOpWc?: string;
  activeOpNo?: number | string;
  currentOp?: string;
  currentOpDesc?: string;
  currentOpStatus?: string;
  lastCompletedOp?: string;
  lastCompletedOpDesc?: string;
  lastCompletedOpWc?: string;
  lastCompletedOpNo?: number | string;
  isAllCompleted?: boolean;
}

export interface MachineSummary {
  name: string;
  hasMachine: boolean;
  totalItems: number;
  deliveredItems: number;
  completedOrQcItems: number;
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
  overviewStatus?: string;  // 'all' | 'Active' | 'Planned' | 'Ready to Start' | 'Completed' | 'none'
  readyOpName?: string;     // 'all' | 'any_ready' | specific operation description e.g. 'CNC VF4'
  operationStatus?: string; // 'all' | 'ready' | 'active' | 'completed' | 'none'
}

export interface FilterState {
  searchCriteria: SearchCriteria;
  status: 'all' | 'in-progress' | 'overdue' | 'due-soon' | 'completed';
  project: string;
  sortBy: 'name' | 'urgent' | 'progress-asc' | 'progress-desc' | 'items-desc';
  viewMode: 'cards' | 'table';
}

export type ActiveTab = 'machines' | 'delivery-plan' | 'timeline' | 'items' | 'analytics';
