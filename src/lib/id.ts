// 生成唯一 ID（优先使用 crypto.randomUUID）
export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** 短 ID，用于展示 */
export function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8);
}
