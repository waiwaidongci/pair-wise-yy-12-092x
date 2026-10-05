// 马术蹄铁修整档案 · 放行台 —— 主入口（Tab 布局）
import { useState } from "react";
import { AppProvider } from "./lib/provider";
import { useApp } from "./lib/store";
import Header from "./components/Header";
import ClearanceDesk from "./components/ClearanceDesk";
import OnSiteRegistration from "./components/OnSiteRegistration";
import ConflictQueue from "./components/ConflictQueue";
import HorseRegistry from "./components/HorseRegistry";
import RecheckReminders from "./components/RecheckReminders";
import ShoeHistory from "./components/ShoeHistory";
import BannedListEditor from "./components/BannedListEditor";
import "./styles.css";

type Tab = "desk" | "register" | "conflicts" | "horses" | "reminders" | "history" | "banned";

const TABS: { key: Tab; label: string }[] = [
  { key: "desk", label: "放行台" },
  { key: "register", label: "现场登记" },
  { key: "conflicts", label: "待裁决" },
  { key: "horses", label: "马匹与报名" },
  { key: "reminders", label: "复查提醒" },
  { key: "history", label: "蹄铁历史" },
  { key: "banned", label: "禁用清单" },
];

function Flash() {
  const { state, dispatch } = useApp();
  if (!state.flash) return null;
  return (
    <div className="flash" onClick={() => dispatch({ type: "SET_FLASH", flash: null })}>
      {state.flash}
    </div>
  );
}

function Main() {
  const [tab, setTab] = useState<Tab>("desk");
  const { state } = useApp();

  const pendingConflicts = state.conflicts.filter((c) => c.status === "pending").length;
  const pendingBatches = state.queue.filter((b) => b.status === "pending" || b.status === "failed").length;

  return (
    <div className="app">
      <Header />
      <Flash />

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={"tab " + (tab === t.key ? "active" : "")}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === "conflicts" && pendingConflicts > 0 && <span className="tab-badge">{pendingConflicts}</span>}
            {t.key === "register" && pendingBatches > 0 && <span className="tab-badge">{pendingBatches}</span>}
          </button>
        ))}
      </nav>

      <main className="tab-content">
        {tab === "desk" && <ClearanceDesk />}
        {tab === "register" && <OnSiteRegistration />}
        {tab === "conflicts" && <ConflictQueue />}
        {tab === "horses" && <HorseRegistry />}
        {tab === "reminders" && <RecheckReminders />}
        {tab === "history" && <ShoeHistory />}
        {tab === "banned" && <BannedListEditor />}
      </main>

      <footer className="foot">
        <span>数据保存在浏览器 localStorage，断网登记入队、回网合并 · 冲突留两份待裁决 · 放行结论随禁用清单/复查日期失效</span>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Main />
    </AppProvider>
  );
}
