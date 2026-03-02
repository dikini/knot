import type { ReactNode } from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App";
// Trace: DESIGN-daemon-ui-ipc-cutover

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

const vaultInfo = {
  path: "/tmp/daemon-vault",
  name: "daemon-vault",
  note_count: 0,
  last_modified: 0,
};

const store = {
  vault: null as null | { path: string; name: string; note_count: number; last_modified: number },
  noteList: [],
  currentNote: null,
  isLoading: false,
  shell: {
    toolMode: "notes" as const,
    isToolRailCollapsed: false,
    isContextPanelCollapsed: false,
    isInspectorRailOpen: false,
    contextPanelWidth: 320,
    densityMode: "comfortable" as const,
    showTextLabels: false,
  },
  setVault: vi.fn(),
  closeVault: vi.fn().mockResolvedValue(undefined),
  loadNotes: vi.fn().mockResolvedValue(undefined),
  loadNote: vi.fn().mockResolvedValue(undefined),
  setShellToolMode: vi.fn(),
  toggleToolRail: vi.fn(),
  toggleContextPanel: vi.fn(),
  setDensityMode: vi.fn(),
  setContextPanelWidth: vi.fn(),
  setInspectorRailOpen: vi.fn(),
  setShowTextLabels: vi.fn(),
};

vi.mock("@hooks/useToast", () => ({
  useToast: () => ({
    toasts: [],
    removeToast: vi.fn(),
    success: mockToastSuccess,
    error: mockToastError,
  }),
}));

vi.mock("@lib/store", () => ({
  useVaultStore: () => store,
  useEditorStore: {
    getState: vi.fn(() => ({
      isDirty: false,
      content: "",
      markDirty: vi.fn(),
    })),
  },
}));

vi.mock("@components/Sidebar", () => ({
  Sidebar: ({ onCloseVault }: { onCloseVault: () => void }) => (
    <button onClick={onCloseVault}>Close Vault Sidebar</button>
  ),
}));

vi.mock("@components/Editor", () => ({ Editor: () => <div data-testid="editor-view">Editor</div> }));
vi.mock("@components/GraphView", () => ({ GraphView: () => <div data-testid="graph-view">Graph</div> }));
vi.mock("@components/GraphView/GraphContextPanel", () => ({ GraphContextPanel: () => <div /> }));
vi.mock("@components/Shell/ContextPanel", () => ({
  // TASK: TC-001
  ContextPanel: ({ notesContent }: { notesContent: ReactNode }) => <div>{notesContent}</div>,
}));
vi.mock("@components/Shell/InspectorRail", () => ({
  // TASK: TC-001
  InspectorRail: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@components/Shell/ToolRail", () => ({ ToolRail: () => <div /> }));
vi.mock("@components/SearchBox", () => ({ SearchBox: () => <div /> }));
vi.mock("@components/Settings/SettingsPane", () => ({ SettingsPane: () => <div /> }));
vi.mock("@components/Toast", () => ({ ToastContainer: () => null }));

const apiMock = vi.hoisted(() => ({
  getRecentVaults: vi.fn().mockResolvedValue([]),
  isVaultOpen: vi.fn().mockResolvedValue(false),
  getVaultInfo: vi.fn().mockResolvedValue(null),
  syncExternalChanges: vi.fn().mockResolvedValue(undefined),
  openVaultDialog: vi.fn().mockResolvedValue({
    path: "/tmp/daemon-vault",
    name: "daemon-vault",
    note_count: 0,
    last_modified: 0,
  }),
  createVaultDialog: vi.fn().mockResolvedValue({
    path: "/tmp/daemon-vault",
    name: "daemon-vault",
    note_count: 0,
    last_modified: 0,
  }),
  addRecentVault: vi.fn().mockResolvedValue(undefined),
  openVault: vi.fn().mockResolvedValue({
    path: "/tmp/daemon-vault",
    name: "daemon-vault",
    note_count: 0,
    last_modified: 0,
  }),
  saveNote: vi.fn().mockResolvedValue(undefined),
  setUnsavedChanges: vi.fn().mockResolvedValue(undefined),
  getVaultSettings: vi.fn().mockResolvedValue({
    name: "vault",
    plugins_enabled: false,
    file_visibility: "all_files",
    sync: { enabled: false, peers: [] },
    editor: { font_size: 14, tab_size: 4 },
  }),
  updateVaultSettings: vi.fn(),
  reindexVault: vi.fn(),
}));

vi.mock("@lib/api", () => apiMock);

describe("App daemon smoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    store.vault = null;
    store.currentNote = null;
    store.setVault.mockClear();
    store.closeVault.mockClear();
    store.loadNotes.mockClear();
  });

  it("retries startup attach and hydrates from daemon-open vault", async () => {
    let attempts = 0;
    apiMock.isVaultOpen.mockImplementation(async () => {
      attempts += 1;
      return attempts >= 3;
    });
    apiMock.getVaultInfo.mockResolvedValue(vaultInfo);

    render(<App />);

    await waitFor(() => {
      expect(store.setVault).toHaveBeenCalledWith(vaultInfo);
      expect(store.loadNotes).toHaveBeenCalled();
    }, { timeout: 4000 });
    expect(apiMock.isVaultOpen).toHaveBeenCalledTimes(3);
  });

  it("opens existing vault from welcome action", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /open existing vault/i }));

    await waitFor(() => {
      expect(apiMock.openVaultDialog).toHaveBeenCalledTimes(1);
      expect(store.setVault).toHaveBeenCalledWith(vaultInfo);
      expect(store.loadNotes).toHaveBeenCalled();
    });
  });

  it("creates new vault from welcome action", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /create new vault/i }));

    await waitFor(() => {
      expect(apiMock.createVaultDialog).toHaveBeenCalledTimes(1);
      expect(store.setVault).toHaveBeenCalledWith(vaultInfo);
      expect(store.loadNotes).toHaveBeenCalled();
    });
  });

  it("closes vault from sidebar action", async () => {
    store.vault = vaultInfo;
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /close vault sidebar/i }));

    await waitFor(() => {
      expect(store.closeVault).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).toHaveBeenCalled();
    });
  });
});
