// 模拟后端：localStorage 持久化，模拟网络延迟与失败
import type {
  BackendState,
  BannedShoeList,
  Clearance,
  ConflictPair,
  HoofRecord,
  Registration,
  RecheckReminder,
  SyncRequest,
  SyncResult,
} from "../types";
import { uid } from "./id";

const STORAGE_KEY = "hxyfront-62011-backend-v1";

/** 模拟网络延迟 */
const LATENCY_MS = 500;
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 同步失败注入：设为 true 时，下一次 syncBatch 会失败（用于演示重试） */
let failNextSync = false;
export function setFailNextSync(v: boolean): void {
  failNextSync = v;
}
export function getFailNextSync(): boolean {
  return failNextSync;
}

// ---------- 种子数据 ----------

function isoDate(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

function buildSeed(): BackendState {
  const horses = [
    { id: "h-18", code: "HORSE-18", name: "雷霆", breed: "温血马", coat: "骝色", owner: "张三", recheckDate: isoDate(5) },
    { id: "h-27", code: "HORSE-27", name: "闪电", breed: "纯血马", coat: "栗色", owner: "李四", recheckDate: isoDate(10) },
    { id: "h-31", code: "HORSE-31", name: "微风", breed: "阿拉伯马", coat: "青色", owner: "王五", recheckDate: isoDate(3) },
    { id: "h-05", code: "HORSE-05", name: "烈焰", breed: "温血马", coat: "红色", owner: "赵六", recheckDate: isoDate(15) },
    { id: "h-42", code: "HORSE-42", name: "星辰", breed: "纯血马", coat: "黑色", owner: "钱七", recheckDate: isoDate(8) },
  ];

  const reg = (id: string, horseId: string, shoeType: string, notes: string): Registration => ({
    id,
    horseId,
    eventName: "秋季马术赛 2026",
    version: 1,
    shoeType,
    status: "enrolled",
    notes,
    updatedAt: Date.now(),
  });

  const registrations = [
    reg("r-18", "h-18", "铝蹄铁", ""),
    reg("r-27", "h-27", "加护蹄垫", "后蹄裂纹恢复期"),
    reg("r-31", "h-31", "橡胶蹄铁", "步态不稳需关注"),
    reg("r-05", "h-05", "铝蹄铁", ""),
    reg("r-42", "h-42", "铁蹄", ""),
  ];

  const bannedList: BannedShoeList = {
    version: 1,
    items: ["重型铁蹄", "带钉蹄铁"],
    updatedAt: Date.now(),
  };

  const reminders: RecheckReminder[] = [
    { id: "rm-1", horseId: "h-18", dueDate: isoDate(5), reason: "右前蹄外侧磨耗复查", resolved: false, createdAt: Date.now() },
    { id: "rm-2", horseId: "h-31", dueDate: isoDate(3), reason: "步态轻微不稳复查", resolved: false, createdAt: Date.now() },
  ];

  const mkRecord = (
    id: string,
    horseId: string,
    registrationId: string,
    registrationVersion: number,
    shoeType: string,
    gaitIssue: string,
    hoofAssessment: string,
    nailPosition: string,
    trimDate: string,
    nextRecheckDate: string,
    abnormalGait: boolean,
    photoNote: string,
    daysAgo: number,
  ): HoofRecord => ({
    id,
    clientRecordId: `seed-${id}`,
    horseId,
    registrationId,
    registrationVersion,
    gaitIssue,
    hoofAssessment,
    shoeType,
    nailPosition,
    trimDate,
    nextRecheckDate,
    photoNote,
    abnormalGait,
    requestClearance: false,
    createdAt: Date.now() - daysAgo * 86400000,
    createdBy: "farrier",
    synced: true,
    conflict: false,
  });

  const records: HoofRecord[] = [
    mkRecord("rec-18", "h-18", "r-18", 1, "铝蹄铁", "右前蹄外侧磨耗", "蹄形偏平", "前蹄钉位", isoDate(-15), isoDate(5), false, "右前蹄外侧磨耗照片已归档", 15),
    mkRecord("rec-27", "h-27", "r-27", 1, "加护蹄垫", "后蹄裂纹", "蹄形正常", "后蹄钉位", isoDate(-20), isoDate(10), false, "拍照归档", 20),
    mkRecord("rec-31", "h-31", "r-31", 1, "橡胶蹄铁", "步态轻微不稳", "蹄形偏斜", "前蹄钉位", isoDate(-25), isoDate(3), true, "需教练复核", 25),
  ];

  const clearances: Clearance[] = [
    {
      id: "cl-18",
      horseId: "h-18",
      registrationId: "r-18",
      result: "approved",
      basedOnBannedListVersion: 1,
      basedOnRecheckDate: isoDate(5),
      recordId: "rec-18",
      clientRecordId: "seed-rec-18",
      issuedAt: Date.now() - 14 * 86400000,
      valid: true,
    },
    {
      id: "cl-27",
      horseId: "h-27",
      registrationId: "r-27",
      result: "approved",
      basedOnBannedListVersion: 1,
      basedOnRecheckDate: isoDate(10),
      recordId: "rec-27",
      clientRecordId: "seed-rec-27",
      issuedAt: Date.now() - 19 * 86400000,
      valid: true,
    },
    {
      id: "cl-31",
      horseId: "h-31",
      registrationId: "r-31",
      result: "rejected",
      basedOnBannedListVersion: 1,
      basedOnRecheckDate: isoDate(3),
      recordId: "rec-31",
      clientRecordId: "seed-rec-31",
      issuedAt: Date.now() - 24 * 86400000,
      valid: true,
    },
  ];

  return {
    horses,
    registrations,
    bannedList,
    reminders,
    records,
    conflicts: [],
    clearances,
    processedClientRecordIds: records.map((r) => r.clientRecordId),
    processedBatchIds: [],
    lastUpdated: Date.now(),
  };
}

function loadState(): BackendState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BackendState;
      // 兼容：补齐字段
      return {
        ...buildSeed(),
        ...parsed,
        bannedList: { ...parsed.bannedList },
      };
    }
  } catch {
    // ignore
  }
  return buildSeed();
}

function saveState(state: BackendState): void {
  state.lastUpdated = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** 计算放行结论是否仍有效 */
function computeClearanceValidity(
  clearance: Clearance,
  bannedList: BannedShoeList,
  recheckDate: string,
): { valid: boolean; invalidReason?: string } {
  const bannedOk = clearance.basedOnBannedListVersion === bannedList.version;
  const recheckOk = clearance.basedOnRecheckDate === recheckDate;
  if (bannedOk && recheckOk) return { valid: true };
  const reasons: string[] = [];
  if (!bannedOk) reasons.push(`禁用蹄铁清单已更新至 v${bannedList.version}`);
  if (!recheckOk) reasons.push(`复查日期已变更为 ${recheckDate}`);
  return { valid: false, invalidReason: reasons.join("；") };
}

/** 为 state 中的所有放行结论重算有效性（就地修改） */
function recomputeAllClearanceValidity(state: BackendState): void {
  for (const c of state.clearances) {
    const horse = state.horses.find((h) => h.id === c.horseId);
    if (!horse) continue;
    const { valid, invalidReason } = computeClearanceValidity(c, state.bannedList, horse.recheckDate);
    c.valid = valid;
    c.invalidReason = invalidReason;
  }
}

// ---------- 对外 API ----------

export interface BackendView extends BackendState {
  /** 携带运行时计算后的放行结论（valid 字段已重算） */
  clearances: Clearance[];
}

/** 获取当前服务器状态（含运行时放行有效性） */
export async function getState(): Promise<BackendView> {
  await delay(LATENCY_MS / 2);
  const state = loadState();
  recomputeAllClearanceValidity(state);
  return state;
}

/** 同步现场批次（幂等 + 冲突检测） */
export async function syncBatch(req: SyncRequest): Promise<SyncResult> {
  await delay(LATENCY_MS);
  if (failNextSync) {
    failNextSync = false;
    throw new Error("模拟网络故障：同步失败，请重试现场批次");
  }

  const state = loadState();
  const result: SyncResult = {
    batchId: req.batchId,
    processed: [],
    deduped: [],
    conflicts: [],
    clearances: [],
  };

  // 批次幂等：整批已处理则直接返回上次结果（这里简化为去重记录）
  const batchAlreadyProcessed = state.processedBatchIds.includes(req.batchId);

  for (const record of req.records) {
    // 记录幂等：重传不重复处理
    if (state.processedClientRecordIds.includes(record.clientRecordId)) {
      result.deduped.push(record.clientRecordId);
      continue;
    }

    const reg = state.registrations.find((r) => r.id === record.registrationId);
    if (!reg) {
      // 报名不存在：仍标记为已处理，避免卡死
      state.processedClientRecordIds.push(record.clientRecordId);
      result.processed.push(record.clientRecordId);
      continue;
    }

    if (record.registrationVersion === reg.version) {
      // 版本一致：干净合并
      applyRecord(state, record, reg);
      record.synced = true;
      state.records.push(record);
      state.processedClientRecordIds.push(record.clientRecordId);
      result.processed.push(record.clientRecordId);

      // 申请放行：幂等出具放行结论
      if (record.requestClearance) {
        const clearance = issueClearanceForRecord(state, record);
        if (clearance) result.clearances.push(clearance.clientRecordId);
      }
    } else if (record.registrationVersion < reg.version) {
      // 同一报名版本被两边改过：留两份待裁决，后到记录不覆盖
      const conflict = createConflict(state, record, reg);
      record.synced = true;
      record.conflict = true;
      record.conflictPairId = conflict.id;
      state.records.push(record);
      state.processedClientRecordIds.push(record.clientRecordId);
      result.conflicts.push(record.clientRecordId);
    } else {
      // record.registrationVersion > reg.version：理论上不应发生，仍按冲突处理
      const conflict = createConflict(state, record, reg);
      record.synced = true;
      record.conflict = true;
      record.conflictPairId = conflict.id;
      state.records.push(record);
      state.processedClientRecordIds.push(record.clientRecordId);
      result.conflicts.push(record.clientRecordId);
    }
  }

  if (!batchAlreadyProcessed) {
    state.processedBatchIds.push(req.batchId);
  }

  recomputeAllClearanceValidity(state);
  saveState(state);
  return result;
}

/** 干净合并：应用记录对报名和马匹的修改 */
function applyRecord(state: BackendState, record: HoofRecord, reg: Registration): void {
  // 应用蹄铁师对报名的修改
  if (record.registrationPatch) {
    if (record.registrationPatch.shoeType !== undefined) reg.shoeType = record.registrationPatch.shoeType;
    if (record.registrationPatch.status !== undefined) reg.status = record.registrationPatch.status;
    if (record.registrationPatch.notes !== undefined) reg.notes = record.registrationPatch.notes;
  }
  // 检查记录本身携带的蹄铁类型也同步到报名
  if (record.shoeType) reg.shoeType = record.shoeType;
  reg.version += 1;
  reg.updatedAt = Date.now();

  // 更新马匹复查日期
  const horse = state.horses.find((h) => h.id === record.horseId);
  if (horse && record.nextRecheckDate) {
    horse.recheckDate = record.nextRecheckDate;
  }

  // 复查提醒：标记已解决
  if (horse) {
    for (const r of state.reminders) {
      if (r.horseId === horse.id && !r.resolved) r.resolved = true;
    }
  }
}

/** 创建冲突对：秘书侧副本（当前） + 蹄铁师侧副本（离线版本 + 离线修改） */
function createConflict(state: BackendState, record: HoofRecord, currentReg: Registration): ConflictPair {
  // 蹄铁师侧副本：基于离线时的报名版本，应用离线修改
  const farrierCopy: Registration = {
    ...currentReg,
    version: record.registrationVersion,
    updatedAt: record.createdAt,
  };
  if (record.registrationPatch) {
    if (record.registrationPatch.shoeType !== undefined) farrierCopy.shoeType = record.registrationPatch.shoeType;
    if (record.registrationPatch.status !== undefined) farrierCopy.status = record.registrationPatch.status;
    if (record.registrationPatch.notes !== undefined) farrierCopy.notes = record.registrationPatch.notes;
  }
  if (record.shoeType) farrierCopy.shoeType = record.shoeType;

  const conflict: ConflictPair = {
    id: uid(),
    registrationId: currentReg.id,
    baseVersion: record.registrationVersion,
    secretaryCopy: { ...currentReg },
    farrierCopy,
    farrierRecordId: record.id,
    status: "pending",
    createdAt: Date.now(),
  };
  state.conflicts.push(conflict);
  return conflict;
}

/** 为记录出具放行结论（幂等：同一 clientRecordId 只出一次） */
function issueClearanceForRecord(state: BackendState, record: HoofRecord): Clearance | null {
  // 幂等：已存在则不重复出具
  const existing = state.clearances.find((c) => c.clientRecordId === record.clientRecordId);
  if (existing) return existing;

  const horse = state.horses.find((h) => h.id === record.horseId);
  if (!horse) return null;

  const result: Clearance["result"] =
    record.abnormalGait || state.bannedList.items.includes(record.shoeType) ? "rejected" : "approved";

  const clearance: Clearance = {
    id: uid(),
    horseId: record.horseId,
    registrationId: record.registrationId,
    result,
    basedOnBannedListVersion: state.bannedList.version,
    basedOnRecheckDate: horse.recheckDate,
    recordId: record.id,
    clientRecordId: record.clientRecordId,
    issuedAt: Date.now(),
    valid: true,
  };
  state.clearances.push(clearance);
  return clearance;
}

/** 秘书修改报名（在线）：版本 +1 */
export async function updateRegistration(registrationId: string, patch: Partial<Pick<Registration, "shoeType" | "status" | "notes">>): Promise<BackendView> {
  await delay(LATENCY_MS / 2);
  const state = loadState();
  const reg = state.registrations.find((r) => r.id === registrationId);
  if (reg) {
    if (patch.shoeType !== undefined) reg.shoeType = patch.shoeType;
    if (patch.status !== undefined) reg.status = patch.status;
    if (patch.notes !== undefined) reg.notes = patch.notes;
    reg.version += 1;
    reg.updatedAt = Date.now();
  }
  recomputeAllClearanceValidity(state);
  saveState(state);
  return state;
}

/** 秘书修改禁用蹄铁清单：版本 +1，全部放行结论立即失效 */
export async function updateBannedList(items: string[]): Promise<BackendView> {
  await delay(LATENCY_MS / 2);
  const state = loadState();
  state.bannedList.items = items;
  state.bannedList.version += 1;
  state.bannedList.updatedAt = Date.now();
  recomputeAllClearanceValidity(state);
  saveState(state);
  return state;
}

/** 秘书调整复查日期：该马匹放行结论立即失效 */
export async function updateRecheckDate(horseId: string, recheckDate: string): Promise<BackendView> {
  await delay(LATENCY_MS / 2);
  const state = loadState();
  const horse = state.horses.find((h) => h.id === horseId);
  if (horse) {
    horse.recheckDate = recheckDate;
    // 同步更新未解决的复查提醒
    for (const r of state.reminders) {
      if (r.horseId === horseId && !r.resolved) r.dueDate = recheckDate;
    }
  }
  recomputeAllClearanceValidity(state);
  saveState(state);
  return state;
}

/** 裁决冲突：选择秘书侧或蹄铁师侧副本 */
export async function adjudicate(conflictId: string, choice: "secretary" | "farrier"): Promise<BackendView> {
  await delay(LATENCY_MS / 2);
  const state = loadState();
  const conflict = state.conflicts.find((c) => c.id === conflictId);
  if (conflict && conflict.status === "pending") {
    conflict.status = "resolved";
    conflict.resolution = choice;
    const reg = state.registrations.find((r) => r.id === conflict.registrationId);
    if (reg) {
      const chosen = choice === "secretary" ? conflict.secretaryCopy : conflict.farrierCopy;
      reg.shoeType = chosen.shoeType;
      reg.status = chosen.status;
      reg.notes = chosen.notes;
      reg.version += 1;
      reg.updatedAt = Date.now();
    }
    // 标记冲突记录已解决
    const record = state.records.find((r) => r.conflictPairId === conflictId);
    if (record) record.conflict = false;
  }
  recomputeAllClearanceValidity(state);
  saveState(state);
  return state;
}

/** 出具放行结论（在线，秘书从放行台操作） */
export async function issueClearance(horseId: string, recordId: string): Promise<BackendView> {
  await delay(LATENCY_MS / 2);
  const state = loadState();
  const record = state.records.find((r) => r.id === recordId && r.horseId === horseId);
  if (record) {
    issueClearanceForRecord(state, record);
  }
  recomputeAllClearanceValidity(state);
  saveState(state);
  return state;
}

/** 要求重检：创建复查提醒，放行结论失效（通过更新复查日期触发） */
export async function requestRecheck(horseId: string, reason: string): Promise<BackendView> {
  await delay(LATENCY_MS / 2);
  const state = loadState();
  const horse = state.horses.find((h) => h.id === horseId);
  if (horse) {
    // 将复查日期推后一天（模拟重检安排），触发放行失效
    const d = new Date(horse.recheckDate);
    d.setDate(d.getDate() + 1);
    horse.recheckDate = d.toISOString().slice(0, 10);
    state.reminders.push({
      id: uid(),
      horseId,
      dueDate: horse.recheckDate,
      reason,
      resolved: false,
      createdAt: Date.now(),
    });
  }
  recomputeAllClearanceValidity(state);
  saveState(state);
  return state;
}

/** 重置后端数据（演示用） */
export async function resetBackend(): Promise<BackendView> {
  localStorage.removeItem(STORAGE_KEY);
  return getState();
}
