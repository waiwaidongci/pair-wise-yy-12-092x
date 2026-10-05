import type { ClearanceDecision, HorseProfile, RaceEntry, ServerState } from "../types";
import { daysUntil, recheckState } from "./utils";

export interface DeskRow {
  horse: HorseProfile;
  entry: RaceEntry;
  recheckDate: string;
  recheckVersion: number;
  recheckStatus: ReturnType<typeof recheckState>;
  recheckDays: number;
  latest?: ClearanceDecision;
  shoeTypes: string[];
}

export function deskRows(server: ServerState): DeskRow[] {
  return server.entries.map((entry) => {
    const horse = server.horses.find((h) => h.horseId === entry.horseId)!;
    const rc = server.rechecks[entry.horseId];
    const decisions = server.ledger
      .filter((d) => d.horseId === entry.horseId)
      .sort((a, b) => b.appliedAt - a.appliedAt);
    const shoeTypes = [...new Set(server.shoeHistory.filter((s) => s.horseId === entry.horseId).map((s) => s.shoeType))];
    return {
      horse,
      entry,
      recheckDate: rc?.date ?? "—",
      recheckVersion: rc?.version ?? 0,
      recheckStatus: rc ? recheckState(rc.date) : "正常",
      recheckDays: rc ? daysUntil(rc.date) : 999,
      latest: decisions[0],
      shoeTypes,
    };
  });
}

export function decisionBadge(d?: ClearanceDecision): { label: string; tone: "ok" | "bad" | "stale" | "idle" } {
  if (!d) return { label: "未检查", tone: "idle" };
  if (d.status === "失效") return { label: "结论失效·需重检", tone: "stale" };
  return d.result === "放行" ? { label: "放行", tone: "ok" } : { label: "不予放行", tone: "bad" };
}

export function versionSummary(row: DeskRow, bannedVersion: number): string {
  return `报名 v${row.entry.version} · 清单 v${bannedVersion} · 复查 v${row.recheckVersion}`;
}
