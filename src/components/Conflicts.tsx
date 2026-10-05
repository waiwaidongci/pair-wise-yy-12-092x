import { useBoth } from "../hooks/useStores";
import { resolveConflict } from "../lib/serverStore";
import { fmtDateTime } from "../lib/utils";
import { Badge, Empty, Panel } from "./ui";

export function Conflicts() {
  const { server } = useBoth();
  const open = server.conflicts.filter((c) => c.status === "待裁决");
  const done = server.conflicts.filter((c) => c.status === "已裁决");

  return (
    <div className="page">
      <Panel
        title="冲突裁决"
        sub="同一报名版本被现场与办公室两边改过：现场副本（后到）不覆盖办公室数据，两份均保留，人工裁决后才放行"
      >
        {open.length === 0 && <Empty text="没有待裁决冲突。触发方式：现场断网登记 → 办公室修改同一报名 → 回网同步。" />}
        <div className="conflict-list">
          {open.map((c) => {
            const entry = server.entries.find((e) => e.id === c.field.entryId);
            const horse = server.horses.find((h) => h.horseId === c.horseId);
            const f = c.field;
            const changed =
              entry &&
              (entry.raceNo !== f.entrySnapshot.raceNo ||
                entry.raceName !== f.entrySnapshot.raceName ||
                entry.jockey !== f.entrySnapshot.jockey ||
                entry.status !== f.entrySnapshot.status);
            const Diff = ({ label, a, b }: { label: string; a: string; b: string }) =>
              a === b ? (
                <span className="muted">{label}：{a}（一致）</span>
              ) : (
                <span className="diff">
                  {label}：<del>{a}</del> → <b>{b}</b>
                </span>
              );
            return (
              <article key={c.id} className="conflict-card">
                <header>
                  <h3>
                    {horse?.horseId} {horse?.name} · {entry?.raceNo ?? "报名已删除"} {entry?.raceName ?? ""}
                  </h3>
                  <Badge tone="bad">待裁决</Badge>
                </header>
                <p className="muted small">
                  {c.id} · 产生于 {fmtDateTime(c.openedAt)} · 批次 {f.batchId}
                </p>

                <div className="conflict-cols">
                  <div className="conflict-col field-col">
                    <h4>📴 现场副本（后到，不覆盖）</h4>
                    <p>
                      <Badge tone={f.result === "放行" ? "ok" : "bad"}>{f.result}</Badge> {f.shoeType} · 复查 {f.recheckDate}
                    </p>
                    <ul>
                      <li>{f.reason}</li>
                      <li>蹄形：{f.inspection.hoofAssessment || "—"}</li>
                      <li>步态：{f.inspection.gaitIssue || "无"}{f.inspection.abnormalGait && <Badge tone="bad">异常</Badge>}</li>
                      <li>
                        基于报名 <b>v{f.base.entry}</b> / 清单 v{f.base.banned} / 复查 v{f.base.recheck}
                      </li>
                      <li className="muted small">{f.clientId}</li>
                    </ul>
                  </div>
                  <div className="conflict-col office-col">
                    <h4>🏢 办公室当前版本</h4>
                    {entry ? (
                      <ul>
                        <li>
                          <Diff label="场次" a={f.entrySnapshot.raceNo} b={entry.raceNo} />
                        </li>
                        <li>
                          <Diff label="名称" a={f.entrySnapshot.raceName} b={entry.raceName} />
                        </li>
                        <li>
                          <Diff label="骑师" a={f.entrySnapshot.jockey} b={entry.jockey} />
                        </li>
                        <li>
                          <Diff label="状态" a={f.entrySnapshot.status} b={entry.status} />
                        </li>
                        <li>
                          报名版本 <b>v{entry.version}</b>
                          {!changed && "（报名内容无实质差异，仅版本号被其他编辑推进）"}
                        </li>
                      </ul>
                    ) : (
                      <p>该报名已被移除，现场记录无法直接落账。</p>
                    )}
                  </div>
                </div>

                <div className="conflict-actions">
                  <button className="primary" onClick={() => resolveConflict(c.id, "采用现场版")}>
                    采用现场版（按最新依据重新校验后落账）
                  </button>
                  <button className="danger" onClick={() => resolveConflict(c.id, "采用办公室版")}>
                    采用办公室版（现场记录作废，要求重检）
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </Panel>

      {done.length > 0 && (
        <Panel title="裁决历史">
          <ul className="timeline">
            {done.map((c) => (
              <li key={c.id}>
                <b>{fmtDateTime(c.resolvedAt!)}</b>
                <span>
                  {c.horseId} · <Badge tone={c.resolution === "采用现场版" ? "ok" : "bad"}>{c.resolution}</Badge>
                </span>
                <small>{c.note}</small>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
