// 禁用蹄铁清单：秘书修改清单，版本 +1，全部放行结论立即失效
import { useState } from "react";
import { useApp } from "../lib/store";

const SUGGESTIONS = ["重型铁蹄", "带钉蹄铁", "铁蹄", "防滑钉蹄", "重型蹄铁"];

export default function BannedListEditor() {
  const { state, updateBannedList } = useApp();
  const [items, setItems] = useState<string[]>(state.bannedListItems);
  const [newItem, setNewItem] = useState("");

  const add = () => {
    const v = newItem.trim();
    if (v && !items.includes(v)) {
      const next = [...items, v];
      setItems(next);
      void updateBannedList(next);
    }
    setNewItem("");
  };

  const remove = (item: string) => {
    const next = items.filter((i) => i !== item);
    setItems(next);
    void updateBannedList(next);
  };

  const addSuggestion = (s: string) => {
    if (!items.includes(s)) {
      const next = [...items, s];
      setItems(next);
      void updateBannedList(next);
    }
  };

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>禁用蹄铁清单</p>
          <h2>禁用蹄铁类型管理</h2>
        </div>
        <span className="version-tag">v{state.bannedListVersion}</span>
      </div>

      <div className="banner warn">
        清单版本一变，全部放行结论立即失效，要求逐匹重检。当前版本 v{state.bannedListVersion}。
      </div>

      <div className="banned-list">
        {items.map((item) => (
          <span key={item} className="banned-chip">
            {item}
            <button onClick={() => remove(item)} disabled={!state.online} title="移除">×</button>
          </span>
        ))}
        {items.length === 0 && <span className="muted">暂无禁用蹄铁类型</span>}
      </div>

      <div className="banned-add">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="输入禁用蹄铁类型，如：铁蹄"
          disabled={!state.online}
        />
        <button className="primary" onClick={add} disabled={!state.online || !newItem.trim()}>添加并更新版本</button>
      </div>

      <div className="banned-suggestions">
        <span className="muted">建议：</span>
        {SUGGESTIONS.filter((s) => !items.includes(s)).map((s) => (
          <button key={s} className="small" onClick={() => addSuggestion(s)} disabled={!state.online}>
            + {s}
          </button>
        ))}
      </div>
    </section>
  );
}
