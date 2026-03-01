import type { AppKeymapSettings } from "./api";

export type ManagedShortcutFieldPath =
  | "general.save_note"
  | "general.switch_notes"
  | "general.switch_search"
  | "general.switch_graph"
  | "editor.undo"
  | "editor.redo"
  | "editor.clear_paragraph";

export interface ShortcutValidationIssue {
  field: ManagedShortcutFieldPath;
  message: string;
}

export interface ShortcutDescriptor {
  altKey: boolean;
  shiftKey: boolean;
  useMod: boolean;
  key: string;
}

export type ShortcutValidationResult =
  | { ok: true; value: Record<ManagedShortcutFieldPath, ShortcutDescriptor[]> }
  | { ok: false; errors: ShortcutValidationIssue[] };

export const DEFAULT_APP_KEYMAP_SETTINGS: AppKeymapSettings = {
  keymaps: {
    general: {
      save_note: "Mod-s",
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
};

export function expandManagedShortcutMap(
  settings: AppKeymapSettings
): Record<
  "saveNote" | "switchNotes" | "switchSearch" | "switchGraph" | "undo" | "redo" | "clearParagraph",
  ShortcutDescriptor[]
> {
  return {
    saveNote: parseShortcutList(settings.keymaps.general.save_note),
    switchNotes: parseShortcutList(settings.keymaps.general.switch_notes),
    switchSearch: parseShortcutList(settings.keymaps.general.switch_search),
    switchGraph: parseShortcutList(settings.keymaps.general.switch_graph),
    undo: parseShortcutList(settings.keymaps.editor.undo),
    redo: parseShortcutList(settings.keymaps.editor.redo),
    clearParagraph: parseShortcutList(settings.keymaps.editor.clear_paragraph),
  };
}

export function validateAppKeymapSettings(settings: AppKeymapSettings): ShortcutValidationResult {
  const managedValues: Array<[ManagedShortcutFieldPath, string]> = [
    ["general.save_note", settings.keymaps.general.save_note],
    ["general.switch_notes", settings.keymaps.general.switch_notes],
    ["general.switch_search", settings.keymaps.general.switch_search],
    ["general.switch_graph", settings.keymaps.general.switch_graph],
    ["editor.undo", settings.keymaps.editor.undo],
    ["editor.redo", settings.keymaps.editor.redo],
    ["editor.clear_paragraph", settings.keymaps.editor.clear_paragraph],
  ];

  const errors: ShortcutValidationIssue[] = [];
  const seen = new Map<string, ManagedShortcutFieldPath>();
  const value = {} as Record<ManagedShortcutFieldPath, ShortcutDescriptor[]>;

  for (const [field, shortcut] of managedValues) {
    try {
      const parsed = parseShortcutList(shortcut);
      value[field] = parsed;

      for (const descriptor of parsed) {
        const signature = serializeShortcut(descriptor);
        const previous = seen.get(signature);
        if (previous && previous !== field) {
          errors.push({
            field,
            message: `Duplicate shortcut with ${previous}: ${signature}`,
          });
        } else {
          seen.set(signature, field);
        }
      }
    } catch (error) {
      errors.push({
        field,
        message: error instanceof Error ? error.message : "Invalid shortcut",
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value };
}

export function matchesShortcutEvent(event: KeyboardEvent, shortcut: string): boolean {
  return parseShortcutList(shortcut).some((descriptor) => matchesDescriptor(event, descriptor));
}

export function setManagedShortcutValue(
  settings: AppKeymapSettings,
  field: ManagedShortcutFieldPath,
  value: string
): AppKeymapSettings {
  if (field === "general.save_note") {
    return {
      keymaps: {
        ...settings.keymaps,
        general: {
          ...settings.keymaps.general,
          save_note: value,
        },
      },
    };
  }

  if (field === "general.switch_notes") {
    return {
      keymaps: {
        ...settings.keymaps,
        general: {
          ...settings.keymaps.general,
          switch_notes: value,
        },
      },
    };
  }

  if (field === "general.switch_search") {
    return {
      keymaps: {
        ...settings.keymaps,
        general: {
          ...settings.keymaps.general,
          switch_search: value,
        },
      },
    };
  }

  if (field === "general.switch_graph") {
    return {
      keymaps: {
        ...settings.keymaps,
        general: {
          ...settings.keymaps.general,
          switch_graph: value,
        },
      },
    };
  }

  if (field === "editor.undo") {
    return {
      keymaps: {
        ...settings.keymaps,
        editor: {
          ...settings.keymaps.editor,
          undo: value,
        },
      },
    };
  }

  if (field === "editor.redo") {
    return {
      keymaps: {
        ...settings.keymaps,
        editor: {
          ...settings.keymaps.editor,
          redo: value,
        },
      },
    };
  }

  return {
    keymaps: {
      ...settings.keymaps,
      editor: {
        ...settings.keymaps.editor,
        clear_paragraph: value,
      },
    },
  };
}

export function resetManagedShortcutField(
  settings: AppKeymapSettings,
  field: ManagedShortcutFieldPath
): AppKeymapSettings {
  return setManagedShortcutValue(settings, field, getDefaultShortcutValue(field));
}

export function getDefaultShortcutValue(field: ManagedShortcutFieldPath): string {
  switch (field) {
    case "general.save_note":
      return DEFAULT_APP_KEYMAP_SETTINGS.keymaps.general.save_note;
    case "general.switch_notes":
      return DEFAULT_APP_KEYMAP_SETTINGS.keymaps.general.switch_notes;
    case "general.switch_search":
      return DEFAULT_APP_KEYMAP_SETTINGS.keymaps.general.switch_search;
    case "general.switch_graph":
      return DEFAULT_APP_KEYMAP_SETTINGS.keymaps.general.switch_graph;
    case "editor.undo":
      return DEFAULT_APP_KEYMAP_SETTINGS.keymaps.editor.undo;
    case "editor.redo":
      return DEFAULT_APP_KEYMAP_SETTINGS.keymaps.editor.redo;
    case "editor.clear_paragraph":
      return DEFAULT_APP_KEYMAP_SETTINGS.keymaps.editor.clear_paragraph;
  }
}

function parseShortcutList(raw: string): ShortcutDescriptor[] {
  const shortcuts = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (shortcuts.length === 0) {
    throw new Error("Shortcut must include at least one chord");
  }

  const descriptors = shortcuts.map(parseShortcut);
  const signatures = new Set<string>();

  for (const descriptor of descriptors) {
    const signature = serializeShortcut(descriptor);
    if (signatures.has(signature)) {
      throw new Error(`Shortcut repeats the same chord twice: ${signature}`);
    }
    signatures.add(signature);
  }

  return descriptors;
}

function parseShortcut(raw: string): ShortcutDescriptor {
  const tokens = raw
    .split("-")
    .map((value) => value.trim())
    .filter(Boolean);

  if (tokens.length < 2) {
    throw new Error(`Shortcut must include modifiers and a key: ${raw}`);
  }

  const keyToken = tokens.at(-1);
  if (!keyToken) {
    throw new Error(`Shortcut key cannot be empty: ${raw}`);
  }

  let useMod = false;
  let altKey = false;
  let shiftKey = false;

  for (const modifier of tokens.slice(0, -1)) {
    switch (modifier.toLowerCase()) {
      case "mod":
      case "cmd":
      case "command":
      case "meta":
      case "ctrl":
      case "control":
        useMod = true;
        break;
      case "alt":
      case "option":
        altKey = true;
        break;
      case "shift":
        shiftKey = true;
        break;
      default:
        throw new Error(`Unsupported modifier: ${modifier}`);
    }
  }

  if (!useMod && !altKey && !shiftKey) {
    throw new Error(`Shortcut must include at least one supported modifier: ${raw}`);
  }

  return {
    altKey,
    shiftKey,
    useMod,
    key: normalizeKey(keyToken),
  };
}

function normalizeKey(raw: string): string {
  const key = raw.trim();
  if (!key) {
    throw new Error("Shortcut key cannot be empty");
  }

  if (key.length === 1 && /^[a-z0-9]$/i.test(key)) {
    return key.toLowerCase();
  }

  const normalized = key.toLowerCase();
  switch (normalized) {
    case "enter":
      return "Enter";
    case "space":
      return "Space";
    case "tab":
      return "Tab";
    case "escape":
    case "esc":
      return "Escape";
    case "backspace":
      return "Backspace";
    case "delete":
      return "Delete";
    case "arrowup":
      return "ArrowUp";
    case "arrowdown":
      return "ArrowDown";
    case "arrowleft":
      return "ArrowLeft";
    case "arrowright":
      return "ArrowRight";
    default:
      throw new Error(`Unsupported key: ${raw}`);
  }
}

function matchesDescriptor(event: KeyboardEvent, descriptor: ShortcutDescriptor): boolean {
  const eventKey = normalizeEventKey(event.key);
  const modPressed = event.ctrlKey || event.metaKey;

  return (
    eventKey === descriptor.key &&
    modPressed === descriptor.useMod &&
    event.altKey === descriptor.altKey &&
    event.shiftKey === descriptor.shiftKey
  );
}

function normalizeEventKey(key: string): string {
  if (key.length === 1) {
    return key.toLowerCase();
  }

  switch (key) {
    case " ":
      return "Space";
    case "Esc":
      return "Escape";
    default:
      return key;
  }
}

function serializeShortcut(descriptor: ShortcutDescriptor): string {
  const parts: string[] = [];
  if (descriptor.useMod) {
    parts.push("Mod");
  }
  if (descriptor.altKey) {
    parts.push("Alt");
  }
  if (descriptor.shiftKey) {
    parts.push("Shift");
  }
  parts.push(descriptor.key);
  return parts.join("-");
}
