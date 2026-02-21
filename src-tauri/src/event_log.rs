use crate::error::{Result, VaultError};
use serde::{Deserialize, Serialize};
use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

const EVENTS_DIR: &str = ".vault/events";
const COMMANDS_LOG_FILE: &str = "commands.jsonl";
const APPLIED_WATERMARK_FILE: &str = "applied.watermark";

pub struct EventLog {
    path: PathBuf,
    last_seq: AtomicU64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CommandEvent {
    pub seq: u64,
    pub timestamp_ms: i64,
    pub request_id: Option<String>,
    pub command_kind: String,
    pub target: Option<String>,
    pub status: String,
    pub message: String,
}

impl EventLog {
    pub fn new(path: impl Into<PathBuf>) -> Result<Self> {
        let path = path.into();
        let last_seq = Self::recover_last_seq(&path)?;

        Ok(Self {
            path,
            last_seq: AtomicU64::new(last_seq),
        })
    }

    pub fn from_vault_root(vault_root: impl AsRef<Path>) -> Result<Self> {
        Self::new(commands_log_path(vault_root))
    }

    pub fn append(&self, event: &CommandEvent) -> Result<()> {
        let current = self.last_seq.load(Ordering::Acquire);
        if event.seq <= current {
            return Err(VaultError::Other(format!(
                "event sequence must be strictly increasing (current={current}, next={})",
                event.seq
            )));
        }

        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)?;

        serde_json::to_writer(&mut file, event)?;
        file.write_all(b"\n")?;
        file.flush()?;

        self.last_seq.store(event.seq, Ordering::Release);
        Ok(())
    }

    pub fn last_seq(&self) -> u64 {
        self.last_seq.load(Ordering::Relaxed)
    }

    pub fn read_events(path: impl AsRef<Path>) -> Result<Vec<CommandEvent>> {
        let path = path.as_ref();
        if !path.exists() {
            return Ok(Vec::new());
        }

        let file = File::open(path)?;
        let reader = BufReader::new(file);
        let mut events = Vec::new();

        for line in reader.lines() {
            let line = line?;
            if line.trim().is_empty() {
                continue;
            }
            events.push(serde_json::from_str::<CommandEvent>(&line)?);
        }

        Ok(events)
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn discover_vault_root(start: impl AsRef<Path>) -> Option<PathBuf> {
        let mut current = start.as_ref().to_path_buf();
        loop {
            if current.join(".vault").is_dir() {
                return Some(current);
            }
            if !current.pop() {
                return None;
            }
        }
    }

    fn recover_last_seq(path: &Path) -> Result<u64> {
        let mut last_seq = 0_u64;

        for event in Self::read_events(path)? {
            if event.seq > last_seq {
                last_seq = event.seq;
            }
        }

        Ok(last_seq)
    }
}

pub fn read_latest_seq_from_vault_metadata(vault_root: impl AsRef<Path>) -> u64 {
    let path = commands_log_path(vault_root);
    let Ok(events) = EventLog::read_events(path) else {
        return 0;
    };

    events
        .into_iter()
        .map(|event| event.seq)
        .max()
        .unwrap_or_default()
}

pub fn read_applied_watermark_from_vault_metadata(vault_root: impl AsRef<Path>) -> u64 {
    let path = applied_watermark_path(vault_root);
    let Ok(contents) = std::fs::read_to_string(path) else {
        return 0;
    };

    contents.trim().parse::<u64>().unwrap_or_default()
}

pub fn read_consistency_seqs_from_vault_metadata(vault_root: impl AsRef<Path>) -> (u64, u64) {
    let latest_seq = read_latest_seq_from_vault_metadata(&vault_root);
    let observed_seq = read_applied_watermark_from_vault_metadata(vault_root).min(latest_seq);
    (observed_seq, latest_seq)
}

fn commands_log_path(vault_root: impl AsRef<Path>) -> PathBuf {
    vault_root.as_ref().join(EVENTS_DIR).join(COMMANDS_LOG_FILE)
}

fn applied_watermark_path(vault_root: impl AsRef<Path>) -> PathBuf {
    vault_root
        .as_ref()
        .join(EVENTS_DIR)
        .join(APPLIED_WATERMARK_FILE)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command_event(seq: u64) -> CommandEvent {
        CommandEvent {
            seq,
            timestamp_ms: 1_700_000_000_000 + seq as i64,
            request_id: Some(format!("req-{seq}")),
            command_kind: "ui.open_new_vault_dialog".to_string(),
            target: None,
            status: "accepted".to_string(),
            message: "Command queued".to_string(),
        }
    }

    #[test]
    fn event_log_appends_monotonic_seq() {
        let dir = tempfile::tempdir().expect("temp dir");
        let path = dir.path().join("commands.jsonl");
        let log = EventLog::new(&path).expect("create log");

        log.append(&command_event(1)).expect("append seq 1");
        log.append(&command_event(2)).expect("append seq 2");
        log.append(&command_event(3)).expect("append seq 3");

        let events = EventLog::read_events(&path).expect("read events");
        assert_eq!(events.len(), 3, "expected three persisted events");
        assert!(
            events[0].seq < events[1].seq,
            "first seq should be monotonic"
        );
        assert!(
            events[1].seq < events[2].seq,
            "second seq should be monotonic"
        );
        assert_eq!(log.last_seq(), 3, "last_seq should track latest append");
    }

    #[test]
    fn event_log_recovers_last_seq_after_restart() {
        let dir = tempfile::tempdir().expect("temp dir");
        let path = dir.path().join("commands.jsonl");

        {
            let log = EventLog::new(&path).expect("create log");
            log.append(&command_event(1)).expect("append seq 1");
            log.append(&command_event(2)).expect("append seq 2");
            assert_eq!(log.last_seq(), 2, "precondition: last seq before restart");
        }

        let restarted = EventLog::new(&path).expect("reopen log");
        assert_eq!(
            restarted.last_seq(),
            2,
            "event log should recover last sequence from disk"
        );

        restarted
            .append(&command_event(3))
            .expect("append seq 3 after restart");
        let events = EventLog::read_events(&path).expect("read events");
        assert_eq!(
            events.len(),
            3,
            "expected three persisted events after restart"
        );
        assert_eq!(
            events.last().map(|event| event.seq),
            Some(3),
            "last persisted sequence should continue after restart"
        );
    }

    #[test]
    fn read_consistency_seqs_defaults_to_zero_when_metadata_missing() {
        let dir = tempfile::tempdir().expect("temp dir");
        let (observed_seq, latest_seq) = read_consistency_seqs_from_vault_metadata(dir.path());
        assert_eq!(observed_seq, 0, "missing watermark should default to zero");
        assert_eq!(latest_seq, 0, "missing command log should default to zero");
    }

    #[test]
    fn read_consistency_seqs_reads_latest_and_applied_values() {
        let dir = tempfile::tempdir().expect("temp dir");
        let log = EventLog::from_vault_root(dir.path()).expect("create log");
        log.append(&command_event(2)).expect("append seq 2");
        log.append(&command_event(6)).expect("append seq 6");

        let watermark_path = applied_watermark_path(dir.path());
        std::fs::write(watermark_path, "4").expect("write watermark");

        let (observed_seq, latest_seq) = read_consistency_seqs_from_vault_metadata(dir.path());
        assert_eq!(latest_seq, 6, "latest seq should come from event log");
        assert_eq!(
            observed_seq, 4,
            "observed seq should come from applied watermark"
        );
    }

    #[test]
    fn read_consistency_seqs_clamps_observed_seq_to_latest_seq() {
        let dir = tempfile::tempdir().expect("temp dir");
        let log = EventLog::from_vault_root(dir.path()).expect("create log");
        log.append(&command_event(3)).expect("append seq 3");

        let watermark_path = applied_watermark_path(dir.path());
        std::fs::write(watermark_path, "9").expect("write watermark");

        let (observed_seq, latest_seq) = read_consistency_seqs_from_vault_metadata(dir.path());
        assert_eq!(latest_seq, 3, "latest seq should come from event log");
        assert_eq!(
            observed_seq, 3,
            "observed seq should be clamped to latest seq"
        );
    }
}
