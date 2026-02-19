import { useEffect, useState } from "react";
import { Editor } from "@components/Editor";
import { Sidebar } from "@components/Sidebar";
import { ToastContainer } from "@components/Toast";
import { useToast } from "@hooks/useToast";
import { useVaultStore } from "@lib/store";
import * as api from "@lib/api";
import type { RecentVault } from "@lib/api";
import "./styles/App.css";

// SPEC: COMP-UI-LAYOUT-002 FR-5, FR-6
function App() {
  const [recentVaults, setRecentVaults] = useState<RecentVault[]>([]);
  const { vault, isLoading, setVault, closeVault, loadNotes } = useVaultStore();
  const { toasts, removeToast, success, error } = useToast();

  // Load recent vaults and check for existing vault on mount
  useEffect(() => {
    // Load recent vaults
    api.getRecentVaults().then(setRecentVaults).catch(console.error);

    // Check if there's already a vault open
    api.isVaultOpen().then((isOpen) => {
      if (isOpen) {
        api.getVaultInfo().then((info) => {
          if (info) {
            setVault(info);
            loadNotes();
          }
        });
      }
    });
  }, [setVault, loadNotes]);

  // Poll for external file changes when vault is open
  useEffect(() => {
    if (!vault) return;

    const interval = setInterval(() => {
      api.syncExternalChanges().catch(console.error);
    }, 2000);

    return () => clearInterval(interval);
  }, [vault]);

  const handleOpenVault = async () => {
    try {
      const info = await api.openVaultDialog();
      setVault(info);
      await api.addRecentVault(info.path);
      // Refresh recent vaults list
      const recents = await api.getRecentVaults();
      setRecentVaults(recents);
      await loadNotes();
      success(`Opened vault "${info.name}"`);
    } catch (err) {
      // User cancelled or error occurred
      if (err instanceof Error && !err.message.includes("cancelled")) {
        error(err.message);
      }
    }
  };

  const handleCreateVault = async () => {
    try {
      const info = await api.createVaultDialog();
      setVault(info);
      await api.addRecentVault(info.path);
      // Refresh recent vaults list
      const recents = await api.getRecentVaults();
      setRecentVaults(recents);
      await loadNotes();
      success(`Created vault "${info.name}"`);
    } catch (err) {
      // User cancelled or error occurred
      if (err instanceof Error && !err.message.includes("cancelled")) {
        error(err.message);
      }
    }
  };

  const handleOpenRecent = async (path: string) => {
    try {
      const info = await api.openVault(path);
      setVault(info);
      await api.addRecentVault(info.path);
      await loadNotes();
      success(`Opened vault "${info.name}"`);
    } catch (err) {
      error(err instanceof Error ? err.message : "Failed to open vault");
    }
  };

  const handleCloseVault = async () => {
    try {
      await closeVault();
      success("Vault closed");
    } catch (err) {
      error(err instanceof Error ? err.message : "Failed to close vault");
    }
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="app">
      <Sidebar
        recentVaults={recentVaults}
        onOpenVault={handleOpenVault}
        onCreateVault={handleCreateVault}
        onOpenRecent={handleOpenRecent}
        onCloseVault={handleCloseVault}
      />
      <main className="main-content">
        {/* Loading indicator */}
        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner" />
            <span>Loading...</span>
          </div>
        )}

        {vault ? (
          <div className="content-area">
            <Editor />
          </div>
        ) : (
          <div className="vault-setup">
            <h1>Welcome to Knot</h1>
            <p className="subtitle">Your personal knowledge base</p>

            <div className="vault-actions">
              <button onClick={handleOpenVault} disabled={isLoading} className="btn-primary">
                {isLoading ? "Opening..." : "Open Existing Vault"}
              </button>
              <button onClick={handleCreateVault} disabled={isLoading} className="btn-secondary">
                {isLoading ? "Creating..." : "Create New Vault"}
              </button>
            </div>

            {/* Recent vaults list */}
            {recentVaults.length > 0 && (
              <div className="recent-vaults">
                <h3>Recent Vaults</h3>
                <ul>
                  {recentVaults.map((recent) => (
                    <li key={recent.path}>
                      <button
                        onClick={() => handleOpenRecent(recent.path)}
                        disabled={isLoading}
                        className="recent-vault-btn"
                      >
                        <span className="vault-name">{recent.name}</span>
                        <span className="vault-path">{recent.path}</span>
                        <span className="vault-date">{formatDate(recent.opened_at)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default App;
