import { describe, expect, it } from "vitest";
import {
  DEFAULT_APP_KEYMAP_SETTINGS,
  expandManagedShortcutMap,
  matchesShortcutEvent,
  validateAppKeymapSettings,
} from "./keymapSettings";

describe("app keymap settings", () => {
  it("expands the default managed shortcuts into runtime descriptors", () => {
    const resolved = expandManagedShortcutMap(DEFAULT_APP_KEYMAP_SETTINGS);

    expect(resolved.saveNote).toHaveLength(1);
    expect(resolved.switchNotes).toHaveLength(1);
    expect(resolved.switchSearch).toHaveLength(1);
    expect(resolved.switchGraph).toHaveLength(1);
    expect(resolved.undo).toHaveLength(1);
    expect(resolved.redo).toHaveLength(2);
    expect(resolved.clearParagraph).toHaveLength(1);
  });

  it("matches persisted shortcut chords against keyboard events", () => {
    const saveShortcut = DEFAULT_APP_KEYMAP_SETTINGS.keymaps.general.save_note;

    expect(
      matchesShortcutEvent(
        new KeyboardEvent("keydown", {
          key: "s",
          ctrlKey: true,
        }),
        saveShortcut
      )
    ).toBe(true);

    expect(
      matchesShortcutEvent(
        new KeyboardEvent("keydown", {
          key: "s",
          ctrlKey: true,
          shiftKey: true,
        }),
        saveShortcut
      )
    ).toBe(false);
  });

  it("rejects malformed managed shortcuts", () => {
    const result = validateAppKeymapSettings({
        keymaps: {
          general: {
            save_note: "Ctrl++",
            switch_notes: "Mod-1",
            switch_search: "Mod-2",
            switch_graph: "Mod-3",
          },
          editor: {
            undo: "Mod-z",
            redo: "Mod-Shift-z, Mod-y",
            clear_paragraph: "Mod-Alt-0",
          },
        },
        graph: {
          readability_floor_percent: 70,
        },
      });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected validation failure");
    }
    expect(result.errors[0]?.field).toBe("general.save_note");
  });

  it("rejects duplicate managed shortcuts across actions", () => {
    const result = validateAppKeymapSettings({
        keymaps: {
          general: {
            save_note: "Mod-s",
            switch_notes: "Mod-1",
            switch_search: "Mod-2",
            switch_graph: "Mod-3",
          },
          editor: {
            undo: "Mod-s",
            redo: "Mod-Shift-z",
            clear_paragraph: "Mod-Alt-0",
          },
        },
        graph: {
          readability_floor_percent: 70,
        },
      });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected validation failure");
    }
    expect(result.errors.map((error) => error.field)).toContain("editor.undo");
  });
});
