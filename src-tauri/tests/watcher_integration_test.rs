use knot::VaultManager;
use std::fs;
use std::path::Path;
use std::thread;
use std::time::Duration;
use tempfile::TempDir;

/// Helper function to poll for events until debounce passes
fn poll_until_debounce(vault: &mut VaultManager, max_attempts: usize) {
    for _ in 0..max_attempts {
        vault.sync_external_changes().unwrap();
        thread::sleep(Duration::from_millis(100));
    }
}

fn open_watched_vault(path: &Path) -> VaultManager {
    let created = VaultManager::create(path).unwrap();
    drop(created);

    let vault = VaultManager::open(path).unwrap();
    thread::sleep(Duration::from_millis(200));
    vault
}

#[test]
// SPEC: COMP-FILE-WATCH-001 FR-1, FR-2
fn watcher_detects_external_file_creation() {
    let dir = TempDir::new().unwrap();
    let mut vault = open_watched_vault(dir.path());

    // Create file externally
    fs::write(
        dir.path().join("external.md"),
        "# External Note\n\nContent.",
    )
    .unwrap();

    // Poll multiple times to collect events after debounce (500ms debounce).
    poll_until_debounce(&mut vault, 10);

    // Verify note was added
    let notes = vault.list_notes().unwrap();
    assert!(notes.iter().any(|note| note.path == "external.md"));
    assert!(
        notes.iter().any(|note| note.title == "External Note"),
        "new note title should be indexed from file heading"
    );
}

#[test]
// SPEC: COMP-FILE-WATCH-001 FR-3
fn watcher_detects_external_file_modification() {
    let dir = TempDir::new().unwrap();
    let mut vault = open_watched_vault(dir.path());

    // Create note through vault API.
    vault.save_note("test.md", "# Original").unwrap();

    // Modify file externally
    fs::write(dir.path().join("test.md"), "# Modified Title").unwrap();

    // Poll multiple times to collect events after debounce
    poll_until_debounce(&mut vault, 10);

    // Verify update
    let note = vault.get_note("test.md").unwrap();
    assert_eq!(note.title(), "Modified Title");
}

#[test]
// SPEC: COMP-FILE-WATCH-001 FR-4
fn watcher_detects_external_file_deletion() {
    let dir = TempDir::new().unwrap();
    let mut vault = open_watched_vault(dir.path());

    // Create note through vault
    vault.save_note("delete.md", "# To Delete").unwrap();

    // Delete file externally
    fs::remove_file(dir.path().join("delete.md")).unwrap();

    // Poll multiple times to collect events after debounce
    poll_until_debounce(&mut vault, 10);

    // Verify deletion
    let notes = vault.list_notes().unwrap();
    assert!(
        notes.iter().all(|note| note.path != "delete.md"),
        "deleted file should be removed from note metadata"
    );
}

#[test]
// SPEC: COMP-FILE-WATCH-001 FR-5
fn watcher_detects_external_file_rename() {
    let dir = TempDir::new().unwrap();
    let mut vault = open_watched_vault(dir.path());

    // Create note through vault
    vault.save_note("old.md", "# Original").unwrap();

    // Rename file externally
    fs::rename(dir.path().join("old.md"), dir.path().join("new.md")).unwrap();

    // Poll multiple times to collect events after debounce
    poll_until_debounce(&mut vault, 10);

    // Verify rename
    let notes = vault.list_notes().unwrap();
    assert!(notes.iter().any(|note| note.path == "new.md"));
    assert!(notes.iter().all(|note| note.path != "old.md"));
}

#[test]
// SPEC: COMP-FILE-WATCH-001 FR-6
fn watcher_debounce_prevents_duplicate_events() {
    let dir = TempDir::new().unwrap();
    let mut vault = open_watched_vault(dir.path());

    // Rapid file modifications
    for i in 0..5 {
        fs::write(dir.path().join("rapid.md"), format!("# Version {}", i)).unwrap();
        thread::sleep(Duration::from_millis(50));
    }

    // Poll multiple times to collect the debounced event after it passes debounce period.
    poll_until_debounce(&mut vault, 10);

    // Content should be from last write
    let note = vault.get_note("rapid.md").unwrap();
    assert_eq!(note.title(), "Version 4");
}
