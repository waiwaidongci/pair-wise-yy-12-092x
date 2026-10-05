// ============ 领域模型 ============

export type HoofPos = "LF" | "RF" | "LH" | "RH";

/** 马匹档案 */
export interface HorseProfile {
  horseId: string;
  name: string;
  category: "运动马" | "休养马";
  breed: string;
  gaitIssue: string; // 步态问题
  hoofAssessment: string; // 蹄形评估
  abnormalGait: boolean; // 异常步态标记
}

/** 比赛报名（带单调版本号，乐观并发的依据） */
export interface RaceEntry {
  id: string;
  horseId: string;
  raceNo: string;
  raceName: string;
  jockey: string;
  status: "已报名" | "候补" | "退赛";
  version: number;
  updatedAt: number;
}

/** 蹄铁更换历史（append-only） */
export interface ShoeChange {
  id: string;
  horseId: string;
  date: string;
  shoeType: string;
  nailPositions: string;
  note: string;
}

export interface RecheckState {
  date: string; // 下次复查日期
  version: number;
  updatedAt: number;
}

export interface BannedState {
  version: number;
  items: string[]; // 禁用蹄铁清单
  updatedAt: number;
}

export interface HoofNote {
  condition: string; // 蹄况
  note: string; // 备注/照片
}

export type HoofMap = Record<HoofPos, HoofNote>;

/** 蹄铁师现场登记的一次蹄部检查 */
export interface Inspection {
  gaitIssue: string;
  hoofAssessment: string;
  abnormalGait: boolean;
  shoeType: string;
  nailPositions: string;
  recheckDate: string; // 现场给出的下次复查日期
  photoNote: string;
  hooves: HoofMap; // 左前/右前/左后/右后 对比
}

export type ClearanceResult = "放行" | "不予放行";

export interface VersionBase {
  entry: number; // 报名版本
  banned: number; // 禁用蹄铁清单版本
  recheck: number; // 该马复查日期版本
}

/** 现场（断网）登记记录：带报名等版本快照 */
export interface FieldRecord {
  clientId: string; // 记录级幂等键
  batchId: string; // 所属现场批次
  horseId: string;
  entryId: string;
  createdAt: number;
  inspectionDate: string; // 检查日期（蹄铁更换日期）
  inspection: Inspection;
  shoeType: string;
  result: ClearanceResult;
  reason: string;
  recheckDate: string;
  base: VersionBase; // 断网时看到的版本
  snapshotShoeBanned: boolean; // 快照里该蹄铁是否被禁用
  entrySnapshot: Pick<RaceEntry, "raceNo" | "raceName" | "jockey" | "status">;
}

/** 服务器台账里的放行结论 */
export interface ClearanceDecision extends FieldRecord {
  appliedAt: number;
  status: "有效" | "失效";
  invalidReason?: string;
  invalidatedAt?: number;
  serverNote?: string;
}

/** 同一报名版本两边都改过 → 两份留存待裁决 */
export interface ConflictCase {
  id: string;
  horseId: string;
  openedAt: number;
  status: "待裁决" | "已裁决";
  field: FieldRecord; // 现场副本（后到，不覆盖）
  officeEntryVersion: number; // 办公室当前报名版本
  resolution?: "采用现场版" | "采用办公室版";
  resolvedAt?: number;
  note?: string;
}

export interface BatchResult {
  accepted: string[];
  conflicts: string[];
  invalidated: string[];
  duplicate: boolean;
}

export interface AppliedBatch {
  batchId: string;
  at: number;
  result: BatchResult;
}

export interface AuditLine {
  at: number;
  text: string;
  kind: "info" | "office" | "sync" | "conflict" | "invalid" | "ok";
}

export interface ServerState {
  horses: HorseProfile[];
  entries: RaceEntry[];
  shoeHistory: ShoeChange[];
  rechecks: Record<string, RecheckState>;
  banned: BannedState;
  ledger: ClearanceDecision[];
  conflicts: ConflictCase[];
  appliedBatches: Record<string, AppliedBatch>;
  audit: AuditLine[];
}

// ============ 现场端（蹄铁师） ============

export type NetMode = "online" | "offline";
/** 故障注入：请求未达 / 已处理但回执丢失（考验幂等重试） */
export type FailMode = "none" | "request" | "responseLost";

export interface OutboxBatch {
  batchId: string;
  createdAt: number;
  sealedAt?: number;
  records: FieldRecord[];
  status: "编辑中" | "待同步" | "同步失败" | "已同步";
  error?: string;
  resultNote?: string;
  attempts: number;
  lastAttemptAt?: number;
  lastResult?: BatchResult;
}

/** 现场端缓存的“最后一次看到的服务器快照”，离线期间冻结 */
export interface SeenSnapshot {
  at: number;
  entries: Record<
    string,
    {
      entry: RaceEntry;
      recheckDate: string;
      recheckVersion: number;
    }
  >;
  bannedVersion: number;
  bannedItems: string[];
}

export interface FieldState {
  net: NetMode;
  fail: FailMode;
  batches: OutboxBatch[];
  seen: SeenSnapshot | null;
}

export const SHOE_TYPES = ["铝蹄铁", "钢蹄铁", "塑料蹄铁", "加护蹄垫", "裸蹄（无蹄铁）"];

export const HOOF_LABELS: Record<HoofPos, string> = {
  LF: "左前蹄",
  RF: "右前蹄",
  LH: "左后蹄",
  RH: "右后蹄",
};
