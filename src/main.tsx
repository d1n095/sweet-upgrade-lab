import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import App from "./App.tsx";
import "./index.css";
import { useWorkQueueStore } from "@/stores/workQueueStore";
import { useSystemStateStore } from "@/stores/systemStateStore";

// SYSTEM RECOVERY MODE (boot):
//   - Pause background work queue immediately so stale tasks cannot run.
//   - Enable recovery flag so panels prefer empty states over heavy recompute.
try {
  useWorkQueueStore.getState().pauseQueue();
  useSystemStateStore.getState().setRecoveryMode(true);
} catch (err) {
  // Never block boot on recovery setup
  // eslint-disable-next-line no-console
  console.warn("[boot] recovery init failed (non-blocking):", err);
}

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <App />
  </ThemeProvider>
);
