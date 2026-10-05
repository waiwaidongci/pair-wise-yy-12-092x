import type { ReactNode } from "react";

export function Badge({ tone = "idle", children }: { tone?: "ok" | "bad" | "stale" | "idle" | "warn" | "info"; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Panel({ title, sub, right, children }: { title: string; sub?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>{title}</h2>
          {sub && <p className="panel-sub">{sub}</p>}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>
        {label}
        {hint && <em className="field-hint">{hint}</em>}
      </span>
      {children}
    </label>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="empty">{text}</p>;
}
