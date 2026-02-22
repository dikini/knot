import type { Page } from "@playwright/test";

interface MockBridgeFixture {
  recentVaults: Array<{ path: string; name: string; opened_at: number }>;
  vaultOpen: boolean;
  vaultInfo?: { path: string; name: string; note_count: number; last_modified: number } | null;
  notes?: Array<{
    id: string;
    path: string;
    title: string;
    created_at: number;
    modified_at: number;
    word_count: number;
  }>;
  noteDataByPath?: Record<
    string,
    {
      id: string;
      path: string;
      title: string;
      content: string;
      created_at: number;
      modified_at: number;
      word_count: number;
      headings: Array<{ level: number; text: string; position: number }>;
      backlinks: Array<{ source_path: string; source_title: string; context: string }>;
    }
  >;
  explorerTree?: {
    root: {
      path: string;
      name: string;
      expanded: boolean;
      folders: Array<unknown>;
      notes: Array<{
        path: string;
        title: string;
        display_title: string;
        modified_at: number;
        word_count: number;
      }>;
    };
    hidden_policy: string;
  } | null;
}

export async function installMockTauriBridge(
  page: Page,
  fixture: MockBridgeFixture = {
    recentVaults: [
      {
        path: "/tmp/knot-demo",
        name: "Demo Vault",
        opened_at: 1_700_000_000,
      },
    ],
    vaultOpen: false,
    vaultInfo: null,
    notes: [],
    noteDataByPath: {},
    explorerTree: null,
  }
): Promise<void> {
  await page.addInitScript((data: MockBridgeFixture) => {
    let callbackIndex = 1;
    const callbacks: Record<number, (payload: unknown) => void> = {};
    const noteDataByPath = { ...(data.noteDataByPath ?? {}) };
    const noteSummaries = [...(data.notes ?? [])];

    // Tauri event plugin internals used by @tauri-apps/api/event.
    (window as unknown as { __TAURI_EVENT_PLUGIN_INTERNALS__: { unregisterListener: () => void } })
      .__TAURI_EVENT_PLUGIN_INTERNALS__ = {
      unregisterListener() {
        // no-op in browser lane
      },
    };

    (window as unknown as {
      __TAURI_INTERNALS__: {
        invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
        transformCallback: (cb: (payload: unknown) => void) => number;
        unregisterCallback: (id: number) => void;
        convertFileSrc: (path: string, protocol?: string) => string;
      };
    }).__TAURI_INTERNALS__ = {
      async invoke(cmd: string, _args?: Record<string, unknown>) {
        if (cmd === "get_recent_vaults") return data.recentVaults;
        if (cmd === "is_vault_open") return data.vaultOpen;
        if (cmd === "get_vault_info") return data.vaultInfo ?? null;
        if (cmd === "list_notes") return noteSummaries;
        if (cmd === "get_note") {
          const path = String(_args?.path ?? "");
          return noteDataByPath[path] ?? null;
        }
        if (cmd === "save_note") {
          const path = String(_args?.path ?? "");
          const content = String(_args?.content ?? "");
          const existing = noteDataByPath[path];
          if (existing) {
            const modified_at = Math.floor(Date.now() / 1000);
            noteDataByPath[path] = {
              ...existing,
              content,
              modified_at,
              word_count: content.trim().length === 0 ? 0 : content.trim().split(/\s+/).length,
            };
            const idx = noteSummaries.findIndex((note) => note.path === path);
            if (idx >= 0) {
              noteSummaries[idx] = {
                ...noteSummaries[idx],
                modified_at,
                word_count: noteDataByPath[path].word_count,
              };
            }
          }
          return null;
        }
        if (cmd === "get_explorer_tree") return data.explorerTree ?? null;
        if (cmd === "plugin:event|listen") return 1;
        if (cmd === "plugin:event|unlisten") return null;
        if (cmd === "plugin:event|emit") return null;
        if (cmd === "plugin:event|emit_to") return null;
        if (cmd === "set_unsaved_changes") return null;
        if (cmd === "sync_external_changes") return null;
        return null;
      },
      transformCallback(cb: (payload: unknown) => void) {
        const id = callbackIndex++;
        callbacks[id] = cb;
        return id;
      },
      unregisterCallback(id: number) {
        delete callbacks[id];
      },
      convertFileSrc(path: string, protocol: string = "asset") {
        return `${protocol}://${path}`;
      },
    };
  }, fixture);
}
