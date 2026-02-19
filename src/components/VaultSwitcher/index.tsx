import { useState, useRef, useEffect } from "react";
import type { VaultInfo } from "../../types/vault";
import type { RecentVault } from "@lib/api";
import "./VaultSwitcher.css";

export interface VaultSwitcherProps {
  vault: VaultInfo | null;
  recentVaults: RecentVault[];
  onOpenVault: () => void;
  onCreateVault: () => void;
  onOpenRecent: (path: string) => void;
  onCloseVault: () => void;
}

export function VaultSwitcher({
  vault,
  recentVaults,
  onOpenVault,
  onCreateVault,
  onOpenRecent,
  onCloseVault,
}: VaultSwitcherProps) {
  // SPEC: COMP-VAULT-UI-001 FR-1, FR-3
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleOpenVault = () => {
    setIsOpen(false);
    onOpenVault();
  };

  const handleCreateVault = () => {
    setIsOpen(false);
    onCreateVault();
  };

  const handleOpenRecent = (path: string) => {
    setIsOpen(false);
    onOpenRecent(path);
  };

  const handleCloseVault = () => {
    setIsOpen(false);
    onCloseVault();
  };

  const hasRecentVaults = recentVaults.length > 0;

  return (
    <div className="vault-switcher" ref={dropdownRef}>
      <button
        className="vault-switcher__button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <span className="vault-switcher__name">{vault ? vault.name : "No Vault Open"}</span>
        <svg
          className={`vault-switcher__chevron ${isOpen ? "vault-switcher__chevron--open" : ""}`}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M2.5 4.5L6 8L9.5 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="vault-switcher__dropdown" role="menu">
          <button className="vault-switcher__item" onClick={handleOpenVault} role="menuitem">
            <svg
              className="vault-switcher__icon"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M2 8H14M14 8L9 3M14 8L9 13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Open Different Vault...</span>
          </button>

          <button className="vault-switcher__item" onClick={handleCreateVault} role="menuitem">
            <svg
              className="vault-switcher__icon"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M8 2V14M2 8H14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Create New Vault...</span>
          </button>

          {hasRecentVaults && (
            <>
              <div className="vault-switcher__divider" role="separator" />

              <div className="vault-switcher__section-title">Recent Vaults</div>

              {recentVaults.map((recent) => (
                <button
                  key={recent.path}
                  className="vault-switcher__item vault-switcher__item--recent"
                  onClick={() => handleOpenRecent(recent.path)}
                  role="menuitem"
                  title={recent.path}
                >
                  <svg
                    className="vault-switcher__icon vault-switcher__icon--folder"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M2 4V12C2 12.5523 2.44772 13 3 13H13C13.5523 13 14 12.5523 14 12V6C14 5.44772 13.5523 5 13 5H8L6 3H3C2.44772 3 2 3.44772 2 4Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="vault-switcher__recent-name">{recent.name}</span>
                </button>
              ))}
            </>
          )}

          <div className="vault-switcher__divider" role="separator" />

          <button
            className="vault-switcher__item"
            onClick={handleCloseVault}
            disabled={!vault}
            role="menuitem"
          >
            <svg
              className="vault-switcher__icon"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M3 8H11M11 8L8 5M11 8L8 11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M6 3V2C6 1.44772 6.44772 1 7 1H13C13.5523 1 14 1.44772 14 2V14C14 14.5523 13.5523 15 13 15H7C6.44772 15 6 14.5523 6 14V13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Close Vault</span>
          </button>
        </div>
      )}
    </div>
  );
}
