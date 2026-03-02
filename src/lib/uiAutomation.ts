import type { ShellToolMode } from "./store";

export interface UiAutomationAction {
  id: string;
  label: string;
  description: string;
  origin: string;
  input_schema?: Record<string, unknown>;
  available?: boolean;
}

export interface UiAutomationView {
  id: string;
  label: string;
  description: string;
  origin: string;
  screenshotable?: boolean;
  visible?: boolean;
}

export interface UiAutomationBehavior {
  id: string;
  label: string;
  description: string;
  origin: string;
  input_schema?: Record<string, unknown>;
  available?: boolean;
}

export interface UiAutomationViewFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UiAutomationStateSnapshot {
  active_view: string;
  active_note_path: string | null;
  tool_mode: string | null;
  inspector_open: boolean;
  vault_open: boolean;
  view_frames: Record<string, UiAutomationViewFrame>;
  window_pixel_ratio: number;
  diagnostics?: Record<string, unknown>;
}

export interface UiAutomationCompletion {
  success: boolean;
  message: string;
  payload?: Record<string, unknown> | null;
  error_code?: string | null;
}

export type UiAutomationFrontendRequest =
  | {
      kind: "invoke_action";
      request_id: string;
      action_id: string;
      args?: Record<string, unknown>;
    }
  | {
      kind: "invoke_behavior";
      request_id: string;
      behavior_id: string;
      args?: Record<string, unknown>;
    }
  | {
      kind: "capture_screenshot";
      request_id: string;
      target: string;
      target_id?: string | null;
      name?: string | null;
    };

function supportsNativeWindowScreenshot(): boolean {
  return (
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in window &&
    window.navigator.userAgent.toLowerCase().includes("linux")
  );
}

export function buildUiAutomationRegistry(): {
  actions: UiAutomationAction[];
  views: UiAutomationView[];
  behaviors: UiAutomationBehavior[];
} {
  const nativeWindowScreenshot = supportsNativeWindowScreenshot();

  return {
    actions: [
      {
        id: "core.navigate.view",
        label: "Open view",
        description: "Switch the main content surface between editor, graph, and settings.",
        origin: "core",
        available: true,
        input_schema: {
          type: "object",
          properties: {
            view: { type: "string", enum: ["editor", "graph", "settings"] },
          },
          required: ["view"],
        },
      },
      {
        id: "core.navigate.note",
        label: "Open note",
        description: "Load a note by vault-relative path and switch to the editor surface.",
        origin: "core",
        available: true,
        input_schema: {
          type: "object",
          properties: {
            path: { type: "string" },
          },
          required: ["path"],
        },
      },
      {
        id: "core.select.tool-mode",
        label: "Select tool mode",
        description: "Switch the context panel tool mode.",
        origin: "core",
        available: true,
        input_schema: {
          type: "object",
          properties: {
            toolMode: { type: "string", enum: ["notes", "search", "graph"] },
          },
          required: ["toolMode"],
        },
      },
      {
        id: "core.select.editor-mode",
        label: "Select editor mode",
        description: "Switch the current note surface between metadata, source, edit, and view modes.",
        origin: "core",
        available: true,
        input_schema: {
          type: "object",
          properties: {
            mode: { type: "string", enum: ["meta", "source", "edit", "view"] },
          },
          required: ["mode"],
        },
      },
    ],
    views: [
      {
        id: "window.main",
        label: "Main window",
        description: "Entire Knot application shell.",
        origin: "core",
        screenshotable: nativeWindowScreenshot,
        visible: true,
      },
      {
        id: "view.editor",
        label: "Editor view",
        description: "Note editing surface.",
        origin: "core",
        screenshotable: nativeWindowScreenshot,
      },
      {
        id: "view.graph",
        label: "Graph view",
        description: "Graph exploration surface.",
        origin: "core",
        screenshotable: nativeWindowScreenshot,
      },
      {
        id: "view.settings",
        label: "Settings view",
        description: "Application and vault settings surface.",
        origin: "core",
        screenshotable: nativeWindowScreenshot,
      },
    ],
    behaviors: [
      {
        id: "core.task.toggle",
        label: "Toggle task",
        description: "Toggle a markdown task list item in a note by visible task order.",
        origin: "core",
        available: true,
        input_schema: {
          type: "object",
          properties: {
            path: { type: "string" },
            taskIndex: { type: "integer", minimum: 0 },
            mode: { type: "string", enum: ["view", "edit", "source"] },
          },
          required: ["path", "taskIndex"],
        },
      },
    ],
  };
}

export function buildUiAutomationState(input: {
  viewMode: "editor" | "graph" | "settings";
  currentNotePath: string | null;
  toolMode: ShellToolMode;
  inspectorOpen: boolean;
  vaultOpen: boolean;
  viewFrames: Record<string, UiAutomationViewFrame>;
  diagnostics?: Record<string, unknown>;
}): UiAutomationStateSnapshot {
  return {
    active_view: `view.${input.viewMode}`,
    active_note_path: input.currentNotePath,
    tool_mode: input.toolMode,
    inspector_open: input.inspectorOpen,
    vault_open: input.vaultOpen,
    view_frames: input.viewFrames,
    diagnostics: input.diagnostics ?? {},
    window_pixel_ratio:
      typeof window !== "undefined" && Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : 1,
  };
}
