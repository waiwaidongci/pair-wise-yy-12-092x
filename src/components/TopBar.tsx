import { pendingCount, resetField, setFailMode, setNet } from "../lib/fieldStore";
import { resetServer } from "../lib/serverStore";
import type { FailMode, NetMode } from "../types";
import { useBoth } from "../hooks/useStores";

export function TopBar({ tab, setTab }: { tab: string; setTab: (t: string) => void }) {
  const { server, field } = useBoth();
  const pending = pendingCount();
  const openConflicts = server.conflicts.filter((c) => c.status === "待裁决").length;

  const failLabel: Record<FailMode, string> = {
    none: "链路正常",
    request: "故障：请求丢失",
    responseLost: "故障：回执丢失",
  };

  return (
    <header className="topbar">
      <div className="brand">
        <h1>🐎 放行台</h1>
        <p>
          马匹档案 · 比赛报名 · 复查提醒 · 蹄铁更换历史
          <small>hxyfront-62011 · 断网登记 / 回网合并 / 冲突裁决</small>
        </p>
      </div>

      <nav className="tabs">
        {[
          ["desk", "放行台"],
          ["field", "场边登记（蹄铁师）"],
          ["office", "办公室（赛事秘书）"],
          ["conflicts", "冲突裁决"],
          ["outbox", "同步批次"],
        ].map(([key, label]) => (
          <button key={key} className={tab === key ? "tab active" : "tab"} onClick={() => setTab(key)}>
            {label}
            {key === "conflicts" && openConflicts > 0 && <span className="tab-dot">{openConflicts}</span>}
            {key === "outbox" && pending > 0 && <span className="tab-dot warn">{pending}</span>}
          </button>
        ))}
      </nav>

      <div className="net-controls">
        <div className={`net-state ${field.net}`}>
          <span className="net-dot" />
          {field.net === "online" ? "在线" : "断网（场边）"}
        </div>
        <div className="seg">
          {(["online", "offline"] as NetMode[]).map((n) => (
            <button key={n} className={field.net === n ? "seg-btn on" : "seg-btn"} onClick={() => setNet(n)}>
              {n === "online" ? "回网" : "断网"}
            </button>
          ))}
        </div>
        <select value={field.fail} onChange={(e) => setFailMode(e.target.value as FailMode)} title="同步故障注入">
          {(["none", "request", "responseLost"] as FailMode[]).map((f) => (
            <option key={f} value={f}>
              {failLabel[f]}
            </option>
          ))}
        </select>
        <button
          className="ghost"
          onClick={() => {
            resetServer();
            resetField();
          }}
        >
          重置演示
        </button>
      </div>
    </header>
  );
}
