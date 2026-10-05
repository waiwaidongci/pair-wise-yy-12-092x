import type {
  ClearanceResult,
  FailMode,
  FieldRecord,
  FieldState,
  Inspection,
  NetMode,
  OutboxBatch,
  SeenSnapshot,
  VersionBase,
} from "../types";
import { getServer, receiveBatch, serverSnapshotForField } from "./serverStore";
import { clone, TODAY, uid } from "./utils";

const LS_KEY = "hxyfront-62011-field-v1";
const listeners = new Set<() => void>();

let state: FieldState = load();

function load(): FieldState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as FieldState;
  } catch {
    /* ignore */
  }
  return { net: "online", fail: "none", batches: [], seen: buildSeen() };
}

function persist() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

export function getField(): FieldState {
  return state;
}

export function subscribeField(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function resetField() {
  state = { net: "online", fail: "none", batches: [], seen: buildSeen() };
  emit();
}

// ============ 网络 / 故障模拟 ============

export function setNet(net: NetMode) {
  state.net = net;
  if (net === "online") refreshSeen();
  emit();
}

export function setFailMode(fail: FailMode) {
  state.fail = fail;
  emit();
}

/** 刷新“最后看到的服务器快照”；离线期间冻结，不调用 */
export function refreshSeen() {
  if (state.net !== "online") return;
  state.seen = buildSeen();
  emit();
}

function buildSeen(): SeenSnapshot {
  const snap = serverSnapshotForField();
  const entries: SeenSnapshot["entries"] = {};
  for (const e of snap.entries) {
    const rc = snap.rechecks[e.horseId];
    entries[e.id] = {
      entry: e,
      recheckDate: rc?.date ?? TODAY,
      recheckVersion: rc?.version ?? 1,
    };
  }
  return {
    at: Date.now(),
    entries,
    bannedVersion: snap.banned.version,
    bannedItems: snap.banned.items,
  };
}

// ============ 断网登记 ============

export interface DraftInput {
  entryId: string;
  inspection: Inspection;
  result: ClearanceResult;
  reason: string;
}

function currentBatch(): OutboxBatch {
  let b = state.batches.find((x) => x.status === "编辑中");
  if (!b) {
    b = { batchId: uid("BATCH"), createdAt: Date.now(), records: [], status: "编辑中", attempts: 0 };
    state.batches.unshift(b);
  }
  return b;
}

/** 依据现场快照推导放行结论（现场可人工覆盖） */
export function suggestClearance(entryId: string, shoeType: string, abnormalGait: boolean, recheckDate: string): { result: ClearanceResult; reason: string } {
  const seen = state.seen?.entries[entryId];
  const banned = state.seen?.bannedItems.includes(shoeType) ?? false;
  const reasons: string[] = [];
  if (banned) reasons.push(`${shoeType} 在禁用蹄铁清单 v${state.seen?.bannedVersion} 中`);
  if (abnormalGait) reasons.push("存在异常步态标记");
  const days = Math.round((new Date(recheckDate + "T00:00:00").getTime() - new Date(TODAY + "T00:00:00").getTime()) / 86400000);
  if (days < 0) reasons.push(`复查日期已逾期（${recheckDate}）`);
  if (!seen) reasons.push("缺少服务器快照（建议先联网刷新）");
  if (reasons.length) return { result: "不予放行", reason: reasons.join("；") };
  return { result: "放行", reason: "蹄况正常，复查在期内，蹄铁未禁用" };
}

/** 登记一条蹄部检查记录（离线可写），写入现场批次，携带报名版本快照 */
export function addFieldRecord(input: DraftInput): FieldRecord {
  const seen = state.seen?.entries[input.entryId];
  const entry = seen?.entry;
  const base: VersionBase = {
    entry: entry?.version ?? 1,
    banned: state.seen?.bannedVersion ?? 1,
    recheck: seen?.recheckVersion ?? 1,
  };
  const rec: FieldRecord = {
    clientId: uid("REC"),
    batchId: "",
    horseId: entry?.horseId ?? "",
    entryId: input.entryId,
    createdAt: Date.now(),
    inspectionDate: TODAY,
    inspection: input.inspection,
    shoeType: input.inspection.shoeType,
    result: input.result,
    reason: input.reason,
    recheckDate: input.inspection.recheckDate,
    base,
    snapshotShoeBanned: state.seen?.bannedItems.includes(input.inspection.shoeType) ?? false,
    entrySnapshot: entry
      ? { raceNo: entry.raceNo, raceName: entry.raceName, jockey: entry.jockey, status: entry.status }
      : { raceNo: "?", raceName: "未知报名", jockey: "?", status: "候补" },
  };
  const b = currentBatch();
  rec.batchId = b.batchId;
  b.records.push(rec);
  emit();
  return rec;
}

/** 封批：之后不可再写，可重试同步 */
export function sealBatch(batchId: string) {
  const b = state.batches.find((x) => x.batchId === batchId);
  if (!b || b.status !== "编辑中" || b.records.length === 0) return;
  b.status = "待同步";
  b.sealedAt = Date.now();
  emit();
}

export function discardBatch(batchId: string) {
  state.batches = state.batches.filter((b) => b.batchId !== batchId);
  emit();
}

// ============ 回网合并（可重试，幂等） ============

export interface SyncOutcome {
  ok: boolean;
  duplicate?: boolean;
  message: string;
}

/**
 * 同步一个已封批批次。
 * - 离线 → 直接排队待回网；
 * - fail=request → 请求未达，批次保持失败可重试，服务器无副作用；
 * - fail=responseLost → 服务器已处理但回执丢失，重试命中 batchId 幂等，不重复扣记录。
 */
export function syncBatch(batchId: string): SyncOutcome {
  const b = state.batches.find((x) => x.batchId === batchId);
  if (!b) return { ok: false, message: "批次不存在" };
  if (b.status === "编辑中") return { ok: false, message: "批次尚未封批" };

  b.attempts += 1;
  b.lastAttemptAt = Date.now();

  if (state.net === "offline") {
    b.status = "待同步";
    b.error = "现场仍断网，批次排队等待回网";
    emit();
    return { ok: false, message: b.error };
  }

  if (state.fail === "request") {
    b.status = "同步失败";
    b.error = "网络故障：请求未到达服务器（可重试，服务器尚无此批次）";
    emit();
    return { ok: false, message: b.error };
  }

  let resp;
  try {
    resp = receiveBatch(b.batchId, clone(b.records));
  } catch (e) {
    b.status = "同步失败";
    b.error = "服务器异常：" + (e as Error).message;
    emit();
    return { ok: false, message: b.error };
  }

  if (state.fail === "responseLost") {
    // 服务器已处理，但现场没收到回执；现场视为失败、允许重试
    b.status = "同步失败";
    b.error = "回执丢失：服务器可能已处理，请重试（重传将命中幂等）";
    emit();
    return { ok: false, message: b.error };
  }

  b.status = "已同步";
  b.error = undefined;
  b.lastResult = resp.summary;
  const s = resp.summary;
  const dup = s.duplicate;
  b.resultNote =
    (dup ? "幂等重传：回放首次结果，未重复扣记录；" : "") +
    `落账 ${s.accepted.length} 条` +
    (s.invalidated.length ? `（其中 ${s.invalidated.length} 条因依据变更失效）` : "") +
    (s.conflicts.length ? `，冲突待裁决 ${s.conflicts.length} 条` : "");
  // 同步成功后刷新快照
  state.seen = buildSeen();
  emit();
  return { ok: true, duplicate: dup, message: b.resultNote };
}

/** 一键合并所有待同步/失败批次（回网后使用） */
export function syncAllPending(): { tried: number; ok: number } {
  const targets = state.batches.filter((b) => b.status === "待同步" || b.status === "同步失败");
  let ok = 0;
  for (const b of targets) {
    if (syncBatch(b.batchId).ok) ok += 1;
  }
  return { tried: targets.length, ok };
}

export function pendingCount(): number {
  return state.batches.filter((b) => b.status === "待同步" || b.status === "同步失败").length;
}

export { getServer };
