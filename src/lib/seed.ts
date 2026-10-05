import type {
  AuditLine,
  ClearanceDecision,
  HorseProfile,
  RaceEntry,
  ServerState,
  ShoeChange,
} from "../types";
import { shiftDate, TODAY, uid } from "./utils";

/** 种子数据：模拟比赛日当天服务器（赛事秘书办公室）侧的初始状态 */
export function buildSeed(): ServerState {
  const t0 = Date.now() - 1000 * 60 * 60 * 26; // 昨天

  const horses: HorseProfile[] = [
    {
      horseId: "HORSE-18",
      name: "疾风",
      category: "运动马",
      breed: "温血马",
      gaitIssue: "右前蹄外侧磨耗",
      hoofAssessment: "蹄形基本对称，右前外略低",
      abnormalGait: false,
    },
    {
      horseId: "HORSE-27",
      name: "铁柱",
      category: "运动马",
      breed: "纯血马",
      gaitIssue: "后蹄裂纹",
      hoofAssessment: "左后蹄壁纵向裂纹 2cm",
      abnormalGait: true,
    },
    {
      horseId: "HORSE-31",
      name: "云絮",
      category: "运动马",
      breed: "阿拉伯马",
      gaitIssue: "步态轻微不稳",
      hoofAssessment: "蹄底轻度挫伤，恢复中",
      abnormalGait: true,
    },
    {
      horseId: "HORSE-44",
      name: "老松",
      category: "休养马",
      breed: "夸特马",
      gaitIssue: "无",
      hoofAssessment: "蹄形良好",
      abnormalGait: false,
    },
  ];

  const entries: RaceEntry[] = [
    { id: "E-18", horseId: "HORSE-18", raceNo: "R3", raceName: "1400m 让磅赛", jockey: "王磊", status: "已报名", version: 1, updatedAt: t0 },
    { id: "E-27", horseId: "HORSE-27", raceNo: "R3", raceName: "1400m 让磅赛", jockey: "陈骁", status: "已报名", version: 1, updatedAt: t0 },
    { id: "E-31", horseId: "HORSE-31", raceNo: "R5", raceName: "2000m 金杯赛", jockey: "李娜", status: "候补", version: 1, updatedAt: t0 },
    { id: "E-44", horseId: "HORSE-44", raceNo: "R7", raceName: "表演赛", jockey: "赵远", status: "已报名", version: 1, updatedAt: t0 },
  ];

  const shoeHistory: ShoeChange[] = [
    { id: uid("SC"), horseId: "HORSE-18", date: shiftDate(TODAY, -12), shoeType: "铝蹄铁", nailPositions: "标准 8 钉", note: "例行更换" },
    { id: uid("SC"), horseId: "HORSE-27", date: shiftDate(TODAY, -10), shoeType: "加护蹄垫", nailPositions: "内 4 外 3", note: "护裂处理，拍照归档" },
    { id: uid("SC"), horseId: "HORSE-31", date: shiftDate(TODAY, -6), shoeType: "塑料蹄铁", nailPositions: "标准 6 钉", note: "挫伤恢复期用软质蹄铁" },
    { id: uid("SC"), horseId: "HORSE-44", date: shiftDate(TODAY, -3), shoeType: "钢蹄铁", nailPositions: "标准 8 钉", note: "表演前更换" },
  ];

  const rechecks: ServerState["rechecks"] = {
    "HORSE-18": { date: shiftDate(TODAY, 2), version: 1, updatedAt: t0 },
    "HORSE-27": { date: shiftDate(TODAY, -1), version: 1, updatedAt: t0 }, // 复查已逾期
    "HORSE-31": { date: shiftDate(TODAY, 5), version: 1, updatedAt: t0 },
    "HORSE-44": { date: shiftDate(TODAY, 14), version: 1, updatedAt: t0 },
  };

  const seedBatch = "seed-batch";
  function seedDecision(
    entryId: string,
    horseId: string,
    shoeType: string,
    result: "放行" | "不予放行",
    reason: string,
    daysAgo: number,
    baseBanned = 1,
    recheckVersion = 1
  ): ClearanceDecision {
    const e = entries.find((x) => x.id === entryId)!;
    const at = Date.now() - 1000 * 60 * 60 * 24 * daysAgo;
    return {
      clientId: uid("rec"),
      batchId: seedBatch,
      horseId,
      entryId,
      createdAt: at,
      appliedAt: at,
      inspectionDate: TODAY,
      inspection: {
        gaitIssue: "",
        hoofAssessment: "",
        abnormalGait: false,
        shoeType,
        nailPositions: "",
        recheckDate: rechecks[horseId].date,
        photoNote: "",
        hooves: {
          LF: { condition: "", note: "" },
          RF: { condition: "", note: "" },
          LH: { condition: "", note: "" },
          RH: { condition: "", note: "" },
        },
      },
      shoeType,
      result,
      reason,
      recheckDate: rechecks[horseId].date,
      base: { entry: 1, banned: baseBanned, recheck: recheckVersion },
      snapshotShoeBanned: shoeType === "钢蹄铁",
      entrySnapshot: { raceNo: e.raceNo, raceName: e.raceName, jockey: e.jockey, status: e.status },
      status: "有效",
    };
  }

  // 今天早上赛前检查已做出的放行结论（用于演示清单/复查变更后即时失效）
  const ledger: ClearanceDecision[] = [
    seedDecision("E-18", "HORSE-18", "铝蹄铁", "放行", "蹄况良好，复查在期内", 0),
    seedDecision("E-44", "HORSE-44", "钢蹄铁", "不予放行", "钢蹄铁在禁用清单 v1 中", 0),
  ];

  const audit: AuditLine[] = [
    { at: t0, text: "系统初始化：禁用蹄铁清单 v1（钢蹄铁），4 匹马完成报名", kind: "info" },
    { at: Date.now() - 1000 * 60 * 60 * 3, text: "赛前检查：HORSE-18 放行；HORSE-44 因钢蹄铁禁用不予放行", kind: "ok" },
  ];

  return {
    horses,
    entries,
    shoeHistory,
    rechecks,
    banned: { version: 1, items: ["钢蹄铁"], updatedAt: t0 },
    ledger,
    conflicts: [],
    appliedBatches: {
      [seedBatch]: {
        batchId: seedBatch,
        at: Date.now() - 1000 * 60 * 60 * 3,
        result: { accepted: ledger.map((d) => d.clientId), conflicts: [], invalidated: [], duplicate: false },
      },
    },
    audit,
  };
}
