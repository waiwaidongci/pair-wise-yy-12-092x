import { useMemo, useState } from "react";
import { useBoth } from "../hooks/useStores";
import { addFieldRecord, refreshSeen, sealBatch, suggestClearance, syncBatch } from "../lib/fieldStore";
import { shiftDate, TODAY } from "../lib/utils";
import type { HoofMap, HoofPos, Inspection } from "../types";
import { Badge, Field, Panel } from "./ui";

const EMPTY_HOOVES: HoofMap = {
  LF: { condition: "", note: "" },
  RF: { condition: "", note: "" },
  LH: { condition: "", note: "" },
  RH: { condition: "", note: "" },
};

export function FieldDesk() {
  const { server, field } = useBoth();
  const [entryId, setEntryId] = useState(server.entries[0]?.id ?? "");
  const [shoeType, setShoeType] = useState("铝蹄铁");
  const [nailPositions, setNailPositions] = useState("标准 8 钉");
  const [abnormal, setAbnormal] = useState(false);
  const [gaitIssue, setGaitIssue] = useState("");
  const [assessment, setAssessment] = useState("");
  const [recheckDays, setRecheckDays] = useState(14);
  const [photoNote, setPhotoNote] = useState("");
  const [hooves, setHooves] = useState<HoofMap>(EMPTY_HOOVES);
  const [override, setOverride] = useState<"auto" | "放行" | "不予放行">("auto");
  const [flash, setFlash] = useState<string>("");

  const seenEntry = field.seen?.entries[entryId];
  const serverEntry = server.entries.find((e) => e.id === entryId);
  const recheckDate = shiftDate(TODAY, recheckDays);
  const horse = server.horses.find((h) => h.horseId === (serverEntry?.horseId ?? seenEntry?.entry.horseId));

  const suggestion = useMemo(
    () => suggestClearance(entryId, shoeType, abnormal, recheckDate),
    [entryId, shoeType, abnormal, recheckDate, field.seen]
  );
  const finalResult = override === "auto" ? suggestion.result : override;
  const versionMismatch = seenEntry && serverEntry ? seenEntry.entry.version !== serverEntry.version : false;

  function save() {
    if (!entryId) return;
    const inspection: Inspection = {
      gaitIssue,
      hoofAssessment: assessment,
      abnormalGait: abnormal,
      shoeType,
      nailPositions,
      recheckDate,
      photoNote,
      hooves,
    };
    const rec = addFieldRecord({
      entryId,
      inspection,
      result: finalResult,
      reason: (override !== "auto" ? "人工覆盖：" : "") + suggestion.reason,
    });
    setFlash(
      `已登记 ${rec.horseId}（${finalResult}）→ 现场批次 ${rec.batchId}；携带报名 v${rec.base.entry}/清单 v${rec.base.banned}/复查 v${rec.base.recheck}`
    );
    setHooves(EMPTY_HOOVES);
  }

  const draftBatch = field.batches.find((b) => b.status === "编辑中");

  return (
    <div className="page">
      <Panel
        title="场边蹄部检查登记"
        sub={
          field.net === "offline"
            ? "当前断网：记录写入本地批次并冻结版本快照，回网后按批次合并"
            : "在线：登记前会缓存服务器报名/清单版本；登记后也可随时断网继续"
        }
        right={
          <button className="ghost" onClick={refreshSeen} disabled={field.net === "offline"}>
            刷新版本快照
          </button>
        }
      >
        {field.net === "offline" && field.seen && (
          <div className="banner warn-banner">
            📴 离线模式 · 快照时间 {new Date(field.seen.at).toLocaleTimeString("zh-CN", { hour12: false })} ·
            清单 v{field.seen.bannedVersion}。办公室此刻若改报名，回网将按版本冲突处理。
          </div>
        )}
        {versionMismatch && field.net === "online" && (
          <div className="banner info-banner">
            ℹ 本地缓存报名 v{seenEntry!.entry.version}，服务器已为 v{serverEntry!.version}，已刷新按钮可同步最新版本（保存将按当前缓存版本登记）。
          </div>
        )}

        <div className="form-grid">
          <Field label="比赛报名（马匹）">
            <select value={entryId} onChange={(e) => setEntryId(e.target.value)}>
              {server.entries.map((e) => {
                const h = server.horses.find((x) => x.horseId === e.horseId);
                return (
                  <option key={e.id} value={e.id}>
                    {e.raceNo} {e.raceName} · {h?.horseId} {h?.name}
                  </option>
                );
              })}
            </select>
          </Field>
          <Field label="钉位">
            <input value={nailPositions} onChange={(e) => setNailPositions(e.target.value)} />
          </Field>
          <Field label="蹄铁类型">
            <select value={shoeType} onChange={(e) => setShoeType(e.target.value)}>
              {["铝蹄铁", "钢蹄铁", "塑料蹄铁", "加护蹄垫", "裸蹄（无蹄铁）"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="下次复查日期" hint={`${recheckDays >= 0 ? `${recheckDays} 天后` : `逾期${-recheckDays}天`}`}>
            <div className="inline">
              <input type="date" value={recheckDate} onChange={(e) => setRecheckDays(Math.round((+new Date(e.target.value) - +new Date(TODAY)) / 86400000))} />
            </div>
          </Field>
          <Field label="步态问题">
            <input value={gaitIssue} onChange={(e) => setGaitIssue(e.target.value)} placeholder="如：右前外侧磨耗" />
          </Field>
          <Field label="蹄形评估">
            <input value={assessment} onChange={(e) => setAssessment(e.target.value)} placeholder="如：蹄形对称、角度正常" />
          </Field>
          <Field label="异常步态">
            <div className="switch-row">
              <button type="button" className={abnormal ? "seg-btn on bad" : "seg-btn"} onClick={() => setAbnormal(!abnormal)}>
                {abnormal ? "已标记异常步态" : "步态正常"}
              </button>
            </div>
          </Field>
          <Field label="照片/备注">
            <input value={photoNote} onChange={(e) => setPhotoNote(e.target.value)} placeholder="照片编号或文字备注" />
          </Field>
        </div>

        <h4 className="sub-title">左前 / 右前 / 左后 / 右后 蹄对比</h4>
        <div className="hoof-input-grid">
          {(["LF", "RF", "LH", "RH"] as HoofPos[]).map((pos) => (
            <div key={pos} className="hoof-input">
              <b>{pos}</b>
              <input
                placeholder="蹄况（磨耗/裂纹…）"
                value={hooves[pos].condition}
                onChange={(e) => setHooves({ ...hooves, [pos]: { ...hooves[pos], condition: e.target.value } })}
              />
              <input
                placeholder="备注/照片"
                value={hooves[pos].note}
                onChange={(e) => setHooves({ ...hooves, [pos]: { ...hooves[pos], note: e.target.value } })}
              />
            </div>
          ))}
        </div>

        <div className="clearance-box">
          <div>
            <Badge tone={suggestion.result === "放行" ? "ok" : "bad"}>系统建议：{suggestion.result}</Badge>
            <p className="muted">{suggestion.reason}</p>
          </div>
          <div className="seg">
            {(["auto", "放行", "不予放行"] as const).map((o) => (
              <button key={o} className={override === o ? "seg-btn on" : "seg-btn"} onClick={() => setOverride(o)}>
                {o === "auto" ? "采用建议" : o}
              </button>
            ))}
          </div>
          <button className="primary" onClick={save}>
            {field.net === "offline" ? "断网保存进批次" : "保存登记"}
          </button>
        </div>
        {flash && <div className="banner ok-banner">✅ {flash}</div>}
        {horse && (
          <p className="muted small">
            档案参考：{horse.horseId} {horse.name} · {horse.hoofAssessment}
            {horse.abnormalGait && " · 档案已标记异常步态"}
          </p>
        )}
      </Panel>

      <Panel title="当前编辑批次（未封批）">
        {!draftBatch || draftBatch.records.length === 0 ? (
          <p className="empty">还没有登记记录。</p>
        ) : (
          <>
            <table className="mini-table">
              <thead>
                <tr>
                  <th>记录键</th>
                  <th>马匹</th>
                  <th>蹄铁</th>
                  <th>结论</th>
                  <th>携带版本</th>
                </tr>
              </thead>
              <tbody>
                {draftBatch.records.map((r) => (
                  <tr key={r.clientId}>
                    <td>
                      <small>{r.clientId}</small>
                    </td>
                    <td>{r.horseId}</td>
                    <td>{r.shoeType}</td>
                    <td>
                      <Badge tone={r.result === "放行" ? "ok" : "bad"}>{r.result}</Badge>
                    </td>
                    <td>
                      <small>
                        报名 v{r.base.entry}/清单 v{r.base.banned}/复查 v{r.base.recheck}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row-actions">
              <button className="primary" onClick={() => sealBatch(draftBatch.batchId)}>
                封批并加入同步队列
              </button>
              <span className="muted">共 {draftBatch.records.length} 条 · 批次 {draftBatch.batchId}</span>
            </div>
          </>
        )}
      </Panel>

      <PendingQuickSync />
    </div>
  );
}

function PendingQuickSync() {
  const { field } = useBoth();
  const pendings = field.batches.filter((b) => b.status === "待同步" || b.status === "同步失败");
  if (pendings.length === 0) return null;
  return (
    <Panel title="待回网批次" sub="失败批次可反复重试，重传不会重复扣放行记录">
      <ul className="batch-list">
        {pendings.map((b) => (
          <li key={b.batchId}>
            <div>
              <b>{b.batchId}</b> <Badge tone={b.status === "同步失败" ? "bad" : "warn"}>{b.status}</Badge>
              <p className="muted small">
                {b.records.length} 条 · 尝试 {b.attempts} 次{b.error ? ` · ${b.error}` : ""}
                {b.resultNote ? ` · ${b.resultNote}` : ""}
              </p>
            </div>
            <button className="primary" onClick={() => syncBatch(b.batchId)} disabled={field.net === "offline"}>
              {field.net === "offline" ? "断网中不可同步" : b.attempts === 0 ? "立即合并" : "重试合并"}
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
