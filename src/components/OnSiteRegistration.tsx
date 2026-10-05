// 现场登记：蹄铁师断网登记蹄部状况，记录携带报名版本，回网后合并
import { useMemo, useState } from "react";
import { useApp } from "../lib/store";
import type { SyncBatch } from "../types";

function isoDate(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

export default function OnSiteRegistration() {
  const { state, createRecord, syncBatch } = useApp();
  const [horseId, setHorseId] = useState("");
  const [registrationId, setRegistrationId] = useState("");
  const [gaitIssue, setGaitIssue] = useState("");
  const [hoofAssessment, setHoofAssessment] = useState("");
  const [shoeType, setShoeType] = useState("铝蹄铁");
  const [nailPosition, setNailPosition] = useState("前蹄钉位");
  const [trimDate, setTrimDate] = useState(isoDate(0));
  const [nextRecheckDate, setNextRecheckDate] = useState(isoDate(14));
  const [photoNote, setPhotoNote] = useState("");
  const [abnormalGait, setAbnormalGait] = useState(false);
  const [requestClearance, setRequestClearance] = useState(true);
  // 蹄铁师离线时对报名的修改
  const [patchShoeType, setPatchShoeType] = useState("");
  const [patchNotes, setPatchNotes] = useState("");

  const horseRegs = useMemo(
    () => state.registrations.filter((r) => r.horseId === horseId),
    [state.registrations, horseId],
  );

  const selectedReg = state.registrations.find((r) => r.id === registrationId);

  const selectHorse = (id: string) => {
    setHorseId(id);
    const reg = state.registrations.find((r) => r.horseId === id);
    setRegistrationId(reg ? reg.id : "");
  };

  const resetForm = () => {
    setHorseId("");
    setRegistrationId("");
    setGaitIssue("");
    setHoofAssessment("");
    setShoeType("铝蹄铁");
    setNailPosition("前蹄钉位");
    setTrimDate(isoDate(0));
    setNextRecheckDate(isoDate(14));
    setPhotoNote("");
    setAbnormalGait(false);
    setRequestClearance(true);
    setPatchShoeType("");
    setPatchNotes("");
  };

  const submit = async () => {
    if (!horseId || !registrationId) return;
    await createRecord({
      horseId,
      registrationId,
      gaitIssue,
      hoofAssessment,
      shoeType,
      nailPosition,
      trimDate,
      nextRecheckDate,
      photoNote,
      abnormalGait,
      requestClearance,
      registrationPatch:
        patchShoeType || patchNotes
          ? { shoeType: patchShoeType || undefined, notes: patchNotes || undefined }
          : undefined,
    });
    resetForm();
  };

  const pendingBatches = state.queue.filter((b) => b.status === "pending" || b.status === "failed" || b.status === "syncing");

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>现场登记</p>
          <h2>蹄部状况断网登记</h2>
        </div>
        <span className={"net-badge " + (state.online ? "online" : "offline")}>
          {state.online ? "联网" : "断网"} · 记录携带报名版本 v{selectedReg?.version ?? "—"}
        </span>
      </div>

      {!state.online && (
        <div className="banner warn">
          当前断网：记录将携带报名版本快照存入现场批次，回网后自动合并。同一报名版本被两边改过会留两份待裁决，后到记录不覆盖。
        </div>
      )}

      <div className="form-grid">
        <label>
          <span>马匹</span>
          <select value={horseId} onChange={(e) => selectHorse(e.target.value)}>
            <option value="">选择马匹…</option>
            {state.horses.map((h) => (
              <option key={h.id} value={h.id}>{h.code} · {h.name}</option>
            ))}
          </select>
        </label>

        <label>
          <span>比赛报名（携带版本）</span>
          <select value={registrationId} onChange={(e) => setRegistrationId(e.target.value)}>
            <option value="">选择报名…</option>
            {horseRegs.map((r) => (
              <option key={r.id} value={r.id}>{r.eventName} · v{r.version}</option>
            ))}
          </select>
        </label>

        <label>
          <span>步态问题</span>
          <input value={gaitIssue} onChange={(e) => setGaitIssue(e.target.value)} placeholder="如：右前蹄外侧磨耗" />
        </label>

        <label>
          <span>蹄形评估</span>
          <input value={hoofAssessment} onChange={(e) => setHoofAssessment(e.target.value)} placeholder="如：蹄形偏平" />
        </label>

        <label>
          <span>蹄铁类型</span>
          <input value={shoeType} onChange={(e) => setShoeType(e.target.value)} placeholder="如：铝蹄铁" />
        </label>

        <label>
          <span>钉位</span>
          <select value={nailPosition} onChange={(e) => setNailPosition(e.target.value)}>
            <option>前蹄钉位</option>
            <option>后蹄钉位</option>
            <option>左侧钉位</option>
            <option>右侧钉位</option>
          </select>
        </label>

        <label>
          <span>修蹄日期</span>
          <input type="date" value={trimDate} onChange={(e) => setTrimDate(e.target.value)} />
        </label>

        <label>
          <span>下次复查日期</span>
          <input type="date" value={nextRecheckDate} onChange={(e) => setNextRecheckDate(e.target.value)} />
        </label>

        <label className="full">
          <span>照片备注</span>
          <input value={photoNote} onChange={(e) => setPhotoNote(e.target.value)} placeholder="如：右前蹄外侧磨耗照片已归档" />
        </label>

        <label className="check">
          <input type="checkbox" checked={abnormalGait} onChange={(e) => setAbnormalGait(e.target.checked)} />
          <span>异常步态标记</span>
        </label>

        <label className="check">
          <input type="checkbox" checked={requestClearance} onChange={(e) => setRequestClearance(e.target.checked)} />
          <span>申请放行（随批次幂等提交，重传不重复扣放行记录）</span>
        </label>
      </div>

      <fieldset className="patch-fieldset">
        <legend>蹄铁师对报名的离线修改（基于 v{selectedReg?.version ?? "—"}）</legend>
        <div className="form-grid">
          <label>
            <span>修改蹄铁类型</span>
            <input value={patchShoeType} onChange={(e) => setPatchShoeType(e.target.value)} placeholder="留空则不修改" />
          </label>
          <label>
            <span>修改备注</span>
            <input value={patchNotes} onChange={(e) => setPatchNotes(e.target.value)} placeholder="留空则不修改" />
          </label>
        </div>
      </fieldset>

      <div className="form-actions">
        <button className="primary" onClick={submit} disabled={!horseId || !registrationId}>
          {state.online ? "保存并同步" : "断网保存（入队）"}
        </button>
        <button onClick={resetForm}>清空</button>
      </div>

      {pendingBatches.length > 0 && (
        <div className="queue">
          <h3>现场批次（{pendingBatches.length}）</h3>
          <div className="queue-list">
            {pendingBatches.map((b) => (
              <BatchRow key={b.id} batch={b} onRetry={() => syncBatch(b.id)} online={state.online} syncing={state.syncing} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function BatchRow({ batch, onRetry, online, syncing }: { batch: SyncBatch; onRetry: () => void; online: boolean; syncing: boolean }) {
  const statusMap = {
    pending: { label: "待同步", cls: "warn" },
    syncing: { label: "同步中", cls: "warn" },
    synced: { label: "已同步", cls: "ok" },
    failed: { label: "同步失败", cls: "err" },
  } as const;
  const s = statusMap[batch.status];
  return (
    <div className="queue-row">
      <div>
        <strong>批次 {batch.id.slice(0, 8)}</strong>
        <span className={"badge " + s.cls}>{s.label}</span>
        <small className="muted">{batch.recordIds.length} 条记录 · 尝试 {batch.attempts} 次</small>
        {batch.lastError && <small className="err-msg">{batch.lastError}</small>}
      </div>
      {batch.status === "failed" && (
        <button className="primary small" onClick={onRetry} disabled={!online || syncing}>
          重试
        </button>
      )}
    </div>
  );
}
