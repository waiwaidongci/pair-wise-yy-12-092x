import { useState } from "react";
import { useBoth } from "../hooks/useStores";
import { decisionBadge, deskRows } from "../lib/selectors";
import { daysUntil } from "../lib/utils";
import type { ClearanceDecision } from "../types";
import { Badge, Empty, Panel } from "./ui";

function Metrics() {
  const { server } = useBoth();
  const rows = deskRows(server);
  const due = rows.filter((r) => r.recheckDays <= 7).length;
  const abnormal = server.horses.filter((h) => h.abnormalGait).length;
  const openConflicts = server.conflicts.filter((c) => c.status === "待裁决").length;
  const valid = server.ledger.filter((d) => d.status === "有效" && d.result === "放行").length;
  const stale = server.ledger.filter((d) => d.status === "失效").length;
  const cards = [
    { label: "有效放行", value: valid, tone: "ok" as const },
    { label: "待复查（7天内/逾期）", value: due, tone: due ? "warn" : ("idle" as const) },
    { label: "异常步态", value: abnormal, tone: abnormal ? "bad" : ("idle" as const) },
    { label: "结论失效·待重检", value: stale, tone: stale ? "stale" : ("idle" as const) },
    { label: "冲突待裁决", value: openConflicts, tone: openConflicts ? "bad" : ("idle" as const) },
    { label: "马匹档案", value: server.horses.length, tone: "idle" as const },
  ];
  return (
    <div className="metrics">
      {cards.map((c) => (
        <article key={c.label} className={`metric metric-${c.tone}`}>
          <small>{c.label}</small>
          <strong>{c.value}</strong>
        </article>
      ))}
    </div>
  );
}

function DecisionDrawer({ decision, onClose }: { decision: ClearanceDecision; onClose: () => void }) {
  const { server } = useBoth();
  const horse = server.horses.find((h) => h.horseId === decision.horseId);
  const entries = [
    ["LF", decision.inspection.hooves.LF],
    ["RF", decision.inspection.hooves.RF],
    ["LH", decision.inspection.hooves.LH],
    ["RH", decision.inspection.hooves.RH],
  ] as const;
  return (
    <div className="drawer-mask" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>
            {horse?.horseId} {horse?.name} · 放行记录
          </h3>
          <button className="ghost" onClick={onClose}>
            关闭
          </button>
        </header>
        <div className="drawer-body">
          <p>
            <b>结论：</b>
            {decision.result} · <Badge tone={decision.status === "失效" ? "stale" : "ok"}>{decision.status}</Badge>
          </p>
          <p className="reason">{decision.reason}</p>
          {decision.invalidReason && <p className="invalid-box">⚠ {decision.invalidReason}</p>}
          {decision.serverNote && <p className="muted">服务器备注：{decision.serverNote}</p>}
          <dl className="kv">
            <dt>携带版本</dt>
            <dd>
              报名 v{decision.base.entry} · 禁用清单 v{decision.base.banned} · 复查 v{decision.base.recheck}
            </dd>
            <dt>登记时蹄铁禁用?</dt>
            <dd>{decision.snapshotShoeBanned ? "是" : "否"}（{decision.shoeType}）</dd>
            <dt>报名快照</dt>
            <dd>
              {decision.entrySnapshot.raceNo} {decision.entrySnapshot.raceName} · {decision.entrySnapshot.jockey} · {decision.entrySnapshot.status}
            </dd>
            <dt>下次复查</dt>
            <dd>{decision.recheckDate}</dd>
            <dt>批次 / 记录键</dt>
            <dd>
              {decision.batchId}
              <br />
              <small>{decision.clientId}</small>
            </dd>
          </dl>
          <h4>左前 / 右前 / 左后 / 右后 蹄对比</h4>
          <div className="hoof-grid">
            {entries.map(([pos, n]) => (
              <div key={pos} className="hoof-cell">
                <b>{pos}</b>
                <span>{n.condition || "—"}</span>
                <small>{n.note || "无备注"}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ClearanceDesk() {
  const { server } = useBoth();
  const rows = deskRows(server);
  const [picked, setPicked] = useState<ClearanceDecision | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const filtered = rows.filter((r) => {
    if (filter === "due") return r.recheckDays <= 7;
    if (filter === "abnormal") return r.horse.abnormalGait;
    if (filter === "stale") return r.latest?.status === "失效";
    if (filter === "sport") return r.horse.category === "运动马";
    return true;
  });

  return (
    <div className="page">
      <Metrics />

      <Panel
        title="放行台总览"
        sub={`禁用蹄铁清单 v${server.banned.version}：${server.banned.items.join("、") || "（空）"} · 清单/复查一变，相关结论立即失效并要求重检`}
        right={
          <div className="chips">
            {[
              ["all", "全部"],
              ["due", "临期复查"],
              ["abnormal", "异常步态"],
              ["stale", "结论失效"],
              ["sport", "运动马"],
            ].map(([k, label]) => (
              <button key={k} className={filter === k ? "chip on" : "chip"} onClick={() => setFilter(k)}>
                {label}
              </button>
            ))}
          </div>
        }
      >
        <div className="table-wrap">
          <table className="desk-table">
            <thead>
              <tr>
                <th>马匹档案</th>
                <th>比赛报名</th>
                <th>蹄铁 / 更换历史</th>
                <th>复查提醒</th>
                <th>最新放行结论</th>
                <th>版本链</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const badge = decisionBadge(r.latest);
                return (
                  <tr key={r.entry.id} className={r.latest?.status === "失效" ? "row-stale" : ""}>
                    <td>
                      <b>{r.horse.horseId}</b> {r.horse.name}
                      <div className="muted">
                        {r.horse.category} · {r.horse.breed}
                        {r.horse.abnormalGait && <Badge tone="bad">异常步态</Badge>}
                      </div>
                      <div className="muted small">{r.horse.gaitIssue || "步态无异常"}</div>
                    </td>
                    <td>
                      {r.entry.raceNo} {r.entry.raceName}
                      <div className="muted small">
                        {r.entry.jockey} · <Badge tone="info">{r.entry.status}</Badge>
                      </div>
                    </td>
                    <td>
                      {r.shoeTypes.join("、") || "—"}
                      <div className="muted small">历史 {server.shoeHistory.filter((s) => s.horseId === r.horse.horseId).length} 次</div>
                    </td>
                    <td>
                      <Badge tone={r.recheckDays < 0 ? "bad" : r.recheckDays <= 7 ? "warn" : "idle"}>
                        {r.recheckDate}（{r.recheckDays < 0 ? `逾期${-r.recheckDays}天` : r.recheckDays === 0 ? "今日" : `还剩${r.recheckDays}天`}）
                      </Badge>
                    </td>
                    <td>
                      <button className={`decision decision-${badge.tone}`} onClick={() => r.latest && setPicked(r.latest)} disabled={!r.latest}>
                        {badge.label}
                      </button>
                      {r.latest?.invalidReason && <div className="muted small invalid-text">{r.latest.invalidReason}</div>}
                    </td>
                    <td className="versions">
                      报名 v{r.entry.version}
                      <br />
                      清单 v{server.banned.version}
                      <br />
                      复查 v{r.recheckVersion}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <Empty text="没有符合条件的马匹" />}
        </div>
      </Panel>

      <div className="two-col">
        <Panel title="蹄铁更换历史（append-only）">
          <ul className="timeline">
            {[...server.shoeHistory]
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .map((s) => (
                <li key={s.id}>
                  <b>{s.date}</b>
                  <span>
                    {s.horseId} · {s.shoeType} · {s.nailPositions}
                  </span>
                  <small>{s.note}</small>
                </li>
              ))}
          </ul>
        </Panel>

        <Panel title="事件审计">
          <ul className="audit">
            {server.audit.map((a, i) => (
              <li key={i} className={`audit-${a.kind}`}>
                <small>{new Date(a.at).toLocaleTimeString("zh-CN", { hour12: false })}</small>
                <span>{a.text}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {picked && <DecisionDrawer decision={picked} onClose={() => setPicked(null)} />}
    </div>
  );
}
