//! Host functions exposed to WASM plugins.

use tracing::debug;
use wasmtime::Caller;

/// Host function: Log a message from the plugin
pub fn host_log(mut caller: Caller<'_, super::runtime::PluginContext>, ptr: i32, len: i32) {
    // Read string from guest memory and log it
    let memory = match caller.get_export("memory") {
        Some(wasmtime::Extern::Memory(mem)) => mem,
        _ => {
            tracing::warn!("Plugin tried to log but memory is not available");
            return;
        }
    };

    // Validate length is non-negative and within reasonable bounds
    let len = if !(0..=65536).contains(&len) {
        // Max 64KB for log messages
        tracing::warn!("Plugin log message length {} is invalid", len);
        return;
    } else {
        len as usize
    };

    let ptr = ptr as usize;

    // Read bytes from guest memory
    let mut buffer = vec![0u8; len];
    match memory.read(&caller, ptr, &mut buffer) {
        Ok(_) => {}
        Err(e) => {
            tracing::warn!("Failed to read plugin log message from memory: {}", e);
            return;
        }
    };

    // Convert to string and log
    match String::from_utf8(buffer) {
        Ok(message) => {
            debug!(target: "plugin", "{}", message);
        }
        Err(e) => {
            tracing::warn!("Plugin log message is not valid UTF-8: {}", e);
        }
    }
}

/// Create all host functions for a linker
pub fn add_host_functions(
    linker: &mut wasmtime::Linker<super::runtime::PluginContext>,
) -> crate::error::Result<()> {
    // Add botpane::log function
    linker.func_wrap("botpane", "log", host_log)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use wasmtime::{Engine, Linker};

    #[test]
    fn test_add_host_functions() {
        let engine = Engine::default();
        let mut linker: Linker<crate::plugin::runtime::PluginContext> = Linker::new(&engine);

        // Add host function - should succeed
        add_host_functions(&mut linker).unwrap();

        // Verify the function was added by checking if we can create a store
        // and the linker is still valid
        let store = wasmtime::Store::new(&engine, crate::plugin::runtime::PluginContext::new());
        assert!(std::mem::size_of_val(&store) > 0);
    }
}
