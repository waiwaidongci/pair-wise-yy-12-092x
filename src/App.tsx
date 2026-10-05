import { useState } from "react";
import { TopBar } from "./components/TopBar";
import { ClearanceDesk } from "./components/ClearanceDesk";
import { FieldDesk } from "./components/FieldDesk";
import { OfficeDesk } from "./components/OfficeDesk";
import { Conflicts } from "./components/Conflicts";
import { Outbox } from "./components/Outbox";
import { useField } from "./hooks/useStores";
import { syncAllPending } from "./lib/fieldStore";

export default function App() {
  const [tab, setTab] = useState("desk");
  const field = useField();
  const pending = field.batches.filter((b) => b.status === "待同步" || b.status === "同步失败").length;

  return (
    <div className="app-shell">
      <TopBar tab={tab} setTab={setTab} />
      {field.net === "online" && pending > 0 && (
        <div className="banner merge-banner">
          🔗 已回网，有 <b>{pending}</b> 个现场批次待合并 →{" "}
          <button className="link-btn" onClick={() => syncAllPending()}>
            立即合并
          </button>
          <button className="link-btn" onClick={() => setTab("outbox")}>
            查看批次
          </button>
        </div>
      )}
      {field.net === "offline" && (
        <div className="banner offline-banner">
          📴 场边断网中：登记照常进行，记录携带报名/清单/复查版本快照，回网后合并；后到记录不覆盖，同版本两边改动作冲突处理。
        </div>
      )}
      {tab === "desk" && <ClearanceDesk />}
      {tab === "field" && <FieldDesk />}
      {tab === "office" && <OfficeDesk />}
      {tab === "conflicts" && <Conflicts />}
      {tab === "outbox" && <Outbox />}
      <footer className="app-footer">
        规则：版本化报名 · 冲突双留待裁决（后到不覆盖）· 禁用清单/复查变更即时失效要求重检 · 批次幂等重试不重复扣放行记录
      </footer>
    </div>
  );
}
