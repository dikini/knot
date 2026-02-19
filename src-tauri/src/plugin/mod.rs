//! WASM plugin system for BotPane.

pub mod host;
pub mod manifest;
pub mod runtime;

pub use manifest::{PluginManifest, PluginPermission};
pub use runtime::{LoadedPlugin, PluginRuntime};
