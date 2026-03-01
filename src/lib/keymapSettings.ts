import type { AppKeymapSettings } from "./api";

export type ManagedShortcutFieldPath = "general.save_note" | "editor.undo" | "editor.redo";

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
    },
    editor: {
      undo: "Mod-z",
      redo: "Mod-Shift-z, Mod-y",
    },
  },
};

export function expandManagedShortcutMap(
  settings: AppKeymapSettings
): Record<"saveNote" | "undo" | "redo", ShortcutDescriptor[]> {
  return {
    saveNote: parseShortcutList(settings.keymaps.general.save_note),
    undo: parseShortcutList(settings.keymaps.editor.undo),
    redo: parseShortcutList(settings.keymaps.editor.redo),
  };
}

export function validateAppKeymapSettings(settings: AppKeymapSettings): ShortcutValidationResult {
  const managedValues: Array<[ManagedShortcutFieldPath, string]> = [
    ["general.save_note", settings.keymaps.general.save_note],
    ["editor.undo", settings.keymaps.editor.undo],
    ["editor.redo", settings.keymaps.editor.redo],
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
    case "editor.undo":
      return DEFAULT_APP_KEYMAP_SETTINGS.keymaps.editor.undo;
    case "editor.redo":
      return DEFAULT_APP_KEYMAP_SETTINGS.keymaps.editor.redo;
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
