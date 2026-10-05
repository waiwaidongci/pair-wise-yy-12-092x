// 复查提醒：到期/过期提醒，秘书调整复查日期会触发放行失效
import { useState } from "react";
import { useApp } from "../lib/store";

function daysUntil(s: string): number {
  const d = new Date(s);
  const now = new Date();
  d.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

export default function RecheckReminders() {
  const { state, updateRecheckDate } = useApp();
  const [editing, setEditing] = useState<string | null>(null);
  const [date, setDate] = useState("");

  const reminders = state.reminders
    .filter((r) => !r.resolved)
    .map((r) => {
      const horse = state.horses.find((h) => h.id === r.horseId);
      const due = daysUntil(r.dueDate);
      return { ...r, horse, due, overdue: due < 0 };
    })
    .sort((a, b) => a.due - b.due);

  const startEdit = (horseId: string, current: string) => {
    setEditing(horseId);
    setDate(current);
  };

  const save = async () => {
    if (!editing) return;
    await updateRecheckDate(editing, date);
    setEditing(null);
  };

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>复查提醒</p>
          <h2>待复查马匹</h2>
        </div>
        <span className="badge warn">{reminders.length} 项待复查</span>
      </div>

      {reminders.length === 0 && <div className="empty">暂无待复查提醒</div>}

      <div className="reminder-list">
        {reminders.map((r) => (
          <div key={r.id} className={"reminder-card " + (r.overdue ? "overdue" : "")}>
            <div className="reminder-main">
              <strong>{r.horse?.code}</strong>
              <span>{r.reason}</span>
              <small className="muted">应复查：{r.dueDate}</small>
            </div>
            <div className="reminder-side">
              <span className={"due " + (r.overdue ? "overdue" : r.due <= 3 ? "soon" : "")}>
                {r.overdue ? `已过期 ${-r.due} 天` : r.due === 0 ? "今天到期" : `剩 ${r.due} 天`}
              </span>
              {editing === r.horseId ? (
                <div className="inline-edit">
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  <button className="primary small" onClick={save} disabled={!state.online}>保存</button>
                  <button className="small" onClick={() => setEditing(null)}>取消</button>
                </div>
              ) : (
                <button className="small" onClick={() => startEdit(r.horseId, r.dueDate)} disabled={!state.online}>
                  调整复查日期
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
