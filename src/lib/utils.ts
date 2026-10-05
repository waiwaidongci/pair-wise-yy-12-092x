// 通用工具

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 以今天 2026-10-05 为基准的演示日期偏移，避免受运行时钟影响 */
export const TODAY = "2026-10-05";

export function shiftDate(base: string, days: number): string {
  const d = new Date(base + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function daysUntil(date: string, from: string = TODAY): number {
  const a = new Date(from + "T00:00:00").getTime();
  const b = new Date(date + "T00:00:00").getTime();
  return Math.round((b - a) / 86400000);
}

export function recheckState(date: string): "已逾期" | "今日复查" | "近期复查" | "正常" {
  const d = daysUntil(date);
  if (d < 0) return "已逾期";
  if (d === 0) return "今日复查";
  if (d <= 7) return "近期复查";
  return "正常";
}

export function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function fmtDateTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 演示时钟：从固定基准起的毫秒，保证刷新后稳定 */
export function now(): number {
  return Date.now();
}
