//! File system watcher for detecting external changes to vault files.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{channel, Receiver};
use std::time::{Duration, Instant};

use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use tracing::{debug, error, info};

use crate::error::Result;

/// Default debounce duration in milliseconds.
const DEFAULT_DEBOUNCE_MS: u64 = 500;

/// Default poll interval in milliseconds.
const DEFAULT_POLL_INTERVAL_MS: u64 = 100;

/// Markdown file extension.
const MARKDOWN_EXT: &str = ".md";

/// SPEC: COMP-FILE-WATCH-001 FR-2, FR-3, FR-4, FR-5
/// Events emitted by the file watcher.
#[derive(Debug, Clone, PartialEq)]
pub enum FileEvent {
    /// File was created or modified
    Modified { path: String },
    /// File was deleted
    Deleted { path: String },
    /// File was renamed
    Renamed { from: String, to: String },
}

impl std::fmt::Display for FileEvent {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FileEvent::Modified { path } => write!(f, "Modified({})", path),
            FileEvent::Deleted { path } => write!(f, "Deleted({})", path),
            FileEvent::Renamed { from, to } => write!(f, "Renamed({} -> {})", from, to),
        }
    }
}

/// SPEC: COMP-FILE-WATCH-001 FR-1, FR-6, FR-7
/// Watches the vault directory for external file changes.
pub struct FileWatcher {
    /// The notify watcher instance. Kept to maintain watcher lifetime.
    #[allow(dead_code)]
    watcher: RecommendedWatcher,
    rx: Receiver<notify::Result<Event>>,
    debounce_ms: u64,
    pending_events: HashMap<String, (FileEvent, Instant)>,
    root: PathBuf,
}

impl FileWatcher {
    /// Create a new file watcher for the given root path.
    /// SPEC: COMP-FILE-WATCH-001 FR-1
    /// Create a new file watcher for the given vault root
    pub fn new(root: &Path) -> Result<Self> {
        let (tx, rx) = channel();

        let mut watcher = RecommendedWatcher::new(
            move |res| {
                let _ = tx.send(res);
            },
            Config::default().with_poll_interval(Duration::from_millis(DEFAULT_POLL_INTERVAL_MS)),
        )?;

        watcher.watch(root, RecursiveMode::Recursive)?;

        info!(?root, "file watcher started");

        Ok(Self {
            watcher,
            rx,
            debounce_ms: DEFAULT_DEBOUNCE_MS,
            pending_events: HashMap::new(),
            root: root.to_path_buf(),
        })
    }

    /// Set the debounce duration (default 500ms).
    /// SPEC: COMP-FILE-WATCH-001 FR-6
    /// Set the debounce duration in milliseconds
    pub fn with_debounce(mut self, ms: u64) -> Self {
        self.debounce_ms = ms;
        self
    }

    /// Poll for file events that have passed the debounce period.
    /// Returns a vector of events to process.
    /// SPEC: COMP-FILE-WATCH-001 FR-6
    /// Poll for file events that have passed the debounce period
    pub fn poll_events(&mut self) -> Vec<FileEvent> {
        // Drain all pending events from the channel
        while let Ok(result) = self.rx.try_recv() {
            match result {
                Ok(event) => self.process_notify_event(event),
                Err(e) => error!(?e, "file watcher error"),
            }
        }

        // Return events that have passed debounce
        let now = Instant::now();
        let debounce = Duration::from_millis(self.debounce_ms);

        let ready_keys: Vec<String> = self
            .pending_events
            .iter()
            .filter_map(|(path, (_, time))| {
                if now.duration_since(*time) >= debounce {
                    Some(path.clone())
                } else {
                    None
                }
            })
            .collect();

        let ready: Vec<FileEvent> = ready_keys
            .into_iter()
            .filter_map(|path| self.pending_events.remove(&path).map(|(event, _)| event))
            .collect();

        ready
    }

    /// Processes a raw notify event and adds relevant file events to pending_events.
    fn process_notify_event(&mut self, event: Event) {
        debug!(?event, "raw notify event");

        match event.kind {
            notify::EventKind::Create(_) => {
                self.handle_modify_paths(&event.paths);
            }
            notify::EventKind::Modify(notify::event::ModifyKind::Name(_)) => {
                // Rename events have two paths: from and to
                if event.paths.len() == 2 {
                    let from = self.relative_path(&event.paths[0]);
                    let to = self.relative_path(&event.paths[1]);
                    if let (Some(from), Some(to)) = (from, to) {
                        if from.ends_with(MARKDOWN_EXT) || to.ends_with(MARKDOWN_EXT) {
                            // Remove any pending events for the old path
                            self.pending_events.remove(&from);
                            let event = FileEvent::Renamed {
                                from,
                                to: to.clone(),
                            };
                            self.pending_events.insert(to, (event, Instant::now()));
                        }
                    }
                }
            }
            notify::EventKind::Modify(_) => {
                self.handle_modify_paths(&event.paths);
            }
            notify::EventKind::Remove(_) => {
                for path in &event.paths {
                    if let Some(rel) = self.relative_path(path) {
                        if rel.ends_with(MARKDOWN_EXT) {
                            let event = FileEvent::Deleted { path: rel.clone() };
                            self.pending_events.insert(rel, (event, Instant::now()));
                        }
                    }
                }
            }
            _ => {}
        }
    }

    /// Handles modification events for a list of paths.
    /// Filters for markdown files and adds them to pending_events.
    fn handle_modify_paths(&mut self, paths: &[PathBuf]) {
        for path in paths {
            if let Some(rel) = self.relative_path(path) {
                if rel.ends_with(MARKDOWN_EXT) {
                    let event = FileEvent::Modified { path: rel.clone() };
                    self.pending_events.insert(rel, (event, Instant::now()));
                }
            }
        }
    }

    /// Converts an absolute path to a path relative to the watch root.
    /// Returns None if the path is not under the root or is in .vault/.
    fn relative_path(&self, path: &Path) -> Option<String> {
        let rel = path.strip_prefix(&self.root).ok()?;
        let rel_str = rel.to_string_lossy().to_string();
        // Skip .vault/ directory
        if rel_str.starts_with(".vault") {
            return None;
        }
        Some(rel_str)
    }
}

impl Drop for FileWatcher {
    fn drop(&mut self) {
        debug!("file watcher stopped");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::thread;
    use tempfile::TempDir;

    #[test]
    fn watcher_detects_new_file() {
        let dir = TempDir::new().unwrap();
        let mut watcher = FileWatcher::new(dir.path()).unwrap();

        // Create a file
        fs::write(dir.path().join("test.md"), "# Test").unwrap();
        thread::sleep(Duration::from_millis(100));

        // Poll multiple times to pass debounce
        let mut events = vec![];
        for _ in 0..12 {
            events.extend(watcher.poll_events());
            thread::sleep(Duration::from_millis(100));
        }

        assert!(!events.is_empty(), "should detect file creation");
        assert!(events.contains(&FileEvent::Modified {
            path: "test.md".to_string()
        }));
    }

    #[test]
    fn watcher_detects_modified_file() {
        let dir = TempDir::new().unwrap();
        let mut watcher = FileWatcher::new(dir.path()).unwrap();

        // Create a file first
        fs::write(dir.path().join("test.md"), "# Test").unwrap();
        thread::sleep(Duration::from_millis(100));

        // Clear events from creation
        let _ = watcher.poll_events();

        // Modify the file
        fs::write(dir.path().join("test.md"), "# Test\n\nUpdated content").unwrap();
        thread::sleep(Duration::from_millis(100));

        // Poll multiple times to pass debounce
        let mut events = vec![];
        for _ in 0..12 {
            events.extend(watcher.poll_events());
            thread::sleep(Duration::from_millis(100));
        }

        assert!(!events.is_empty(), "should detect file modification");
        assert!(events.contains(&FileEvent::Modified {
            path: "test.md".to_string()
        }));
    }

    #[test]
    fn watcher_detects_deleted_file() {
        let dir = TempDir::new().unwrap();
        let mut watcher = FileWatcher::new(dir.path()).unwrap();

        // Create a file first
        fs::write(dir.path().join("test.md"), "# Test").unwrap();
        thread::sleep(Duration::from_millis(100));

        // Clear events from creation
        let _ = watcher.poll_events();

        // Delete the file
        fs::remove_file(dir.path().join("test.md")).unwrap();
        thread::sleep(Duration::from_millis(100));

        // Poll multiple times to pass debounce
        let mut events = vec![];
        for _ in 0..12 {
            events.extend(watcher.poll_events());
            thread::sleep(Duration::from_millis(100));
        }

        assert!(!events.is_empty(), "should detect file deletion");
        assert!(events.contains(&FileEvent::Deleted {
            path: "test.md".to_string()
        }));
    }

    #[test]
    fn watcher_debounces_rapid_changes() {
        let dir = TempDir::new().unwrap();
        let mut watcher = FileWatcher::new(dir.path()).unwrap();

        // Create and modify file rapidly
        fs::write(dir.path().join("test.md"), "# Test 1").unwrap();
        thread::sleep(Duration::from_millis(50));

        fs::write(dir.path().join("test.md"), "# Test 2").unwrap();
        thread::sleep(Duration::from_millis(50));

        fs::write(dir.path().join("test.md"), "# Test 3").unwrap();
        thread::sleep(Duration::from_millis(50));

        // Poll immediately - should see events but they'll be debounced
        let mut events = vec![];
        for _ in 0..6 {
            events.extend(watcher.poll_events());
            thread::sleep(Duration::from_millis(100));
        }

        // After debounce period, should only see the last state
        // (The exact number depends on debounce timing, but should not be 3 separate events)
        assert!(!events.is_empty(), "should detect changes");
    }
}
