// 全局状态：在线/断网、服务器数据、离线队列、同步操作
import { createContext, useContext } from "react";
import type {
  BackendView,
  Clearance,
  ConflictPair,
  HoofRecord,
  Horse,
  Registration,
  RecheckReminder,
  SyncBatch,
} from "../types";
import { uid } from "./id";

export interface AppState {
  online: boolean;
  loading: boolean;
  horses: Horse[];
  registrations: Registration[];
  bannedListVersion: number;
  bannedListItems: string[];
  reminders: RecheckReminder[];
  records: HoofRecord[];
  conflicts: ConflictPair[];
  clearances: Clearance[];
  queue: SyncBatch[];
  syncing: boolean;
  lastSyncAt: number | null;
  flash: string | null;
}

export type Action =
  | { type: "SET_ONLINE"; online: boolean }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_VIEW"; view: BackendView }
  | { type: "ENQUEUE_BATCH"; batch: SyncBatch }
  | { type: "UPDATE_BATCH"; batchId: string; patch: Partial<SyncBatch> }
  | { type: "REMOVE_BATCH"; batchId: string }
  | { type: "SET_SYNCING"; syncing: boolean }
  | { type: "SET_LAST_SYNC"; at: number }
  | { type: "SET_FLASH"; flash: string | null }
  | { type: "CLEAR_QUEUE" };

export const initialState: AppState = {
  online: true,
  loading: false,
  horses: [],
  registrations: [],
  bannedListVersion: 1,
  bannedListItems: [],
  reminders: [],
  records: [],
  conflicts: [],
  clearances: [],
  queue: [],
  syncing: false,
  lastSyncAt: null,
  flash: null,
};

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_ONLINE":
      return { ...state, online: action.online };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "SET_VIEW": {
      const v = action.view;
      return {
        ...state,
        horses: v.horses,
        registrations: v.registrations,
        bannedListVersion: v.bannedList.version,
        bannedListItems: v.bannedList.items,
        reminders: v.reminders,
        records: v.records,
        conflicts: v.conflicts,
        clearances: v.clearances,
      };
    }
    case "ENQUEUE_BATCH":
      return { ...state, queue: [...state.queue, action.batch] };
    case "UPDATE_BATCH":
      return {
        ...state,
        queue: state.queue.map((b) => (b.id === action.batchId ? { ...b, ...action.patch } : b)),
      };
    case "REMOVE_BATCH":
      return { ...state, queue: state.queue.filter((b) => b.id !== action.batchId) };
    case "SET_SYNCING":
      return { ...state, syncing: action.syncing };
    case "SET_LAST_SYNC":
      return { ...state, lastSyncAt: action.at };
    case "SET_FLASH":
      return { ...state, flash: action.flash };
    case "CLEAR_QUEUE":
      return { ...state, queue: [] };
    default:
      return state;
  }
}

export interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  /** 刷新服务器数据 */
  refresh: () => Promise<void>;
  /** 断网登记：创建记录并入队（离线可用） */
  createRecord: (input: CreateRecordInput) => Promise<{ ok: boolean; offline: boolean; batchId: string }>;
  /** 同步单个批次 */
  syncBatch: (batchId: string) => Promise<void>;
  /** 同步所有待处理批次 */
  syncAll: () => Promise<void>;
  /** 秘书修改报名 */
  updateRegistration: (registrationId: string, patch: Partial<Pick<Registration, "shoeType" | "status" | "notes">>) => Promise<void>;
  /** 秘书修改禁用蹄铁清单 */
  updateBannedList: (items: string[]) => Promise<void>;
  /** 秘书调整复查日期 */
  updateRecheckDate: (horseId: string, recheckDate: string) => Promise<void>;
  /** 裁决冲突 */
  adjudicate: (conflictId: string, choice: "secretary" | "farrier") => Promise<void>;
  /** 出具放行结论 */
  issueClearance: (horseId: string, recordId: string) => Promise<void>;
  /** 要求重检 */
  requestRecheck: (horseId: string, reason: string) => Promise<void>;
  /** 重置演示数据 */
  resetAll: () => Promise<void>;
}

export interface CreateRecordInput {
  horseId: string;
  registrationId: string;
  gaitIssue: string;
  hoofAssessment: string;
  shoeType: string;
  nailPosition: string;
  trimDate: string;
  nextRecheckDate: string;
  photoNote: string;
  abnormalGait: boolean;
  requestClearance: boolean;
  registrationPatch?: {
    shoeType?: string;
    status?: Registration["status"];
    notes?: string;
  };
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

/** 构造一条离线蹄部记录（携带报名版本快照） */
export function buildRecord(input: CreateRecordInput, registrationVersion: number): HoofRecord {
  return {
    id: uid(),
    clientRecordId: uid(),
    horseId: input.horseId,
    registrationId: input.registrationId,
    registrationVersion,
    gaitIssue: input.gaitIssue,
    hoofAssessment: input.hoofAssessment,
    shoeType: input.shoeType,
    nailPosition: input.nailPosition,
    trimDate: input.trimDate,
    nextRecheckDate: input.nextRecheckDate,
    photoNote: input.photoNote,
    abnormalGait: input.abnormalGait,
    requestClearance: input.requestClearance,
    registrationPatch: input.registrationPatch,
    createdAt: Date.now(),
    createdBy: "farrier",
    synced: false,
    conflict: false,
  };
}
