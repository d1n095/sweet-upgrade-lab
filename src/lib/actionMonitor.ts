import { create } from "zustand";

export type EventType = "api" | "db" | "scan" | "error" | "action";
export type EventSource = "safeInvoke" | "db" | "scanner" | "ui" | "edge";

export interface MonitorEvent {
  id: string;
  type: EventType;
  source: EventSource;
  label: string;
  status: "ok" | "error" | "pending";
  payload?: unknown;
  timestamp: string;
}

interface ActionMonitorState {
  events: MonitorEvent[];
  lastError: MonitorEvent | null;
  lastScan: MonitorEvent | null;
  logEvent: (event: Omit<MonitorEvent, "id" | "timestamp">) => void;
  clearEvents: () => void;
}

export const useActionMonitorStore = create<ActionMonitorState>((set) => ({
  events: [],
  lastError: null,
  lastScan: null,
  logEvent: (event) => {
    const full: MonitorEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    set((s) => ({
      events: [full, ...s.events].slice(0, 200),
      lastError: event.status === "error" ? full : s.lastError,
      lastScan: event.type === "scan" ? full : s.lastScan,
    }));
  },
  clearEvents: () => set({ events: [], lastError: null, lastScan: null }),
}));

export function logEvent(event: Omit<MonitorEvent, "id" | "timestamp">) {
  useActionMonitorStore.getState().logEvent(event);
}
