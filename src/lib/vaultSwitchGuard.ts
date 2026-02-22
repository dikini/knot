// BUG-VAULT-SWITCH-UX-001: ensure unsaved edits are resolved before vault switch.
export type VaultSwitchGuardResult = "proceed" | "save-failed";

export interface VaultSwitchGuardInput {
  isDirty: boolean;
  currentNoteTitle: string;
  confirm: (message: string) => boolean;
  saveCurrentNote: () => Promise<void>;
  clearUnsavedState: () => Promise<void>;
}

export async function resolveVaultSwitchWithUnsavedGuard(
  input: VaultSwitchGuardInput
): Promise<VaultSwitchGuardResult> {
  if (!input.isDirty) {
    return "proceed";
  }

  const choice = input.confirm(
    `You have unsaved changes in "${input.currentNoteTitle}".\n\n` +
      "Click OK to save and switch, Cancel to discard changes and switch."
  );

  if (choice) {
    try {
      await input.saveCurrentNote();
      await input.clearUnsavedState();
      return "proceed";
    } catch {
      return "save-failed";
    }
  }

  await input.clearUnsavedState();
  return "proceed";
}
