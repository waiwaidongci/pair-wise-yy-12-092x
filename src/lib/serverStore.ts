import type {
  AuditLine,
  BannedState,
  BatchResult,
  ClearanceDecision,
  ConflictCase,
  FieldRecord,
  RaceEntry,
  ServerState,
} from "../types";
import { buildSeed } from "./seed";
import { clone, fmtTime, uid } from "./utils";

const LS_KEY = "hxyfront-62011-server-v1";
const listeners = new Set<() => void>();

let state: ServerState = load();

function load(): ServerState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as ServerState;
  } catch {
    /* ignore */
  }
  return buildSeed();
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

function audit(text: string, kind: AuditLine["kind"]) {
  state.audit.unshift({ at: Date.now(), text, kind });
  if (state.audit.length > 120) state.audit.length = 120;
}

export function getServer(): ServerState {
  return state;
}

export function subscribeServer(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function resetServer() {
  state = buildSeed();
  audit("数据已重置为演示初始状态", "info");
  emit();
}

export function serverSnapshotForField(): {
  entries: ServerState["entries"];
  rechecks: ServerState["rechecks"];
  banned: BannedState;
} {
  return {
    entries: clone(state.entries),
    rechecks: clone(state.rechecks),
    banned: clone(state.banned),
  };
}

// ============ 台账失效 ============

function invalidateDecisions(predicate: (d: ClearanceDecision) => string | null, tag: string) {
  let n = 0;
  for (const d of state.ledger) {
    if (d.status !== "有效") continue;
    const reason = predicate(d);
    if (reason) {
      d.status = "失效";
      d.invalidReason = reason;
      d.invalidatedAt = Date.now();
      n++;
    }
  }
  if (n > 0) audit(`${tag}：${n} 条放行结论立即失效，要求重检`, "invalid");
  return n;
}

// ============ 赛事秘书办公室操作 ============

/** 修改报名；版本单调递增，回网现场记录若基于旧版本会产生冲突 */
export function officeEditEntry(id: string, patch: Partial<Pick<RaceEntry, "raceNo" | "raceName" | "jockey" | "status">>) {
  const e = state.entries.find((x) => x.id === id);
  if (!e) return;
  const changed = (Object.keys(patch) as (keyof typeof patch)[]).some((k) => patch[k] !== undefined && patch[k] !== e[k]);
  if (!changed) return;
  Object.assign(e, patch);
  e.version += 1;
  e.updatedAt = Date.now();
  audit(`办公室修改报名 ${e.raceNo} / ${state.horses.find((h) => h.horseId === e.horseId)?.horseId} → 报名版本 v${e.version}`, "office");
  emit();
}

/** 修改禁用蹄铁清单：版本一变，使用“禁用状态发生翻转”蹄铁的放行结论立即失效 */
export function officeSetBanned(items: string[]) {
  const before = new Set(state.banned.items);
  const after = new Set(items);
  const flipped: string[] = [];
  for (const s of new Set([...before, ...after])) {
    if (before.has(s) !== after.has(s)) flipped.push(s);
  }
  if (flipped.length === 0) return;
  state.banned = { version: state.banned.version + 1, items: [...items].sort(), updatedAt: Date.now() };
  audit(`办公室更新禁用蹄铁清单 v${state.banned.version}：${flipped.map((s) => `${s}${after.has(s) ? "新增禁用" : "解除禁用"}`).join("、")}`, "office");
  invalidateDecisions((d) => {
    if (flipped.includes(d.shoeType)) return `禁用蹄铁清单变更至 v${state.banned.version}（${d.shoeType} 禁用状态翻转），结论失效，要求重检`;
    return null;
  }, `禁用清单 v${state.banned.version}`);
  emit();
}

/** 修改某匹马的复查日期：版本一变，该马全部有效放行结论立即失效 */
export function officeSetRecheck(horseId: string, date: string) {
  const cur = state.rechecks[horseId];
  if (cur && cur.date === date) return;
  const nv = cur ? cur.version + 1 : 1;
  state.rechecks[horseId] = { date, version: nv, updatedAt: Date.now() };
  audit(`办公室调整 ${horseId} 复查日期为 ${date} → 复查版本 v${nv}`, "office");
  invalidateDecisions((d) => {
    if (d.horseId === horseId) return `复查日期变更至 v${nv}（${date}），结论失效，要求重检`;
    return null;
  }, `${horseId} 复查日期变更`);
  emit();
}

// ============ 回网合并 ============

/** 接收一条现场记录（报名版本一致时） */
function acceptRecord(rec: FieldRecord, result: { invalidated: string[] }) {
  const nowTs = Date.now();
  const bannedAfter = state.banned.items.includes(rec.shoeType);
  const recheck = state.rechecks[rec.horseId];
  const recheckDateAfter = recheck?.date ?? rec.recheckDate;
  const recheckVersionAfter = recheck?.version ?? rec.base.recheck;

  // 办公室是否在现场登记之后推进过复查版本（版本对不上 → 现场依据过期）
  const officeMovedRecheck = recheckVersionAfter !== rec.base.recheck;

  // 现场给出新复查日期：仅在办公室未改过（版本仍是现场基线）时采纳，否则后到不覆盖
  let recheckApplied = false;
  let finalRecheckVersion = recheckVersionAfter;
  if (rec.recheckDate && rec.recheckDate !== recheckDateAfter && !officeMovedRecheck) {
    finalRecheckVersion = recheckVersionAfter + 1;
    state.rechecks[rec.horseId] = {
      date: rec.recheckDate,
      version: finalRecheckVersion,
      updatedAt: nowTs,
    };
    recheckApplied = true;
  }

  const reasons: string[] = [];
  if (rec.snapshotShoeBanned !== bannedAfter) {
    reasons.push(
      bannedAfter
        ? `禁用蹄铁清单已变更至 v${state.banned.version}：${rec.shoeType} 现被禁用`
        : `禁用蹄铁清单已变更至 v${state.banned.version}：${rec.shoeType} 已解除禁用，请按最新清单复核`
    );
  }
  if (officeMovedRecheck) {
    reasons.push(`复查日期已被办公室变更为 ${recheckDateAfter}（复查版本 v${recheckVersionAfter}），现场依据 v${rec.base.recheck} 已过期`);
  }
  const invalid = reasons.length > 0;

  // 现场复查日期被采纳 → 该马既往放行结论同样因复查版本推进而失效（新结论本身不失效）
  if (recheckApplied) {
    let n = 0;
    for (const d of state.ledger) {
      if (d.status === "有效" && d.horseId === rec.horseId && d.clientId !== rec.clientId) {
        d.status = "失效";
        d.invalidReason = `复查日期更新为 ${rec.recheckDate}（复查版本 v${finalRecheckVersion}），既往结论失效，要求重检`;
        d.invalidatedAt = nowTs;
        n++;
      }
    }
    if (n > 0) audit(`${rec.horseId} 复查日期按现场建议更新：${n} 条旧放行结论失效，要求重检`, "invalid");
  }

  const decision: ClearanceDecision = {
    ...clone(rec),
    base: {
      entry: rec.base.entry,
      banned: state.banned.version,
      recheck: finalRecheckVersion,
    },
    appliedAt: nowTs,
    status: invalid ? "失效" : "有效",
    invalidReason: invalid ? reasons.join("；") + "，要求重检" : undefined,
    invalidatedAt: invalid ? nowTs : undefined,
    serverNote: invalid ? "合并时发现依据已过期" : undefined,
  };
  state.ledger.push(decision);
  if (invalid) result.invalidated.push(rec.clientId);

  // 蹄铁更换历史 append（以 clientId 去重；失败重试不会重放至此，落账仅一次）
  if (!state.shoeHistory.some((s) => s.note.includes(rec.clientId))) {
    state.shoeHistory.push({
      id: uid("SC"),
      horseId: rec.horseId,
      date: rec.inspectionDate,
      shoeType: rec.shoeType,
      nailPositions: rec.inspection.nailPositions || "未记录",
      note: `回网批次 ${rec.batchId} · ${rec.clientId}`,
    });
  }

  return decision;
}

/** 打开冲突：两份副本都保留，后到的现场记录绝不覆盖办公室数据 */
function openConflict(rec: FieldRecord, serverEntry: RaceEntry): string {
  const id = uid("CF");
  const c: ConflictCase = {
    id,
    horseId: rec.horseId,
    openedAt: Date.now(),
    status: "待裁决",
    field: clone(rec),
    officeEntryVersion: serverEntry.version,
  };
  state.conflicts.unshift(c);
  audit(
    `冲突：${rec.horseId} 现场记录基于报名 v${rec.base.entry}，办公室已改至 v${serverEntry.version} → 两份留存待裁决（后到不覆盖）`,
    "conflict"
  );
  return id;
}

export interface RecvOutcome {
  status: "accepted" | "conflict" | "duplicate";
  conflictId?: string;
  decision?: ClearanceDecision;
  invalid?: boolean;
}

export interface RecvBatchResponse {
  batchId: string;
  results: RecvOutcome[];
  summary: BatchResult;
}

/**
 * 回网合并一个现场批次。
 * - batchId 幂等：已处理过的批次原样返回结果，不重复生成放行记录；
 * - 同一报名版本两边都改 → 冲突两份留存；
 * - 依据版本（禁用清单 / 复查日期）变化 → 结论落账即失效并要求重检。
 */
export function receiveBatch(batchId: string, records: FieldRecord[]): RecvBatchResponse {
  // 幂等：重试/回执丢失后的重传直接回放首次结果
  const seen = state.appliedBatches[batchId];
  if (seen) {
    return replayBatch(batchId, records, true);
  }

  const results: RecvOutcome[] = [];
  const summary: BatchResult = { accepted: [], conflicts: [], invalidated: [], duplicate: false };
  const seenClientIds = new Set<string>();

  for (const rec of records) {
    // 记录级去重（同一批次内或历史台账）
    if (seenClientIds.has(rec.clientId) || state.ledger.some((d) => d.clientId === rec.clientId)) {
      results.push({ status: "duplicate" });
      continue;
    }
    seenClientIds.add(rec.clientId);

    const entry = state.entries.find((e) => e.id === rec.entryId);
    if (!entry) {
      // 报名已不存在，按冲突处理，保留现场副本
      const ghost: RaceEntry = {
        id: rec.entryId,
        horseId: rec.horseId,
        ...rec.entrySnapshot,
        version: rec.base.entry,
        updatedAt: 0,
      };
      const conflictId = openConflict(rec, ghost);
      summary.conflicts.push(rec.clientId);
      results.push({ status: "conflict", conflictId });
      continue;
    }

    // 乐观并发：现场基于的报名版本 ≠ 服务器当前版本 → 两份待裁决，后到不覆盖
    if (entry.version !== rec.base.entry) {
      const conflictId = openConflict(rec, entry);
      summary.conflicts.push(rec.clientId);
      results.push({ status: "conflict", conflictId });
      continue;
    }

    const decision = acceptRecord(rec, summary);
    summary.accepted.push(rec.clientId);
    if (decision.status === "失效") {
      /* invalidated 已在 acceptRecord 中累计 */
    }
    results.push({
      status: "accepted",
      decision,
      invalid: decision.status === "失效",
    });
  }

  state.appliedBatches[batchId] = {
    batchId,
    at: Date.now(),
    result: clone(summary),
  };

  const parts: string[] = [];
  if (summary.accepted.length) parts.push(`落账 ${summary.accepted.length} 条（其中失效 ${summary.invalidated.length} 条）`);
  if (summary.conflicts.length) parts.push(`冲突待裁决 ${summary.conflicts.length} 条`);
  audit(`回网合并批次 ${batchId}：${parts.join("，") || "全部为重复记录"}`, summary.conflicts.length ? "conflict" : "sync");
  emit();
  return { batchId, results, summary };
}

/** 幂等回放：依据台账/冲突箱重建结果，绝不二次写入 */
function replayBatch(batchId: string, records: FieldRecord[], duplicate: boolean): RecvBatchResponse {
  const applied = state.appliedBatches[batchId];
  const results: RecvOutcome[] = records.map((rec) => {
    const d = state.ledger.find((x) => x.clientId === rec.clientId);
    if (d) {
      return { status: "accepted" as const, decision: d, invalid: d.status === "失效" };
    }
    const cf = state.conflicts.find((c) => c.field.clientId === rec.clientId);
    if (cf) return { status: "conflict" as const, conflictId: cf.id, invalid: false };
    return { status: "duplicate" as const, invalid: false };
  });
  audit(`批次 ${batchId} 重传：命中幂等记录，回放首次结果，未重复扣放行记录`, "sync");
  emit();
  return {
    batchId,
    results,
    summary: { ...clone(applied.result), duplicate },
  };
}

// ============ 冲突裁决 ============

export function resolveConflict(id: string, resolution: "采用现场版" | "采用办公室版") {
  const c = state.conflicts.find((x) => x.id === id);
  if (!c || c.status !== "待裁决") return;
  c.status = "已裁决";
  c.resolution = resolution;
  c.resolvedAt = Date.now();

  if (resolution === "采用现场版") {
    // 现场版落账，但必须按当前服务器依据重新校验放行结论
    const pseudo: BatchResult = { accepted: [], conflicts: [], invalidated: [], duplicate: false };
    const rec = clone(c.field);
    rec.base = { ...rec.base, entry: c.officeEntryVersion }; // 裁决后基线对齐
    const d = acceptRecord(rec, pseudo);
    d.serverNote = "冲突裁决采用现场版，已按最新依据重新校验";
    c.note = `已采用现场版并重新校验：${d.status === "有效" ? "结论有效" : "依据过期，结论失效需重检"}`;
    state.appliedBatches[`resolved-${c.id}`] = {
      batchId: `resolved-${c.id}`,
      at: Date.now(),
      result: { accepted: [rec.clientId], conflicts: [], invalidated: pseudo.invalidated, duplicate: false },
    };
    audit(`冲突 ${c.id} 裁决：采用现场版（${c.horseId}），已重新校验放行结论`, "ok");
  } else {
    c.note = "采用办公室版，现场记录不进入台账，需重新现场检查";
    audit(`冲突 ${c.id} 裁决：采用办公室版（${c.horseId}），现场副本留存归档，要求重检`, "office");
  }
  emit();
}

export { fmtTime };
