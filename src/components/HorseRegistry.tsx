// 马匹与报名：马匹档案 + 秘书修改报名（版本 +1）
import { useState } from "react";
import { useApp } from "../lib/store";
import type { Registration } from "../types";

export default function HorseRegistry() {
  const { state, updateRegistration } = useApp();
  const [editing, setEditing] = useState<string | null>(null);
  const [shoeType, setShoeType] = useState("");
  const [status, setStatus] = useState<Registration["status"]>("enrolled");
  const [notes, setNotes] = useState("");

  const startEdit = (reg: Registration) => {
    setEditing(reg.id);
    setShoeType(reg.shoeType);
    setStatus(reg.status);
    setNotes(reg.notes);
  };

  const save = async () => {
    if (!editing) return;
    await updateRegistration(editing, { shoeType, status, notes });
    setEditing(null);
  };

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>马匹与报名</p>
          <h2>马匹档案与比赛报名</h2>
        </div>
        <span className="muted">秘书在办公室修改报名，版本 +1；蹄铁师离线记录携带旧版本，回网后冲突待裁决</span>
      </div>

      <div className="registry">
        {state.horses.map((horse) => {
          const reg = state.registrations.find((r) => r.horseId === horse.id);
          return (
            <div key={horse.id} className="registry-card">
              <div className="registry-horse">
                <strong>{horse.code}</strong>
                <span>{horse.name} · {horse.breed} · {horse.coat}</span>
                <small className="muted">马主：{horse.owner}</small>
              </div>
              {reg && (
                <div className="registry-reg">
                  <div className="reg-head">
                    <span>{reg.eventName}</span>
                    <span className="version-tag">v{reg.version}</span>
                  </div>
                  {editing === reg.id ? (
                    <div className="reg-edit">
                      <label>
                        <span>蹄铁类型</span>
                        <input value={shoeType} onChange={(e) => setShoeType(e.target.value)} />
                      </label>
                      <label>
                        <span>状态</span>
                        <select value={status} onChange={(e) => setStatus(e.target.value as Registration["status"])}>
                          <option value="enrolled">已报名</option>
                          <option value="withdrawn">已退赛</option>
                          <option value="scratched">已弃权</option>
                        </select>
                      </label>
                      <label>
                        <span>备注</span>
                        <input value={notes} onChange={(e) => setNotes(e.target.value)} />
                      </label>
                      <div className="reg-actions">
                        <button className="primary small" onClick={save} disabled={!state.online}>保存（版本 +1）</button>
                        <button className="small" onClick={() => setEditing(null)}>取消</button>
                      </div>
                    </div>
                  ) : (
                    <div className="reg-view">
                      <div className="copy-row"><span>蹄铁类型</span><strong>{reg.shoeType}</strong></div>
                      <div className="copy-row"><span>状态</span><strong>{reg.status}</strong></div>
                      <div className="copy-row"><span>备注</span><strong>{reg.notes || "—"}</strong></div>
                      <button className="small" onClick={() => startEdit(reg)} disabled={!state.online}>
                        {state.online ? "秘书修改报名" : "断网中"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
