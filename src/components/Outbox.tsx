import { discardBatch, sealBatch, syncAllPending, syncBatch } from "../lib/fieldStore";
import { fmtTime } from "../lib/utils";
import type { BatchResult } from "../types";
import { useBoth } from "../hooks/useStores";
import { Badge, Empty, Panel } from "./ui";

function toneFor(status: string): "warn" | "bad" | "ok" | "idle" {
  switch (status) {
    case "编辑中":
      return "idle";
    case "待同步":
      return "warn";
    case "同步失败":
      return "bad";
    case "已同步":
      return "ok";
  }
  return "idle";
}

function SummaryLine({ r }: { r?: BatchResult }) {
  if (!r) return null;
  return (
    <span className="muted small">
      {r.duplicate && <b className="dup-tag">幂等回放</b>}落账 {r.accepted.length} · 失效 {r.invalidated.length} · 冲突 {r.conflicts.length}
    </span>
  );
}

export function Outbox() {
  const { server, field } = useBoth();
  const pending = field.batches.filter((b) => b.status === "待同步" || b.status === "同步失败");

  return (
    <div className="page">
      <Panel
        title="现场批次与重试"
        sub="批次封批后才可同步；请求丢失可重试；回执丢失时服务器已处理，重传命中 batchId 幂等，回放结果且不重复扣放行记录"
        right={
          <button className="primary" onClick={() => syncAllPending()} disabled={pending.length === 0 || field.net === "offline"}>
            {field.net === "offline" ? "断网中" : `一键合并全部待同步批次（${pending.length}）`}
          </button>
        }
      >
        {field.batches.length === 0 && <Empty text="现场尚无批次。到场边登记页保存记录后会自动生成编辑中批次。" />}
        <ul className="batch-cards">
          {field.batches.map((b) => (
            <li key={b.batchId} className={`batch-card batch-${b.status}`}>
              <header>
                <div>
                  <b>{b.batchId}</b> <Badge tone={toneFor(b.status)}>{b.status}</Badge>
                </div>
                <span className="muted small">
                  创建 {fmtTime(b.createdAt)}
                  {b.sealedAt && ` · 封批 ${fmtTime(b.sealedAt)}`} · 尝试 {b.attempts} 次
                </span>
              </header>
              <table className="mini-table">
                <tbody>
                  {b.records.map((r) => {
                    const onServer = server.ledger.find((d) => d.clientId === r.clientId);
                    const inConflict = server.conflicts.find((c) => c.field.clientId === r.clientId);
                    return (
                      <tr key={r.clientId}>
                        <td>{r.horseId}</td>
                        <td>{r.shoeType}</td>
                        <td>
                          <Badge tone={r.result === "放行" ? "ok" : "bad"}>{r.result}</Badge>
                        </td>
                        <td>
                          <small>
                            v{r.base.entry}/{r.base.banned}/{r.base.recheck}
                          </small>
                        </td>
                        <td>
                          {b.status === "已同步" &&
                            (inConflict ? (
                              <Badge tone="bad">两份待裁决</Badge>
                            ) : onServer ? (
                              <Badge tone={onServer.status === "失效" ? "stale" : "ok"}>
                                {onServer.status === "失效" ? "落账即失效·重检" : "已落账"}
                              </Badge>
                            ) : (
                              <Badge tone="idle">重复去重</Badge>
                            ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {b.error && <p className="error-box">⚠ {b.error}</p>}
              {b.resultNote && <p className="ok-box">{b.resultNote}</p>}
              <div className="row-actions">
                {b.status === "编辑中" && (
                  <button className="primary" onClick={() => sealBatch(b.batchId)} disabled={b.records.length === 0}>
                    封批
                  </button>
                )}
                {(b.status === "待同步" || b.status === "同步失败") && (
                  <button className="primary" onClick={() => syncBatch(b.batchId)} disabled={field.net === "offline"}>
                    {field.net === "offline" ? "断网中" : b.attempts === 0 ? "同步合并" : "重试同步"}
                  </button>
                )}
                {b.status !== "已同步" && (
                  <button className="ghost danger-text" onClick={() => discardBatch(b.batchId)}>
                    丢弃批次
                  </button>
                )}
                <SummaryLine r={b.lastResult} />
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="幂等台账（服务器）" sub="已应用批次的处理结果；同 batchId 重传只回放，不二次写入">
        <ul className="timeline">
          {Object.values(server.appliedBatches).map((ab) => (
            <li key={ab.batchId}>
              <b>{ab.batchId}</b>
              <span>
                接受 {ab.result.accepted.length} · 失效 {ab.result.invalidated.length} · 冲突 {ab.result.conflicts.length}
              </span>
              <small>{fmtTime(ab.at)}</small>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
