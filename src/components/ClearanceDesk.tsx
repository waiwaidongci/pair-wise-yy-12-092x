// 放行台：把马匹档案、比赛报名、复查提醒、蹄铁更换历史接成一张放行表
import { useMemo, useState } from "react";
import { useApp } from "../lib/store";
import type { Clearance, HoofRecord } from "../types";

function fmtDate(s: string): string {
  if (!s) return "—";
  return s;
}

function daysUntil(s: string): number {
  const d = new Date(s);
  const now = new Date();
  d.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

export default function ClearanceDesk() {
  const { state, issueClearance, requestRecheck } = useApp();
  const [filter, setFilter] = useState<"all" | "valid" | "invalid" | "pending">("all");

  // 每匹马的最新放行结论
  const latestClearanceByHorse = useMemo(() => {
    const map = new Map<string, Clearance>();
    for (const c of state.clearances) {
      const prev = map.get(c.horseId);
      if (!prev || c.issuedAt > prev.issuedAt) map.set(c.horseId, c);
    }
    return map;
  }, [state.clearances]);

  // 每匹马的最新已同步检查记录
  const latestRecordByHorse = useMemo(() => {
    const map = new Map<string, HoofRecord>();
    for (const r of state.records) {
      if (!r.synced) continue;
      const prev = map.get(r.horseId);
      if (!prev || r.createdAt > prev.createdAt) map.set(r.horseId, r);
    }
    return map;
  }, [state.records]);

  const rows = state.horses.map((horse) => {
    const reg = state.registrations.find((r) => r.horseId === horse.id);
    const clearance = latestClearanceByHorse.get(horse.id);
    const record = latestRecordByHorse.get(horse.id);
    const due = daysUntil(horse.recheckDate);
    const dueLabel = due < 0 ? `已过期 ${-due} 天` : due === 0 ? "今天到期" : `剩 ${due} 天`;
    const dueClass = due < 0 ? "overdue" : due <= 3 ? "soon" : "";

    let status: "valid" | "invalid" | "pending" | "none" = "none";
    if (clearance) {
      status = clearance.valid ? "valid" : "invalid";
    } else if (record) {
      status = "pending";
    }

    return { horse, reg, clearance, record, dueLabel, dueClass, status };
  });

  const filtered = rows.filter((r) => {
    if (filter === "all") return true;
    return r.status === filter;
  });

  const counts = {
    all: rows.length,
    valid: rows.filter((r) => r.status === "valid").length,
    invalid: rows.filter((r) => r.status === "invalid").length,
    pending: rows.filter((r) => r.status === "pending").length,
  };

  return (
    <section className="panel desk">
      <div className="heading">
        <div>
          <p>放行台</p>
          <h2>赛前蹄铁放行总览</h2>
        </div>
        <div className="chips">
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>全部 {counts.all}</button>
          <button className={filter === "valid" ? "active" : ""} onClick={() => setFilter("valid")}>有效放行 {counts.valid}</button>
          <button className={filter === "invalid" ? "active" : ""} onClick={() => setFilter("invalid")}>已失效 {counts.invalid}</button>
          <button className={filter === "pending" ? "active" : ""} onClick={() => setFilter("pending")}>待放行 {counts.pending}</button>
        </div>
      </div>

      {state.bannedListVersion > 1 && (
        <div className="banner warn">
          禁用蹄铁清单已更新至 v{state.bannedListVersion}，全部放行结论立即失效，请逐匹重检后重新放行。
        </div>
      )}

      <div className="desk-table">
        <div className="desk-row desk-head">
          <span>马匹</span>
          <span>报名 / 版本</span>
          <span>最新蹄铁</span>
          <span>复查日期</span>
          <span>放行结论</span>
          <span>操作</span>
        </div>
        {filtered.map(({ horse, reg, clearance, record, dueLabel, dueClass, status }) => (
          <div key={horse.id} className={"desk-row " + (status === "invalid" ? "row-invalid" : "")}>
            <div className="desk-horse">
              <strong>{horse.code}</strong>
              <small>{horse.name} · {horse.breed}</small>
            </div>
            <div>
              {reg ? (
                <>
                  <span>{reg.eventName}</span>
                  <small className="version-tag">v{reg.version}</small>
                </>
              ) : (
                <small className="muted">未报名</small>
              )}
            </div>
            <div>
              {record ? (
                <>
                  <span>{record.shoeType || "—"}</span>
                  {record.abnormalGait && <span className="flag">异常步态</span>}
                  <small className="muted">{fmtDate(record.trimDate)} 修蹄</small>
                </>
              ) : (
                <small className="muted">无检查记录</small>
              )}
            </div>
            <div>
              <span className={"due " + dueClass}>{fmtDate(horse.recheckDate)}</span>
              <small className={"due-label " + dueClass}>{dueLabel}</small>
            </div>
            <div>
              {status === "valid" && (
                <span className="badge ok">
                  {clearance!.result === "approved" ? "✓ 放行有效" : "✗ 不予放行"}
                </span>
              )}
              {status === "invalid" && (
                <span className="badge err" title={clearance!.invalidReason}>
                  ⚠ 已失效
                </span>
              )}
              {status === "pending" && <span className="badge warn">待放行</span>}
              {status === "none" && <span className="muted">—</span>}
              {clearance && !clearance.valid && (
                <small className="invalid-reason">{clearance.invalidReason}</small>
              )}
            </div>
            <div className="desk-actions">
              {record && (status === "pending" || status === "invalid") && (
                <button
                  className="primary small"
                  onClick={() => issueClearance(horse.id, record.id)}
                  disabled={!state.online}
                  title={state.online ? "依据最新检查记录出具放行结论" : "断网中，回网后可放行"}
                >
                  {status === "invalid" ? "重检后放行" : "放行"}
                </button>
              )}
              <button
                className="small"
                onClick={() => requestRecheck(horse.id, `赛前重检：${horse.code}`)}
                disabled={!state.online}
                title="安排重检，原放行结论立即失效"
              >
                重检
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="empty">当前筛选下没有马匹</div>}
      </div>
    </section>
  );
}
