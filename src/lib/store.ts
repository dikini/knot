import { create } from "zustand";
import * as api from "./api";
import type { VaultInfo, NoteData, NoteSummary } from "../types/vault";

export type ShellToolMode = "notes" | "search" | "graph";
export type ShellDensityMode = "comfortable" | "adaptive";

export interface ShellState {
  toolMode: ShellToolMode;
  isToolRailCollapsed: boolean;
  isContextPanelCollapsed: boolean;
  isInspectorRailOpen: boolean;
  contextPanelWidth: number;
  densityMode: ShellDensityMode;
}

interface VaultState {
  vault: VaultInfo | null;
  currentNote: NoteData | null;
  noteList: NoteSummary[];
  isLoading: boolean;
  error: string | null;
  shell: ShellState;

  // Actions
  setVault: (vault: VaultInfo | null) => void;
  setCurrentNote: (note: NoteData | null) => void;
  setNoteList: (notes: NoteSummary[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setShellToolMode: (mode: ShellToolMode) => void;
  toggleToolRail: () => void;
  toggleContextPanel: () => void;
  setInspectorRailOpen: (isOpen: boolean) => void;
  setContextPanelWidth: (width: number) => void;
  setDensityMode: (mode: ShellDensityMode) => void;

  // API Actions
  openVault: (path: string) => Promise<void>;
  closeVault: () => Promise<void>;
  loadNotes: () => Promise<void>;
  loadNote: (path: string) => Promise<void>;
  saveCurrentNote: (content?: string) => Promise<void>;

  // Computed
  hasVault: () => boolean;
  hasNote: () => boolean;
}

// SPEC: COMP-FRONTEND-001 FR-5
export const useVaultStore = create<VaultState>((set, get) => ({
  vault: null,
  currentNote: null,
  noteList: [],
  isLoading: false,
  error: null,
  shell: {
    toolMode: "notes",
    isToolRailCollapsed: false,
    isContextPanelCollapsed: false,
    isInspectorRailOpen: false,
    contextPanelWidth: 320,
    densityMode: "comfortable",
  },

  setVault: (vault) => set({ vault, error: null }),
  setCurrentNote: (note) => set({ currentNote: note }),
  setNoteList: (noteList) => set({ noteList }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setShellToolMode: (mode) =>
    set((state) => ({
      shell: { ...state.shell, toolMode: mode },
    })),
  toggleToolRail: () =>
    set((state) => ({
      shell: { ...state.shell, isToolRailCollapsed: !state.shell.isToolRailCollapsed },
    })),
  toggleContextPanel: () =>
    set((state) => ({
      shell: { ...state.shell, isContextPanelCollapsed: !state.shell.isContextPanelCollapsed },
    })),
  setInspectorRailOpen: (isOpen) =>
    set((state) => ({
      shell: { ...state.shell, isInspectorRailOpen: isOpen },
    })),
  setContextPanelWidth: (width) =>
    set((state) => ({
      shell: { ...state.shell, contextPanelWidth: Math.max(240, Math.floor(width)) },
    })),
  setDensityMode: (mode) =>
    set((state) => ({
      shell: { ...state.shell, densityMode: mode },
    })),

  // Open vault via API
  openVault: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      const info = await api.openVault(path);
      set({ vault: info, isLoading: false });
      // Load notes after opening vault
      await get().loadNotes();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to open vault",
        isLoading: false,
      });
    }
  },

  // Close vault via API
  closeVault: async () => {
    set({ isLoading: true, error: null });
    try {
      await api.closeVault();
      set({ vault: null, currentNote: null, noteList: [], isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to close vault",
        isLoading: false,
      });
    }
  },

  // Load all notes via API
  loadNotes: async () => {
    if (!get().vault) return;
    
    set({ isLoading: true, error: null });
    try {
      const notes = await api.listNotes();
      set({ noteList: notes, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load notes",
        isLoading: false,
      });
    }
  },

  // Load a specific note via API
  loadNote: async (path: string) => {
    if (!get().vault) return;

    set({ isLoading: true, error: null });
    try {
      const note = await api.getNote(path);
      set({ currentNote: note, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load note",
        isLoading: false,
      });
    }
  },

  // Save current note via API
  saveCurrentNote: async (content?: string) => {
    const { currentNote } = get();
    if (!currentNote) return;

    set({ isLoading: true, error: null });
    try {
      const contentToSave = content ?? currentNote.content;
      await api.saveNote(currentNote.path, contentToSave);
      // Update currentNote content if we saved new content
      if (content !== undefined) {
        set({ currentNote: { ...currentNote, content: contentToSave } });
      }
      set({ isLoading: false });
      // Refresh notes list to update timestamps
      await get().loadNotes();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to save note",
        isLoading: false,
      });
    }
  },

  hasVault: () => get().vault !== null,
  hasNote: () => get().currentNote !== null,
}));

interface EditorState {
  content: string;
  isDirty: boolean;
  cursorPosition: number;

  setContent: (content: string) => void;
  markDirty: (dirty: boolean) => void;
  setCursorPosition: (pos: number) => void;
  reset: () => void;
}

// SPEC: COMP-FRONTEND-001 FR-5
export const useEditorStore = create<EditorState>((set) => ({
  content: "",
  isDirty: false,
  cursorPosition: 0,

  setContent: (content) => set({ content, isDirty: true }),
  markDirty: (isDirty) => set({ isDirty }),
  setCursorPosition: (cursorPosition) => set({ cursorPosition }),
  reset: () => set({ content: "", isDirty: false, cursorPosition: 0 }),
}));
