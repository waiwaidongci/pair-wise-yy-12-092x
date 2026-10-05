import { useState } from "react";
import { useBoth } from "../hooks/useStores";
import { deskRows } from "../lib/selectors";
import { officeEditEntry, officeSetBanned, officeSetRecheck } from "../lib/serverStore";
import { TODAY } from "../lib/utils";
import type { RaceEntry } from "../types";
import { Badge, Panel } from "./ui";
import { SHOE_TYPES } from "../types";

export function OfficeDesk() {
  const { server, field } = useBoth();
  const rows = deskRows(server);

  return (
    <div className="page">
      <div className="banner info-banner">
        🏢 赛事秘书办公室操作。报名修改会使版本号 +1（断网现场记录回网时若版本对不上 → 两份留存待裁决）；
        禁用清单或复查日期一旦变更，<b>相关放行结论立即失效并要求重检</b>。
        {field.net === "offline" && <span> 当前现场端处于断网状态，修改将在其回网合并时显现为冲突/失效。</span>}
      </div>

      <div className="two-col">
        <Panel title="禁用蹄铁清单" sub={`当前 v${server.banned.version}，勾选即禁用；保存后版本 +1`}>
          <BannedEditor bannedItems={server.banned.items} version={server.banned.version} />
        </Panel>
        <Panel title="复查提醒（下次复查日期）">
          <div className="recheck-editor">
            {rows.map((r) => (
              <div key={r.entry.id} className="recheck-row">
                <div>
                  <b>{r.horse.horseId}</b> {r.horse.name}
                  <Badge tone={r.recheckDays < 0 ? "bad" : r.recheckDays <= 7 ? "warn" : "idle"}>{r.recheckStatus}</Badge>
                </div>
                <div className="inline">
                  <input
                    type="date"
                    defaultValue={r.recheckDate}
                    min={TODAY}
                    onBlur={(e) => e.target.value !== r.recheckDate && officeSetRecheck(r.horse.horseId, e.target.value)}
                  />
                  <span className="muted small">v{r.recheckVersion}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="比赛报名管理（版本化）">
        <div className="table-wrap">
          <table className="desk-table">
            <thead>
              <tr>
                <th>马匹</th>
                <th>场次/名称</th>
                <th>骑师</th>
                <th>状态</th>
                <th>版本</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {server.entries.map((e) => (
                <EntryEditor key={e.id} entry={e} />
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function BannedEditor({ bannedItems, version }: { bannedItems: string[]; version: number }) {
  const [picked, setPicked] = useState<Set<string>>(new Set(bannedItems));
  const dirty = picked.size !== bannedItems.length || [...picked].some((x) => !bannedItems.includes(x));
  return (
    <div>
      <div className="check-list">
        {SHOE_TYPES.map((s) => (
          <label key={s} className={picked.has(s) ? "check on" : "check"}>
            <input
              type="checkbox"
              checked={picked.has(s)}
              onChange={(ev) => {
                const next = new Set(picked);
                ev.target.checked ? next.add(s) : next.delete(s);
                setPicked(next);
              }}
            />
            {s}
          </label>
        ))}
      </div>
      <div className="row-actions">
        <button className="primary" disabled={!dirty} onClick={() => officeSetBanned([...picked])}>
          保存清单（v{version} → v{version + 1}）
        </button>
        {!dirty && <span className="muted">未改动</span>}
      </div>
      <p className="muted small">使用“禁用状态发生翻转”蹄铁的有效/不予放行结论都会立即失效。</p>
    </div>
  );
}

function EntryEditor({ entry }: { entry: RaceEntry }) {
  const { server } = useBoth();
  const horse = server.horses.find((h) => h.horseId === entry.horseId);
  const [raceNo, setRaceNo] = useState(entry.raceNo);
  const [raceName, setRaceName] = useState(entry.raceName);
  const [jockey, setJockey] = useState(entry.jockey);
  const [status, setStatus] = useState(entry.status);
  const dirty = raceNo !== entry.raceNo || raceName !== entry.raceName || jockey !== entry.jockey || status !== entry.status;

  return (
    <tr>
      <td>
        {horse?.horseId} {horse?.name}
      </td>
      <td>
        <div className="inline">
          <input className="w80" value={raceNo} onChange={(e) => setRaceNo(e.target.value)} />
          <input value={raceName} onChange={(e) => setRaceName(e.target.value)} />
        </div>
      </td>
      <td>
        <input value={jockey} onChange={(e) => setJockey(e.target.value)} />
      </td>
      <td>
        <select value={status} onChange={(e) => setStatus(e.target.value as RaceEntry["status"])}>
          <option>已报名</option>
          <option>候补</option>
          <option>退赛</option>
        </select>
      </td>
      <td>
        <Badge tone="info">v{entry.version}</Badge>
      </td>
      <td>
        <button
          className="primary small-btn"
          disabled={!dirty}
          onClick={() => {
            officeEditEntry(entry.id, { raceNo, raceName, jockey, status });
          }}
        >
          保存（v{entry.version}→v{entry.version + 1}）
        </button>
      </td>
    </tr>
  );
}
