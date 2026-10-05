// 蹄铁更换历史：每匹马的修蹄/换蹄记录时间线
import { useMemo, useState } from "react";
import { useApp } from "../lib/store";

export default function ShoeHistory() {
  const { state } = useApp();
  const [horseId, setHorseId] = useState<string>(state.horses[0]?.id ?? "");

  const records = useMemo(
    () =>
      state.records
        .filter((r) => r.horseId === horseId && r.synced)
        .sort((a, b) => b.createdAt - a.createdAt),
    [state.records, horseId],
  );

  const horse = state.horses.find((h) => h.id === horseId);

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>蹄铁更换历史</p>
          <h2>修蹄与换蹄记录</h2>
        </div>
        <select value={horseId} onChange={(e) => setHorseId(e.target.value)}>
          {state.horses.map((h) => (
            <option key={h.id} value={h.id}>{h.code} · {h.name}</option>
          ))}
        </select>
      </div>

      {horse && (
        <div className="history-summary">
          <span>当前蹄铁：<strong>{records[0]?.shoeType || "—"}</strong></span>
          <span>当前复查日期：<strong>{horse.recheckDate}</strong></span>
          <span>记录数：<strong>{records.length}</strong></span>
        </div>
      )}

      {records.length === 0 && <div className="empty">该马匹暂无蹄铁更换历史</div>}

      <div className="timeline">
        {records.map((r) => (
          <div key={r.id} className="timeline-item">
            <div className="timeline-dot" />
            <div className="timeline-content">
              <div className="timeline-head">
                <strong>{r.shoeType}</strong>
                <span className="muted">{r.trimDate} 修蹄</span>
                {r.abnormalGait && <span className="flag">异常步态</span>}
                {r.conflict && <span className="badge err">冲突待裁决</span>}
              </div>
              <p className="timeline-gait">{r.gaitIssue} · {r.hoofAssessment} · {r.nailPosition}</p>
              {r.photoNote && <p className="timeline-photo">📷 {r.photoNote}</p>}
              <p className="timeline-recheck">下次复查：{r.nextRecheckDate}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
