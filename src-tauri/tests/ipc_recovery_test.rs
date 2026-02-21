use knot::app_command::{AppCommand, ResourceCommand};
use knot::event_log::EventLog;
use knot::{IpcClient, IpcServer};
use std::collections::HashSet;
use std::path::Path;
use std::sync::mpsc::{self, Receiver};
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

#[test]
fn seq_recovers_after_server_restart_and_event_log_reload() {
    const FIRST_BATCH: usize = 120;
    const SECOND_BATCH: usize = 80;

    let temp = create_vault_root();

    let socket_one = temp.path().join("ipc-recovery-first.sock");
    let (tx_one, rx_one) = mpsc::channel::<AppCommand>();
    IpcServer::new(socket_one.clone(), tx_one)
        .start()
        .expect("start first IPC server");
    let client_one = IpcClient::new(socket_one.clone());
    wait_for_socket(&client_one, &socket_one, Duration::from_secs(5));

    let mut first_seqs = Vec::with_capacity(FIRST_BATCH);
    for index in 0..FIRST_BATCH {
        let result = client_one
            .send_command(AppCommand::Resource(ResourceCommand::UpdateNote {
                path: "recovery/shared.md".to_string(),
                content: format!("first-{index}"),
            }))
            .unwrap_or_else(|err| panic!("failed sending first-batch command {index}: {err}"));
        first_seqs.push(
            result
                .seq
                .unwrap_or_else(|| panic!("missing seq in first-batch response {index}")),
        );
    }

    let _first_batch_commands = collect_commands(&rx_one, FIRST_BATCH, Duration::from_secs(10));
    assert_unique_contiguous(first_seqs.clone());
    let max_first_seq = *first_seqs.iter().max().expect("missing first seq");

    // Simulate restart/reload by unlinking the first socket path and binding a fresh server to
    // the same endpoint. The original listener thread remains detached, but once unlinked it is
    // no longer reachable for new clients.
    drop(rx_one);
    drop(client_one);
    std::fs::remove_file(&socket_one).expect("unlink first socket before restart");

    // The new server should recover its next sequence from the persisted event log.
    let socket_two = socket_one.clone();
    let (tx_two, rx_two) = mpsc::channel::<AppCommand>();
    IpcServer::new(socket_two.clone(), tx_two)
        .start()
        .expect("start second IPC server");
    let client_two = IpcClient::new(socket_two.clone());
    wait_for_socket(&client_two, &socket_two, Duration::from_secs(5));

    let mut second_seqs = Vec::with_capacity(SECOND_BATCH);
    for index in 0..SECOND_BATCH {
        let result = client_two
            .send_command(AppCommand::Resource(ResourceCommand::UpdateNote {
                path: "recovery/shared.md".to_string(),
                content: format!("second-{index}"),
            }))
            .unwrap_or_else(|err| panic!("failed sending second-batch command {index}: {err}"));
        second_seqs.push(
            result
                .seq
                .unwrap_or_else(|| panic!("missing seq in second-batch response {index}")),
        );
    }

    let _second_batch_commands = collect_commands(&rx_two, SECOND_BATCH, Duration::from_secs(10));
    assert_unique_contiguous(second_seqs.clone());

    let min_second_seq = *second_seqs.iter().min().expect("missing second seq");
    let max_second_seq = *second_seqs.iter().max().expect("missing second seq");

    assert_eq!(
        min_second_seq,
        max_first_seq + 1,
        "sequence should resume from prior max after restart"
    );

    let all_seqs: Vec<u64> = first_seqs
        .iter()
        .copied()
        .chain(second_seqs.iter().copied())
        .collect();
    let unique: HashSet<u64> = all_seqs.iter().copied().collect();
    assert_eq!(
        unique.len(),
        all_seqs.len(),
        "detected duplicate sequence values across restart"
    );
    assert_unique_contiguous(all_seqs.clone());

    let reloaded_log = EventLog::from_vault_root(temp.path()).expect("open event log");
    let events = EventLog::read_events(reloaded_log.path()).expect("read events");
    assert_eq!(
        events.len(),
        FIRST_BATCH + SECOND_BATCH,
        "unexpected number of persisted events"
    );

    let event_seqs: Vec<u64> = events.iter().map(|event| event.seq).collect();
    assert_unique_contiguous(event_seqs);
    assert_eq!(
        reloaded_log.last_seq(),
        max_second_seq,
        "event log reload should report latest sequence"
    );
}
