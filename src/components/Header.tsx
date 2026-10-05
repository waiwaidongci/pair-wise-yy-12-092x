// 顶栏：标题、断网/回网切换、同步状态、待处理批次
import { useApp } from "../lib/store";
import { setFailNextSync, getFailNextSync } from "../lib/backend";
import { useState } from "react";

export default function Header() {
  const { state, dispatch, syncAll } = useApp();
  const [failNext, setFailNext] = useState(getFailNextSync());

  const pendingCount = state.queue.filter((b) => b.status === "pending" || b.status === "failed").length;
  const failedCount = state.queue.filter((b) => b.status === "failed").length;

  const toggleOnline = () => {
    dispatch({ type: "SET_ONLINE", online: !state.online });
  };

  const toggleFail = () => {
    const next = !failNext;
    setFailNext(next);
    setFailNextSync(next);
    setFailNext(next);
  };

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <span className="brand-mark">蹄</span>
          <div>
            <h1>马术蹄铁修整档案 · 放行台</h1>
            <p className="brand-sub">马匹档案 · 比赛报名 · 复查提醒 · 蹄铁更换历史</p>
          </div>
        </div>

        <div className="topbar-actions">
          <label className="fail-toggle" title="开启后，下一次同步会模拟网络故障，用于演示现场批次重试">
            <input type="checkbox" checked={failNext} onChange={toggleFail} />
            <span>模拟同步失败</span>
          </label>

          <button
            className={"net-toggle " + (state.online ? "online" : "offline")}
            onClick={toggleOnline}
            title={state.online ? "点击切换为断网（蹄铁师现场登记）" : "点击恢复联网（回网合并）"}
          >
            <span className="net-dot" />
            {state.online ? "联网中" : "断网中"}
          </button>

          <button className="primary sync-btn" onClick={syncAll} disabled={!state.online || state.syncing || pendingCount === 0}>
            {state.syncing ? "同步中…" : `回网同步${pendingCount > 0 ? `（${pendingCount}）` : ""}`}
          </button>
        </div>
      </div>

      <div className="topbar-status">
        <span className={"status-pill " + (state.online ? "ok" : "warn")}>
          {state.online ? "● 联网：可修改报名与禁用清单" : "○ 断网：现场登记入队，回网后合并"}
        </span>
        {failedCount > 0 && <span className="status-pill err">{failedCount} 个批次同步失败，可重试</span>}
        {state.conflicts.filter((c) => c.status === "pending").length > 0 && (
          <span className="status-pill err">
            {state.conflicts.filter((c) => c.status === "pending").length} 条冲突待裁决
          </span>
        )}
        {state.lastSyncAt && <span className="status-pill muted">上次同步 {new Date(state.lastSyncAt).toLocaleTimeString("zh-CN")}</span>}
      </div>
    </header>
  );
}
