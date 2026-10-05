// 全局状态提供者：实现在线/断网、离线队列、同步与冲突裁决
import { useCallback, useEffect, useReducer, useRef } from "react";
import type { ReactNode } from "react";
import {
  AppContext,
  buildRecord,
  initialState,
  reducer,
  type AppContextValue,
  type CreateRecordInput,
} from "./store";
import * as backend from "./backend";
import type { Registration, SyncBatch } from "../types";
import { uid } from "./id";

const QUEUE_STORAGE_KEY = "hxyfront-62011-queue-v1";

function loadQueue(): SyncBatch[] {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SyncBatch[];
  } catch {
    // ignore
  }
  return [];
}

function saveQueue(queue: SyncBatch[]): void {
  localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // 初始化：加载服务器数据 + 离线队列
  const queueLoaded = useRef(false);
  useEffect(() => {
    let mounted = true;
    (async () => {
      dispatch({ type: "SET_LOADING", loading: true });
      try {
        const view = await backend.getState();
        if (mounted) {
          dispatch({ type: "SET_VIEW", view });
          dispatch({ type: "SET_LAST_SYNC", at: Date.now() });
        }
      } finally {
        if (mounted) dispatch({ type: "SET_LOADING", loading: false });
      }
      if (mounted) {
        dispatch({ type: "CLEAR_QUEUE" });
        const q = loadQueue();
        for (const b of q) dispatch({ type: "ENQUEUE_BATCH", batch: b });
        queueLoaded.current = true;
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // 队列持久化（仅在首次加载完成后写入，避免覆盖本地队列）
  useEffect(() => {
    if (!queueLoaded.current) return;
    saveQueue(state.queue);
  }, [state.queue]);

  const refresh = useCallback(async () => {
    dispatch({ type: "SET_LOADING", loading: true });
    try {
      const view = await backend.getState();
      dispatch({ type: "SET_VIEW", view });
      dispatch({ type: "SET_LAST_SYNC", at: Date.now() });
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }, []);

  // 断网登记：创建记录并入队（离线可用）
  const createRecord = useCallback(
    async (input: CreateRecordInput): Promise<{ ok: boolean; offline: boolean; batchId: string }> => {
      const st = stateRef.current;
      const reg = st.registrations.find((r) => r.id === input.registrationId);
      const registrationVersion = reg ? reg.version : 1;
      const record = buildRecord(input, registrationVersion);

      const batchId = uid();
      const batch: SyncBatch = {
        id: batchId,
        recordIds: [record.clientRecordId],
        records: [record],
        createdAt: Date.now(),
        status: "pending",
        attempts: 0,
      };

      dispatch({ type: "ENQUEUE_BATCH", batch });

      if (st.online) {
        // 在线：立即尝试同步（直接传入批次对象，避免状态尚未刷新导致查不到）
        await syncBatchInternal(batch);
        return { ok: true, offline: false, batchId };
      }
      return { ok: true, offline: true, batchId };
    },
    [],
  );

  // 内部：同步一个批次（直接接收批次对象，不依赖队列查找）
  const syncBatchInternal = useCallback(async (batch: SyncBatch) => {
    dispatch({ type: "SET_SYNCING", syncing: true });
    dispatch({ type: "UPDATE_BATCH", batchId: batch.id, patch: { status: "syncing", attempts: batch.attempts + 1 } });

    try {
      const records = batch.records;
      const result = await backend.syncBatch({ batchId: batch.id, records });
      dispatch({
        type: "UPDATE_BATCH",
        batchId: batch.id,
        patch: { status: "synced", lastError: undefined },
      });
      dispatch({ type: "SET_FLASH", flash: `批次 ${batch.id.slice(0, 8)} 同步完成：合并 ${result.processed.length}，去重 ${result.deduped.length}，冲突 ${result.conflicts.length}，放行 ${result.clearances.length}` });
      const view = await backend.getState();
      dispatch({ type: "SET_VIEW", view });
      dispatch({ type: "SET_LAST_SYNC", at: Date.now() });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      dispatch({ type: "UPDATE_BATCH", batchId: batch.id, patch: { status: "failed", lastError: msg } });
      dispatch({ type: "SET_FLASH", flash: `批次 ${batch.id.slice(0, 8)} 同步失败：${msg}` });
    } finally {
      dispatch({ type: "SET_SYNCING", syncing: false });
    }
  }, []);

  const syncBatch = useCallback(
    async (batchId: string) => {
      const batch = stateRef.current.queue.find((b) => b.id === batchId);
      if (batch) await syncBatchInternal(batch);
    },
    [syncBatchInternal],
  );

  const syncAll = useCallback(async () => {
    const st = stateRef.current;
    const pending = st.queue.filter((b) => b.status === "pending" || b.status === "failed");
    for (const b of pending) {
      await syncBatchInternal(b);
    }
  }, [syncBatchInternal]);

  // 首次加载完成后：若在线且有未处理批次，自动同步（回网合并）
  const initialSynced = useRef(false);
  useEffect(() => {
    if (!queueLoaded.current || initialSynced.current) return;
    if (!state.online) return;
    const pending = state.queue.filter((b) => b.status === "pending" || b.status === "failed");
    if (pending.length > 0) {
      initialSynced.current = true;
      void syncAll();
    }
  }, [state.queue, state.online, syncAll]);

  // 回网时自动同步
  const prevOnline = useRef(state.online);
  useEffect(() => {
    if (state.online && !prevOnline.current) {
      // 断网 → 回网：自动同步待处理批次
      const pending = state.queue.filter((b) => b.status === "pending" || b.status === "failed");
      if (pending.length > 0) {
        void syncAll();
      }
    }
    prevOnline.current = state.online;
  }, [state.online, state.queue, syncAll]);

  const updateRegistration = useCallback(
    async (registrationId: string, patch: Partial<Pick<Registration, "shoeType" | "status" | "notes">>) => {
      const view = await backend.updateRegistration(registrationId, patch);
      dispatch({ type: "SET_VIEW", view });
      dispatch({ type: "SET_FLASH", flash: "报名已修改（版本 +1），基于该版本的离线记录将进入待裁决" });
    },
    [],
  );

  const updateBannedList = useCallback(async (items: string[]) => {
    const view = await backend.updateBannedList(items);
    dispatch({ type: "SET_VIEW", view });
    dispatch({ type: "SET_FLASH", flash: "禁用蹄铁清单已更新，全部放行结论立即失效，请逐匹重检" });
  }, []);

  const updateRecheckDate = useCallback(async (horseId: string, recheckDate: string) => {
    const view = await backend.updateRecheckDate(horseId, recheckDate);
    dispatch({ type: "SET_VIEW", view });
    dispatch({ type: "SET_FLASH", flash: "复查日期已变更，该马匹放行结论立即失效，请重检" });
  }, []);

  const adjudicate = useCallback(async (conflictId: string, choice: "secretary" | "farrier") => {
    const view = await backend.adjudicate(conflictId, choice);
    dispatch({ type: "SET_VIEW", view });
    dispatch({ type: "SET_FLASH", flash: `冲突已裁决：采纳${choice === "secretary" ? "秘书侧" : "蹄铁师侧"}副本` });
  }, []);

  const issueClearance = useCallback(async (horseId: string, recordId: string) => {
    const view = await backend.issueClearance(horseId, recordId);
    dispatch({ type: "SET_VIEW", view });
  }, []);

  const requestRecheck = useCallback(async (horseId: string, reason: string) => {
    const view = await backend.requestRecheck(horseId, reason);
    dispatch({ type: "SET_VIEW", view });
    dispatch({ type: "SET_FLASH", flash: "已安排重检，原放行结论失效" });
  }, []);

  const resetAll = useCallback(async () => {
    localStorage.removeItem(QUEUE_STORAGE_KEY);
    const view = await backend.resetBackend();
    dispatch({ type: "SET_VIEW", view });
    dispatch({ type: "CLEAR_QUEUE" });
    dispatch({ type: "SET_FLASH", flash: "已重置演示数据" });
  }, []);

  const value: AppContextValue = {
    state,
    dispatch,
    refresh,
    createRecord,
    syncBatch,
    syncAll,
    updateRegistration,
    updateBannedList,
    updateRecheckDate,
    adjudicate,
    issueClearance,
    requestRecheck,
    resetAll,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
