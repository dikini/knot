import { describe, expect, it, vi } from "vitest";
import { resolveVaultSwitchWithUnsavedGuard } from "./vaultSwitchGuard";

// BUG-VAULT-SWITCH-UX-001: unit coverage for save/discard/cancel switch flows.

describe("resolveVaultSwitchWithUnsavedGuard", () => {
  it("proceeds immediately when editor is clean", async () => {
    const save = vi.fn();
    const clearUnsaved = vi.fn();
    const confirm = vi.fn();

    const result = await resolveVaultSwitchWithUnsavedGuard({
      isDirty: false,
      currentNoteTitle: "Note",
      confirm,
      saveCurrentNote: save,
      clearUnsavedState: clearUnsaved,
    });

    expect(result).toBe("proceed");
    expect(confirm).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(clearUnsaved).not.toHaveBeenCalled();
  });

  it("saves then proceeds when user confirms save", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const clearUnsaved = vi.fn().mockResolvedValue(undefined);
    const confirm = vi.fn().mockReturnValue(true);

    const result = await resolveVaultSwitchWithUnsavedGuard({
      isDirty: true,
      currentNoteTitle: "Draft",
      confirm,
      saveCurrentNote: save,
      clearUnsavedState: clearUnsaved,
    });

    expect(result).toBe("proceed");
    expect(save).toHaveBeenCalledTimes(1);
    expect(clearUnsaved).toHaveBeenCalledTimes(1);
  });

  it("returns save-failed when save path throws", async () => {
    const save = vi.fn().mockRejectedValue(new Error("save failed"));
    const clearUnsaved = vi.fn();
    const confirm = vi.fn().mockReturnValue(true);

    const result = await resolveVaultSwitchWithUnsavedGuard({
      isDirty: true,
      currentNoteTitle: "Draft",
      confirm,
      saveCurrentNote: save,
      clearUnsavedState: clearUnsaved,
    });

    expect(result).toBe("save-failed");
    expect(clearUnsaved).not.toHaveBeenCalled();
  });

  it("discards and proceeds when user declines save", async () => {
    const save = vi.fn();
    const clearUnsaved = vi.fn().mockResolvedValue(undefined);
    const confirm = vi.fn().mockReturnValue(false);

    const result = await resolveVaultSwitchWithUnsavedGuard({
      isDirty: true,
      currentNoteTitle: "Draft",
      confirm,
      saveCurrentNote: save,
      clearUnsavedState: clearUnsaved,
    });

    expect(result).toBe("proceed");
    expect(save).not.toHaveBeenCalled();
    expect(clearUnsaved).toHaveBeenCalledTimes(1);
  });
});
