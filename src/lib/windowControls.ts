import { emit } from "@tauri-apps/api/event";

// SPEC: COMP-WINDOW-STARTUP-003 FR-1, FR-4
export function isDesktopTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// SPEC: COMP-WINDOW-STARTUP-003 FR-1, FR-4
export async function signalFrontendReady(): Promise<void> {
  if (!isDesktopTauri()) return;
  await emit("frontend://ready");
}
