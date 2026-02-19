use libvault::vault::Vault;
use std::fs;
use std::thread;
use std::time::Duration;
use tempfile::TempDir;

/// Helper function to poll for events until debounce passes
/// Returns total number of events collected
fn poll_until_debounce(vault: &mut Vault, max_attempts: usize) -> usize {
    let mut total_count = 0;
    for _ in 0..max_attempts {
        total_count += vault.sync_external_changes().unwrap();
        thread::sleep(Duration::from_millis(100));
    }
    total_count
}

#[test]
fn watcher_detects_external_file_creation() {
    let dir = TempDir::new().unwrap();
    let mut vault = Vault::create(dir.path()).unwrap();

    // Start watching
    vault.start_watching().unwrap();
    assert!(vault.is_watching());

    // Wait for watcher to be fully ready
    thread::sleep(Duration::from_millis(200));

    // Create file externally
    fs::write(
        dir.path().join("external.md"),
        "# External Note\n\nContent.",
    )
    .unwrap();

    // Poll multiple times to collect events after debounce (500ms debounce)
    let count = poll_until_debounce(&mut vault, 10);
    assert!(count >= 1, "should detect at least one change");

    // Verify note was added
    let notes = vault.list_notes().unwrap();
    assert_eq!(notes.len(), 1);
    assert_eq!(notes[0].path, "external.md");
    assert_eq!(notes[0].title, "External Note");

    // Stop watching
    vault.stop_watching();
    assert!(!vault.is_watching());
}

#[test]
fn watcher_detects_external_file_modification() {
    let dir = TempDir::new().unwrap();
    let mut vault = Vault::create(dir.path()).unwrap();

    // Create note through vault
    vault.create_note("test.md", "# Original").unwrap();

    // Start watching
    vault.start_watching().unwrap();
    thread::sleep(Duration::from_millis(200));

    // Modify file externally
    fs::write(dir.path().join("test.md"), "# Modified Title").unwrap();

    // Poll multiple times to collect events after debounce
    let count = poll_until_debounce(&mut vault, 10);
    assert!(count >= 1, "should detect modification event");

    // Verify update
    let note = vault.read_note("test.md").unwrap();
    assert_eq!(note.meta.title, "Modified Title");
}

#[test]
fn watcher_detects_external_file_deletion() {
    let dir = TempDir::new().unwrap();
    let mut vault = Vault::create(dir.path()).unwrap();

    // Create note through vault
    vault.create_note("delete.md", "# To Delete").unwrap();
    assert_eq!(vault.list_notes().unwrap().len(), 1);

    // Start watching
    vault.start_watching().unwrap();
    thread::sleep(Duration::from_millis(200));

    // Delete file externally
    fs::remove_file(dir.path().join("delete.md")).unwrap();

    // Poll multiple times to collect events after debounce
    let count = poll_until_debounce(&mut vault, 10);
    assert!(count >= 1, "should detect deletion event");

    // Verify deletion
    assert!(vault.list_notes().unwrap().is_empty());
}

#[test]
fn watcher_detects_external_file_rename() {
    let dir = TempDir::new().unwrap();
    let mut vault = Vault::create(dir.path()).unwrap();

    // Create note through vault
    vault.create_note("old.md", "# Original").unwrap();

    // Start watching
    vault.start_watching().unwrap();
    thread::sleep(Duration::from_millis(200));

    // Rename file externally
    fs::rename(dir.path().join("old.md"), dir.path().join("new.md")).unwrap();

    // Poll multiple times to collect events after debounce
    let count = poll_until_debounce(&mut vault, 10);
    assert!(count >= 1, "should detect rename event");

    // Verify rename
    let notes = vault.list_notes().unwrap();
    assert_eq!(notes.len(), 1);
    assert_eq!(notes[0].path, "new.md");
}

#[test]
fn watcher_debounce_prevents_duplicate_events() {
    let dir = TempDir::new().unwrap();
    let mut vault = Vault::create(dir.path()).unwrap();

    vault.start_watching().unwrap();
    thread::sleep(Duration::from_millis(200));

    // Rapid file modifications
    for i in 0..5 {
        fs::write(dir.path().join("rapid.md"), format!("# Version {}", i)).unwrap();
        thread::sleep(Duration::from_millis(50));
    }

    // Poll multiple times to collect the debounced event after it passes debounce period
    let count = poll_until_debounce(&mut vault, 10);
    assert_eq!(
        count, 1,
        "debounce should combine rapid changes into single event"
    );

    // Content should be from last write
    let note = vault.read_note("rapid.md").unwrap();
    assert_eq!(note.meta.title, "Version 4");
}
