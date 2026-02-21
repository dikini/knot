use knot::app_command::{AppCommand, ResourceCommand, SettingsCommand};
use knot::{IpcClient, IpcServer};
use serde_json::Value;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::path::Path;
use std::sync::mpsc::{self, Receiver};
use std::sync::{Arc, Barrier};
use std::thread;
use std::time::{Duration, Instant};
use tempfile::TempDir;

fn create_vault_root() -> TempDir {
    let dir = tempfile::tempdir().expect("create temp dir");
    std::fs::create_dir_all(dir.path().join(".vault")).expect("create .vault");
    dir
}

fn wait_for_socket(client: &IpcClient, socket_path: &Path, timeout: Duration) {
    let deadline = Instant::now() + timeout;
    loop {
        if socket_path.exists() && client.ping().unwrap_or(false) {
            return;
        }
        assert!(
            Instant::now() < deadline,
            "IPC socket did not become ready: {}",
            socket_path.display()
        );
        thread::sleep(Duration::from_millis(10));
    }
}

fn collect_commands(
    receiver: &Receiver<AppCommand>,
    expected: usize,
    timeout: Duration,
) -> Vec<AppCommand> {
    let mut commands = Vec::with_capacity(expected);
    let deadline = Instant::now() + timeout;

    while commands.len() < expected {
        let now = Instant::now();
        assert!(
            now < deadline,
            "timed out waiting for command {} of {}",
            commands.len() + 1,
            expected
        );

        let remaining = deadline.saturating_duration_since(now);
        let command = receiver
            .recv_timeout(remaining)
            .unwrap_or_else(|err| panic!("failed receiving queued command: {err}"));
        commands.push(command);
    }

    commands
}

fn assert_unique_contiguous(mut seqs: Vec<u64>) {
    assert!(!seqs.is_empty(), "expected at least one sequence number");
    seqs.sort_unstable();

    for pair in seqs.windows(2) {
        assert_eq!(
            pair[0] + 1,
            pair[1],
            "sequence gap or duplicate detected between {} and {}",
            pair[0],
            pair[1]
        );
    }
}

fn settings_patch(index: usize) -> Value {
    let mut patch = serde_json::Map::new();
    patch.insert(
        format!("key_{index}"),
        Value::String(format!("value_{index}")),
    );
    Value::Object(patch)
}

#[test]
fn high_contention_same_note_seq_is_monotonic_and_last_write_is_deterministic() {
    const COMMAND_COUNT: usize = 1000;
    let temp = create_vault_root();
    let socket_path = temp.path().join("ipc-high-contention.sock");

    let (tx, rx) = mpsc::channel::<AppCommand>();
    IpcServer::new(socket_path.clone(), tx)
        .start()
        .expect("start IPC server");

    let client = IpcClient::new(socket_path.clone());
    wait_for_socket(&client, &socket_path, Duration::from_secs(5));

    let barrier = Arc::new(Barrier::new(COMMAND_COUNT + 1));
    let client = Arc::new(client);
    let (result_tx, result_rx) = mpsc::channel::<(usize, u64)>();
    let mut handles = Vec::with_capacity(COMMAND_COUNT);

    for index in 0..COMMAND_COUNT {
        let barrier = Arc::clone(&barrier);
        let client = Arc::clone(&client);
        let result_tx = result_tx.clone();

        handles.push(thread::spawn(move || {
            barrier.wait();

            let content = format!("write-{index:04}");
            let result = client
                .send_command(AppCommand::Resource(ResourceCommand::UpdateNote {
                    path: "notes/shared.md".to_string(),
                    content,
                }))
                .unwrap_or_else(|err| panic!("send_command failed for index {index}: {err}"));

            let seq = result
                .seq
                .unwrap_or_else(|| panic!("missing seq in response for index {index}"));

            result_tx
                .send((index, seq))
                .unwrap_or_else(|err| panic!("failed to send result for index {index}: {err}"));
        }));
    }

    barrier.wait();
    drop(result_tx);

    for handle in handles {
        handle.join().expect("sender thread panicked");
    }

    let results: Vec<(usize, u64)> = result_rx.into_iter().collect();
    assert_eq!(
        results.len(),
        COMMAND_COUNT,
        "expected one response per concurrent command"
    );

    let mut seq_to_index = BTreeMap::new();
    for (index, seq) in results {
        let prior = seq_to_index.insert(seq, index);
        assert!(prior.is_none(), "duplicate seq encountered: {seq}");
    }
    assert_eq!(
        seq_to_index.len(),
        COMMAND_COUNT,
        "expected unique sequence numbers"
    );
    assert_unique_contiguous(seq_to_index.keys().copied().collect());

    let last_writer_index = *seq_to_index.last_key_value().expect("missing max seq").1;
    let expected_last_content = format!("write-{last_writer_index:04}");

    let queued_commands = collect_commands(&rx, COMMAND_COUNT, Duration::from_secs(30));
    let last_command = queued_commands.last().expect("missing queued command");

    let last_content = match last_command {
        AppCommand::Resource(ResourceCommand::UpdateNote { path, content }) => {
            assert_eq!(path, "notes/shared.md", "unexpected target path");
            content.clone()
        }
        other => panic!("unexpected command variant in queue tail: {other:?}"),
    };

    assert_eq!(
        last_content, expected_last_content,
        "final queued write should match highest-seq writer"
    );
}

#[test]
fn mixed_resource_race_preserves_seq_integrity_and_valid_post_state_model() {
    const GROUPS: usize = 100;
    let temp = create_vault_root();
    let socket_path = temp.path().join("ipc-mixed-race.sock");

    let (tx, rx) = mpsc::channel::<AppCommand>();
    IpcServer::new(socket_path.clone(), tx)
        .start()
        .expect("start IPC server");

    let client = IpcClient::new(socket_path.clone());
    wait_for_socket(&client, &socket_path, Duration::from_secs(5));

    let mut commands = Vec::with_capacity(GROUPS * 4);
    for index in 0..GROUPS {
        let directory = format!("race/dir-{index}");
        let note_path = format!("{directory}/note.md");

        commands.push(AppCommand::Resource(ResourceCommand::CreateDirectory {
            path: directory.clone(),
        }));
        commands.push(AppCommand::Resource(ResourceCommand::CreateNote {
            path: note_path.clone(),
            content: format!("initial-{index}"),
        }));
        commands.push(AppCommand::Resource(ResourceCommand::UpdateNote {
            path: note_path,
            content: format!("final-{index}"),
        }));
        commands.push(AppCommand::Settings(SettingsCommand::UpdateVaultSettings {
            patch: settings_patch(index),
        }));
    }

    let total_commands = commands.len();
    let barrier = Arc::new(Barrier::new(total_commands + 1));
    let client = Arc::new(client);
    let (seq_tx, seq_rx) = mpsc::channel::<u64>();
    let mut handles = Vec::with_capacity(total_commands);

    for command in commands {
        let barrier = Arc::clone(&barrier);
        let client = Arc::clone(&client);
        let seq_tx = seq_tx.clone();

        handles.push(thread::spawn(move || {
            barrier.wait();

            let result = client
                .send_command(command)
                .unwrap_or_else(|err| panic!("send_command failed during mixed race: {err}"));
            let seq = result
                .seq
                .unwrap_or_else(|| panic!("missing seq in mixed race response"));
            seq_tx
                .send(seq)
                .unwrap_or_else(|err| panic!("failed sending mixed race seq: {err}"));
        }));
    }

    barrier.wait();
    drop(seq_tx);

    for handle in handles {
        handle.join().expect("mixed-race sender thread panicked");
    }

    let seqs: Vec<u64> = seq_rx.into_iter().collect();
    assert_eq!(
        seqs.len(),
        total_commands,
        "expected one seq per mixed-race command"
    );
    assert_unique_contiguous(seqs);

    let queued_commands = collect_commands(&rx, total_commands, Duration::from_secs(20));

    let mut create_directory_count = 0;
    let mut create_note_count = 0;
    let mut update_note_count = 0;
    let mut settings_update_count = 0;

    let mut directories: HashSet<String> = HashSet::new();
    let mut notes: HashMap<String, String> = HashMap::new();
    let mut settings: HashMap<String, Value> = HashMap::new();

    for command in queued_commands {
        match command {
            AppCommand::Resource(ResourceCommand::CreateDirectory { path }) => {
                create_directory_count += 1;
                directories.insert(path);
            }
            AppCommand::Resource(ResourceCommand::DeleteDirectory { path, .. }) => {
                directories.remove(&path);
                notes.retain(|note_path, _| !note_path.starts_with(&format!("{path}/")));
            }
            AppCommand::Resource(ResourceCommand::CreateNote { path, content })
            | AppCommand::Resource(ResourceCommand::UpdateNote { path, content }) => {
                if content.starts_with("initial-") {
                    create_note_count += 1;
                } else {
                    update_note_count += 1;
                }
                notes.insert(path, content);
            }
            AppCommand::Resource(ResourceCommand::DeleteNote { path }) => {
                notes.remove(&path);
            }
            AppCommand::Resource(ResourceCommand::MoveNote { from_path, to_path }) => {
                if let Some(content) = notes.remove(&from_path) {
                    notes.insert(to_path, content);
                }
            }
            AppCommand::Settings(SettingsCommand::UpdateVaultSettings { patch })
            | AppCommand::Settings(SettingsCommand::UpdateAppSettings { patch }) => {
                settings_update_count += 1;
                if let Value::Object(map) = patch {
                    for (key, value) in map {
                        settings.insert(key, value);
                    }
                }
            }
            AppCommand::Ui(ui_command) => {
                panic!("unexpected UI command in mixed-resource race: {ui_command:?}");
            }
        }
    }

    assert_eq!(
        create_directory_count, GROUPS,
        "unexpected directory command count"
    );
    assert_eq!(
        create_note_count, GROUPS,
        "unexpected create note command count"
    );
    assert_eq!(
        update_note_count, GROUPS,
        "unexpected update note command count"
    );
    assert_eq!(
        settings_update_count, GROUPS,
        "unexpected settings command count"
    );

    assert_eq!(
        directories.len(),
        GROUPS,
        "missing directories in post-state"
    );
    assert_eq!(notes.len(), GROUPS, "missing notes in post-state");
    assert_eq!(
        settings.len(),
        GROUPS,
        "missing settings keys in post-state"
    );

    for index in 0..GROUPS {
        let directory = format!("race/dir-{index}");
        let note_path = format!("{directory}/note.md");
        let settings_key = format!("key_{index}");
        assert!(
            directories.contains(&directory),
            "directory missing from post-state model: {directory}"
        );
        assert!(
            notes.contains_key(&note_path),
            "note missing from post-state model: {note_path}"
        );
        assert!(
            settings.contains_key(&settings_key),
            "settings key missing from post-state model: {settings_key}"
        );
    }
}
