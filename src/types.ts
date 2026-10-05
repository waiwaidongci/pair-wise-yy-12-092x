// 马术蹄铁修整档案 · 放行台 —— 核心类型定义

/** 马匹档案 */
export interface Horse {
  id: string;
  /** 马匹编号 */
  code: string;
  /** 马名 */
  name: string;
  /** 品种 */
  breed: string;
  /** 毛色 */
  coat: string;
  /** 所属马主 */
  owner: string;
  /** 当前复查日期（由最近一次检查或秘书调整后写入） */
  recheckDate: string;
}

/** 比赛报名（带版本号，两边修改会冲突） */
export interface Registration {
  id: string;
  horseId: string;
  /** 赛事名称 */
  eventName: string;
  /** 报名版本号：每次修改 +1 */
  version: number;
  /** 蹄铁类型 */
  shoeType: string;
  /** 报名状态 */
  status: "enrolled" | "withdrawn" | "scratched";
  /** 备注 */
  notes: string;
  updatedAt: number;
}

/** 禁用蹄铁清单（带版本号，一变则全部放行失效） */
export interface BannedShoeList {
  version: number;
  /** 禁用蹄铁类型列表 */
  items: string[];
  updatedAt: number;
}

/** 复查提醒 */
export interface RecheckReminder {
  id: string;
  horseId: string;
  /** 应复查日期 */
  dueDate: string;
  /** 复查事由 */
  reason: string;
  resolved: boolean;
  createdAt: number;
}

/** 蹄部检查 / 修蹄记录（蹄铁师现场断网登记） */
export interface HoofRecord {
  id: string;
  /** 客户端生成的幂等键：重传不重复 */
  clientRecordId: string;
  horseId: string;
  registrationId: string;
  /** 登记时携带的报名版本（断网记录带报名版本） */
  registrationVersion: number;
  /** 步态问题 */
  gaitIssue: string;
  /** 蹄形评估 */
  hoofAssessment: string;
  /** 蹄铁类型 */
  shoeType: string;
  /** 钉位 */
  nailPosition: string;
  /** 修蹄日期 */
  trimDate: string;
  /** 下次复查日期 */
  nextRecheckDate: string;
  /** 照片备注 */
  photoNote: string;
  /** 异常步态标记 */
  abnormalGait: boolean;
  /** 是否申请放行（随批次幂等提交） */
  requestClearance: boolean;
  /** 蹄铁师离线时对报名的修改（基于 registrationVersion） */
  registrationPatch?: {
    shoeType?: string;
    status?: Registration["status"];
    notes?: string;
  };
  createdAt: number;
  createdBy: "farrier" | "secretary";
  /** 是否已同步到服务器 */
  synced: boolean;
  /** 是否冲突待裁决 */
  conflict: boolean;
  conflictPairId?: string;
}

/** 冲突对：同一报名版本被两边改过，留两份待裁决 */
export interface ConflictPair {
  id: string;
  registrationId: string;
  /** 冲突基于的报名版本 */
  baseVersion: number;
  /** 秘书侧副本（服务器当前版本） */
  secretaryCopy: Registration;
  /** 蹄铁师侧副本（离线版本 + 离线修改） */
  farrierCopy: Registration;
  farrierRecordId: string;
  status: "pending" | "resolved";
  resolution?: "secretary" | "farrier";
  createdAt: number;
}

/** 放行结论 */
export interface Clearance {
  id: string;
  horseId: string;
  registrationId: string;
  result: "approved" | "rejected" | "pending";
  /** 放行结论基于的禁用清单版本 */
  basedOnBannedListVersion: number;
  /** 放行结论基于的复查日期 */
  basedOnRecheckDate: string;
  /** 依据的检查记录 */
  recordId: string;
  /** 幂等键：重传不重复扣放行记录 */
  clientRecordId: string;
  issuedAt: number;
  /** 放行结论是否仍有效（运行时计算） */
  valid: boolean;
  invalidReason?: string;
}

/** 现场批次（离线队列，可重试） */
export interface SyncBatch {
  /** 客户端生成的批次幂等键 */
  id: string;
  recordIds: string[];
  /** 批次携带的完整记录（离线创建，回网后随请求发送） */
  records: HoofRecord[];
  createdAt: number;
  status: "pending" | "syncing" | "synced" | "failed";
  attempts: number;
  lastError?: string;
}

/** 同步批次请求（客户端 → 服务器） */
export interface SyncRequest {
  batchId: string;
  records: HoofRecord[];
}

/** 同步批次结果（服务器 → 客户端） */
export interface SyncResult {
  batchId: string;
  /** 已处理（合并或冲突）的记录 clientRecordId */
  processed: string[];
  /** 幂等去重的记录 clientRecordId */
  deduped: string[];
  /** 冲突待裁决的记录 clientRecordId */
  conflicts: string[];
  /** 已出具的放行记录 clientRecordId */
  clearances: string[];
}

/** 服务器状态（持久化到 localStorage） */
export interface BackendState {
  horses: Horse[];
  registrations: Registration[];
  bannedList: BannedShoeList;
  reminders: RecheckReminder[];
  records: HoofRecord[];
  conflicts: ConflictPair[];
  clearances: Clearance[];
  /** 已处理的 clientRecordId 集合（幂等） */
  processedClientRecordIds: string[];
  /** 已处理的批次 batchId 集合（幂等） */
  processedBatchIds: string[];
  lastUpdated: number;
}

/** 服务器视图：clearances 的 valid 字段已运行时重算 */
export type BackendView = BackendState;
