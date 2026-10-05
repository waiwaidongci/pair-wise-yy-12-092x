import { useSyncExternalStore } from "react";
import { getField, subscribeField } from "../lib/fieldStore";
import { getServer, subscribeServer } from "../lib/serverStore";

export function useServer() {
  return useSyncExternalStore(subscribeServer, getServer, getServer);
}

export function useField() {
  return useSyncExternalStore(subscribeField, getField, getField);
}

/** 跨 store 联动（现场批次同步后服务器变化也会触发本组件重渲染） */
export function useBoth() {
  const server = useServer();
  const field = useField();
  return { server, field };
}
