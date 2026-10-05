// 待裁决：同一报名版本被两边改过，留两份副本，秘书侧与蹄铁师侧，后到记录不覆盖
import { useApp } from "../lib/store";

export default function ConflictQueue() {
  const { state, adjudicate } = useApp();
  const pending = state.conflicts.filter((c) => c.status === "pending");
  const resolved = state.conflicts.filter((c) => c.status === "resolved");

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>待裁决</p>
          <h2>报名版本冲突副本</h2>
        </div>
        <span className="badge err">{pending.length} 条待裁决</span>
      </div>

      {pending.length === 0 && resolved.length === 0 && (
        <div className="empty">暂无冲突。断网登记携带报名版本，回网后若秘书已修改同一版本，会在此留下两份副本待裁决。</div>
      )}

      <div className="conflict-list">
        {pending.map((c) => (
          <ConflictCard key={c.id} conflict={c} onAdjudicate={adjudicate} />
        ))}
      </div>

      {resolved.length > 0 && (
        <>
          <h3 className="resolved-title">已裁决</h3>
          <div className="conflict-list">
            {resolved.map((c) => (
              <div key={c.id} className="conflict-card resolved">
                <div className="conflict-head">
                  <strong>报名 {c.registrationId.slice(0, 8)}</strong>
                  <span className="muted">基于 v{c.baseVersion}</span>
                  <span className="badge ok">已采纳{c.resolution === "secretary" ? "秘书侧" : "蹄铁师侧"}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ConflictCard({ conflict, onAdjudicate }: { conflict: import("../types").ConflictPair; onAdjudicate: (id: string, choice: "secretary" | "farrier") => void }) {
  const reg = (copy: import("../types").Registration) => (
    <div className="copy">
      <div className="copy-row"><span>蹄铁类型</span><strong>{copy.shoeType}</strong></div>
      <div className="copy-row"><span>状态</span><strong>{copy.status}</strong></div>
      <div className="copy-row"><span>备注</span><strong>{copy.notes || "—"}</strong></div>
      <div className="copy-row"><span>版本</span><strong>v{copy.version}</strong></div>
    </div>
  );

  return (
    <div className="conflict-card">
      <div className="conflict-head">
        <strong>报名 {conflict.registrationId.slice(0, 8)}</strong>
        <span className="muted">基于 v{conflict.baseVersion} 两边改过</span>
      </div>
      <div className="conflict-grid">
        <div className="copy-block">
          <div className="copy-title">秘书侧副本（服务器当前）</div>
          {reg(conflict.secretaryCopy)}
          <button className="small" onClick={() => onAdjudicate(conflict.id, "secretary")}>采纳秘书侧</button>
        </div>
        <div className="copy-block">
          <div className="copy-title">蹄铁师侧副本（离线版本 + 离线修改）</div>
          {reg(conflict.farrierCopy)}
          <button className="primary small" onClick={() => onAdjudicate(conflict.id, "farrier")}>采纳蹄铁师侧</button>
        </div>
      </div>
      <p className="conflict-note">后到记录不能覆盖：两份副本均保留，等待裁决。</p>
    </div>
  );
}
