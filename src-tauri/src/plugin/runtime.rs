//! WASM plugin runtime using wasmtime.

use crate::error::VaultError;
use crate::plugin::host::add_host_functions;
use crate::plugin::manifest::{PluginManifest, PluginPermission};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use wasmtime::{Engine, Instance, Linker, Module, Store};
use wasmtime_wasi::preview2::preview1::{self, WasiPreview1Adapter, WasiPreview1View};
use wasmtime_wasi::preview2::{Table, WasiCtx, WasiCtxBuilder, WasiView};

/// Context for plugin store
pub struct PluginContext {
    table: Table,
    wasi: WasiCtx,
    preview1_adapter: WasiPreview1Adapter,
}

impl std::fmt::Debug for PluginContext {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PluginContext").finish_non_exhaustive()
    }
}

impl PluginContext {
    /// Create a new plugin context with default WASI settings.
    pub fn new() -> Self {
        let wasi = WasiCtxBuilder::new().inherit_stdio().build();
        Self {
            table: Table::new(),
            wasi,
            preview1_adapter: WasiPreview1Adapter::new(),
        }
    }
}

impl WasiView for PluginContext {
    fn table(&self) -> &Table {
        &self.table
    }

    fn table_mut(&mut self) -> &mut Table {
        &mut self.table
    }

    fn ctx(&self) -> &WasiCtx {
        &self.wasi
    }

    fn ctx_mut(&mut self) -> &mut WasiCtx {
        &mut self.wasi
    }
}

impl WasiPreview1View for PluginContext {
    fn adapter(&self) -> &WasiPreview1Adapter {
        &self.preview1_adapter
    }

    fn adapter_mut(&mut self) -> &mut WasiPreview1Adapter {
        &mut self.preview1_adapter
    }
}

impl Default for PluginContext {
    fn default() -> Self {
        Self::new()
    }
}

/// A loaded plugin instance.
pub struct LoadedPlugin {
    /// Plugin manifest
    pub manifest: PluginManifest,
    /// Path to the plugin directory
    pub path: PathBuf,
    store: Store<PluginContext>,
    instance: Instance,
}

impl LoadedPlugin {
    /// Get the plugin name.
    pub fn name(&self) -> &str {
        &self.manifest.name
    }

    /// Check if the plugin has a specific permission.
    pub fn has_permission(&self, permission: PluginPermission) -> bool {
        self.manifest.has_permission(permission)
    }
}

impl std::fmt::Debug for LoadedPlugin {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("LoadedPlugin")
            .field("manifest", &self.manifest)
            .field("path", &self.path)
            .finish_non_exhaustive()
    }
}

/// Runtime for managing WASM plugins.
pub struct PluginRuntime {
    /// wasmtime engine for compiling and running WASM modules
    engine: Engine,
    /// Currently loaded plugins
    plugins: Arc<Mutex<HashMap<String, LoadedPlugin>>>,
}

impl std::fmt::Debug for PluginRuntime {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PluginRuntime")
            .field("plugins", &self.plugins)
            .finish_non_exhaustive()
    }
}

impl PluginRuntime {
    /// Create a new plugin runtime with default settings.
    pub fn new() -> crate::Result<Self> {
        let engine = Engine::default();
        Ok(Self {
            engine,
            plugins: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    /// Create a new plugin runtime with a custom engine.
    pub fn with_engine(engine: Engine) -> Self {
        Self {
            engine,
            plugins: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Load a plugin from a directory containing a `plugin.toml` manifest.
    ///
    /// The directory should contain:
    /// - `plugin.toml` - Plugin manifest file
    /// - The WASM file specified in the manifest's `entry_point`
    pub fn load_plugin<P: AsRef<Path>>(&self, plugin_dir: P) -> crate::Result<String> {
        let plugin_dir = plugin_dir.as_ref();
        let manifest_path = plugin_dir.join("plugin.toml");

        if !manifest_path.exists() {
            return Err(VaultError::Plugin(format!(
                "Plugin manifest not found at {}",
                manifest_path.display()
            )));
        }

        let manifest = PluginManifest::from_file(&manifest_path)?;
        let name = manifest.name.clone();

        let wasm_path = plugin_dir.join(&manifest.entry_point);
        if !wasm_path.exists() {
            return Err(VaultError::Plugin(format!(
                "WASM entry point not found: {}",
                wasm_path.display()
            )));
        }

        let module = Module::from_file(&self.engine, &wasm_path)
            .map_err(|e| VaultError::Plugin(format!("Failed to load WASM module: {e}")))?;

        // Create linker and add WASI preview1
        let mut linker = Linker::new(&self.engine);
        preview1::add_to_linker_sync(&mut linker)
            .map_err(|e| VaultError::Plugin(format!("Failed to add WASI to linker: {e}")))?;

        // Add custom host functions
        add_host_functions(&mut linker)?;

        // Create store with PluginContext
        let context = PluginContext::new();
        let mut store = Store::new(&self.engine, context);

        // Instantiate the module
        let instance = linker
            .instantiate(&mut store, &module)
            .map_err(|e| VaultError::Plugin(format!("Failed to instantiate WASM module: {e}")))?;

        // Call plugin_init if it exists
        if let Ok(plugin_init) = instance.get_typed_func::<(), ()>(&mut store, "plugin_init") {
            plugin_init
                .call(&mut store, ())
                .map_err(|e| VaultError::Plugin(format!("plugin_init failed: {e}")))?;
        }

        let plugin = LoadedPlugin {
            manifest,
            path: plugin_dir.to_path_buf(),
            store,
            instance,
        };

        let mut plugins = self.plugins.lock().unwrap();
        if plugins.contains_key(&name) {
            return Err(VaultError::Plugin(format!(
                "Plugin '{}' is already loaded",
                name
            )));
        }

        plugins.insert(name.clone(), plugin);

        Ok(name)
    }

    /// Unload a plugin by name.
    pub fn unload_plugin(&self, name: &str) -> crate::Result<()> {
        let mut plugins = self.plugins.lock().unwrap();
        let plugin = plugins
            .get_mut(name)
            .ok_or_else(|| VaultError::Plugin(format!("Plugin '{}' is not loaded", name)))?;

        // Call plugin_shutdown if it exists
        if let Ok(plugin_shutdown) = plugin
            .instance
            .get_typed_func::<(), ()>(&mut plugin.store, "plugin_shutdown")
        {
            let _ = plugin_shutdown.call(&mut plugin.store, ());
        }

        plugins.remove(name);
        Ok(())
    }

    /// Check if a plugin is loaded.
    pub fn is_loaded(&self, name: &str) -> bool {
        let plugins = self.plugins.lock().unwrap();
        plugins.contains_key(name)
    }

    /// Get plugin info by name (returns manifest info without the instance).
    pub fn get_plugin_info(&self, name: &str) -> Option<(PluginManifest, PathBuf)> {
        let plugins = self.plugins.lock().unwrap();
        plugins
            .get(name)
            .map(|p| (p.manifest.clone(), p.path.clone()))
    }

    /// List all loaded plugin names.
    pub fn loaded_plugins(&self) -> Vec<String> {
        let plugins = self.plugins.lock().unwrap();
        plugins.keys().cloned().collect()
    }

    /// Get the number of loaded plugins.
    pub fn plugin_count(&self) -> usize {
        let plugins = self.plugins.lock().unwrap();
        plugins.len()
    }
}

impl Default for PluginRuntime {
    fn default() -> Self {
        Self::new().expect("Failed to create default PluginRuntime")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_manifest(name: &str) -> String {
        format!(
            r#"
name = "{}"
display_name = "Test Plugin"
version = "1.0.0"
entry_point = "test.wasm"
api_version = "1.0"
permissions = ["fs_read"]
"#,
            name
        )
    }

    fn create_minimal_wasm_bytes() -> Vec<u8> {
        // Minimal valid WASM module: (module)
        // Magic number: 0x00 0x61 0x73 0x6d
        // Version: 0x01 0x00 0x00 0x00
        vec![0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]
    }

    #[test]
    fn test_runtime_new() {
        let runtime = PluginRuntime::new();
        assert!(runtime.is_ok());
    }

    #[test]
    fn test_load_plugin_missing_manifest() {
        let runtime = PluginRuntime::new().unwrap();
        let temp_dir = TempDir::new().unwrap();

        let result = runtime.load_plugin(temp_dir.path());
        assert!(result.is_err());
        let err_msg = format!("{}", result.unwrap_err());
        assert!(err_msg.contains("Plugin manifest not found"));
    }

    #[test]
    fn test_load_plugin_missing_wasm() {
        let runtime = PluginRuntime::new().unwrap();
        let temp_dir = TempDir::new().unwrap();

        let manifest = create_test_manifest("test-plugin");
        let manifest_path = temp_dir.path().join("plugin.toml");
        std::fs::write(manifest_path, manifest).unwrap();

        let result = runtime.load_plugin(temp_dir.path());
        assert!(result.is_err());
        let err_msg = format!("{}", result.unwrap_err());
        assert!(err_msg.contains("WASM entry point not found"));
    }

    #[test]
    fn test_load_and_unload_plugin() {
        let runtime = PluginRuntime::new().unwrap();
        let temp_dir = TempDir::new().unwrap();

        // Create manifest
        let manifest = create_test_manifest("test-plugin");
        let manifest_path = temp_dir.path().join("plugin.toml");
        std::fs::write(manifest_path, manifest).unwrap();

        // Create minimal WASM file
        let wasm_path = temp_dir.path().join("test.wasm");
        std::fs::write(wasm_path, create_minimal_wasm_bytes()).unwrap();

        // Load plugin
        let name = runtime.load_plugin(temp_dir.path()).unwrap();
        assert_eq!(name, "test-plugin");
        assert!(runtime.is_loaded("test-plugin"));
        assert_eq!(runtime.plugin_count(), 1);

        // Unload plugin
        runtime.unload_plugin("test-plugin").unwrap();
        assert!(!runtime.is_loaded("test-plugin"));
        assert_eq!(runtime.plugin_count(), 0);
    }

    #[test]
    fn test_load_duplicate_plugin() {
        let runtime = PluginRuntime::new().unwrap();
        let temp_dir = TempDir::new().unwrap();

        // Create manifest and WASM
        let manifest = create_test_manifest("duplicate-plugin");
        std::fs::write(temp_dir.path().join("plugin.toml"), manifest).unwrap();
        std::fs::write(
            temp_dir.path().join("test.wasm"),
            create_minimal_wasm_bytes(),
        )
        .unwrap();

        // Load first time
        runtime.load_plugin(temp_dir.path()).unwrap();

        // Try to load again
        let result = runtime.load_plugin(temp_dir.path());
        assert!(result.is_err());
        let err_msg = format!("{}", result.unwrap_err());
        assert!(err_msg.contains("already loaded"));
    }

    #[test]
    fn test_unload_not_loaded_plugin() {
        let runtime = PluginRuntime::new().unwrap();

        let result = runtime.unload_plugin("not-loaded");
        assert!(result.is_err());
        let err_msg = format!("{}", result.unwrap_err());
        assert!(err_msg.contains("not loaded"));
    }

    #[test]
    fn test_get_plugin_info() {
        let runtime = PluginRuntime::new().unwrap();
        let temp_dir = TempDir::new().unwrap();

        // Create manifest and WASM
        let manifest = create_test_manifest("gettable-plugin");
        std::fs::write(temp_dir.path().join("plugin.toml"), manifest).unwrap();
        std::fs::write(
            temp_dir.path().join("test.wasm"),
            create_minimal_wasm_bytes(),
        )
        .unwrap();

        // Load and get info
        runtime.load_plugin(temp_dir.path()).unwrap();
        let info = runtime.get_plugin_info("gettable-plugin");
        assert!(info.is_some());

        let (manifest, _path) = info.unwrap();
        assert_eq!(manifest.name, "gettable-plugin");
        assert!(manifest.has_permission(PluginPermission::FsRead));
        assert!(!manifest.has_permission(PluginPermission::FsWrite));

        // Get non-existent
        assert!(runtime.get_plugin_info("non-existent").is_none());
    }

    #[test]
    fn test_loaded_plugins_list() {
        let runtime = PluginRuntime::new().unwrap();

        // Initially empty
        assert!(runtime.loaded_plugins().is_empty());

        // Load a plugin
        let temp_dir = TempDir::new().unwrap();
        let manifest = create_test_manifest("listed-plugin");
        std::fs::write(temp_dir.path().join("plugin.toml"), manifest).unwrap();
        std::fs::write(
            temp_dir.path().join("test.wasm"),
            create_minimal_wasm_bytes(),
        )
        .unwrap();

        runtime.load_plugin(temp_dir.path()).unwrap();

        let loaded = runtime.loaded_plugins();
        assert_eq!(loaded.len(), 1);
        assert!(loaded.contains(&"listed-plugin".to_string()));
    }

    #[test]
    fn test_invalid_wasm_file() {
        let runtime = PluginRuntime::new().unwrap();
        let temp_dir = TempDir::new().unwrap();

        // Create manifest
        let manifest = create_test_manifest("bad-wasm-plugin");
        std::fs::write(temp_dir.path().join("plugin.toml"), manifest).unwrap();

        // Create invalid WASM file (not actually WASM)
        std::fs::write(temp_dir.path().join("test.wasm"), b"not wasm").unwrap();

        let result = runtime.load_plugin(temp_dir.path());
        assert!(result.is_err());
        let err_msg = format!("{}", result.unwrap_err());
        assert!(err_msg.contains("Failed to load WASM module"));
    }

    #[test]
    fn test_load_example_plugin() {
        let runtime = PluginRuntime::new().unwrap();

        // Get the path to the example plugin
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let example_plugin_dir = manifest_dir.join("../plugins/example");
        let wasm_file = example_plugin_dir.join("example.wasm");

        // Skip if example plugin WASM doesn't exist (needs to be built first)
        if !wasm_file.exists() {
            println!(
                "Example plugin WASM not found at {}, skipping test",
                wasm_file.display()
            );
            return;
        }

        // Load the example plugin
        let name = runtime.load_plugin(&example_plugin_dir).unwrap();
        assert_eq!(name, "botpane-plugin-example");
        assert!(runtime.is_loaded("botpane-plugin-example"));

        // Get plugin info
        let info = runtime.get_plugin_info("botpane-plugin-example");
        assert!(info.is_some());
        let (manifest, _path) = info.unwrap();
        assert_eq!(manifest.name, "botpane-plugin-example");
        assert!(manifest.has_permission(PluginPermission::VaultRead));
        assert!(manifest.has_permission(PluginPermission::Ui));

        // Unload plugin
        runtime.unload_plugin("botpane-plugin-example").unwrap();
        assert!(!runtime.is_loaded("botpane-plugin-example"));
    }

    #[test]
    fn test_plugin_context() {
        let ctx = PluginContext::new();
        assert!(std::mem::size_of_val(&ctx) > 0); // Just verify it creates successfully
    }
}
