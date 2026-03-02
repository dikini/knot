use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NoteTypeId {
    Markdown,
    #[serde(rename = "youtube")]
    YouTube,
    Pdf,
    Image,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteModeAvailability {
    pub meta: bool,
    pub source: bool,
    pub edit: bool,
    pub view: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteMediaData {
    pub mime_type: String,
    pub file_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NoteTypeMetadata {
    pub extra: serde_json::Map<String, serde_json::Value>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EmbedDescriptionSource {
    PluginDefined,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EmbedActionTarget {
    Note,
    External,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EmbedAction {
    pub target: EmbedActionTarget,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum EmbedShape {
    Link {
        title: String,
        #[serde(default)]
        description: Option<String>,
    },
    Image {
        src: String,
        #[serde(default)]
        alt: Option<String>,
        #[serde(default)]
        title: Option<String>,
        #[serde(default)]
        description: Option<String>,
    },
    Canvas {
        #[serde(default)]
        title: Option<String>,
        #[serde(default)]
        description: Option<String>,
    },
    Iframe {
        src: String,
        #[serde(default)]
        title: Option<String>,
        #[serde(default)]
        description: Option<String>,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct NoteEmbedDescriptor {
    pub shape: EmbedShape,
    #[serde(default)]
    pub description_source: Option<EmbedDescriptionSource>,
    pub primary_action: EmbedAction,
    #[serde(default)]
    pub secondary_action: Option<EmbedAction>,
}

impl NoteEmbedDescriptor {
    fn link(path: &str, title: impl Into<String>, description: Option<String>) -> Self {
        Self {
            shape: EmbedShape::Link {
                title: title.into(),
                description,
            },
            description_source: None,
            primary_action: EmbedAction {
                target: EmbedActionTarget::Note,
                path: Some(path.to_string()),
                url: None,
            },
            secondary_action: None,
        }
    }
}

pub struct NoteEmbedDescriptorInput<'a> {
    pub path: &'a str,
    pub title: &'a str,
    pub content: &'a str,
    pub metadata: &'a NoteTypeMetadata,
    pub media: Option<&'a NoteMediaData>,
}

pub trait NoteTypePlugin: Send + Sync {
    fn plugin_id(&self) -> Option<&'static str> {
        None
    }
    fn display_name(&self) -> Option<&'static str> {
        None
    }
    fn description(&self) -> Option<&'static str> {
        None
    }
    fn note_type(&self) -> NoteTypeId;
    fn matches_path(&self, path: &Path, extension: &str) -> bool;
    fn badge_for_extension(&self, extension: &str) -> Option<String>;
    fn media_for_path(&self, path: &Path) -> Option<NoteMediaData>;
    fn available_modes(&self) -> NoteModeAvailability;
    fn build_embed_descriptor(&self, input: &NoteEmbedDescriptorInput<'_>) -> NoteEmbedDescriptor;
}

struct MarkdownNoteTypePlugin;

impl NoteTypePlugin for MarkdownNoteTypePlugin {
    fn note_type(&self) -> NoteTypeId {
        NoteTypeId::Markdown
    }

    fn matches_path(&self, path: &Path, extension: &str) -> bool {
        if path
            .file_name()
            .and_then(|value| value.to_str())
            .map(|value| value.to_ascii_lowercase().ends_with(".youtube.md"))
            .unwrap_or(false)
        {
            return false;
        }
        extension.eq_ignore_ascii_case("md")
    }

    fn badge_for_extension(&self, _extension: &str) -> Option<String> {
        None
    }

    fn media_for_path(&self, _path: &Path) -> Option<NoteMediaData> {
        None
    }

    fn available_modes(&self) -> NoteModeAvailability {
        NoteModeAvailability {
            meta: true,
            source: true,
            edit: true,
            view: true,
        }
    }

    fn build_embed_descriptor(&self, input: &NoteEmbedDescriptorInput<'_>) -> NoteEmbedDescriptor {
        NoteEmbedDescriptor {
            shape: EmbedShape::Link {
                title: input.title.to_string(),
                description: extract_description_from_markdown_frontmatter(input.content),
            },
            description_source: Some(EmbedDescriptionSource::PluginDefined),
            primary_action: EmbedAction {
                target: EmbedActionTarget::Note,
                path: Some(input.path.to_string()),
                url: None,
            },
            secondary_action: None,
        }
    }
}

struct YouTubeNoteTypePlugin;

impl NoteTypePlugin for YouTubeNoteTypePlugin {
    fn plugin_id(&self) -> Option<&'static str> {
        Some("youtube")
    }

    fn display_name(&self) -> Option<&'static str> {
        Some("YouTube")
    }

    fn description(&self) -> Option<&'static str> {
        Some("Render and import YouTube video notes with transcript-backed markdown.")
    }

    fn note_type(&self) -> NoteTypeId {
        NoteTypeId::YouTube
    }

    fn matches_path(&self, path: &Path, extension: &str) -> bool {
        extension.eq_ignore_ascii_case("md")
            && path
                .file_name()
                .and_then(|value| value.to_str())
                .map(|value| value.to_ascii_lowercase().ends_with(".youtube.md"))
                .unwrap_or(false)
    }

    fn badge_for_extension(&self, _extension: &str) -> Option<String> {
        Some("YT".to_string())
    }

    fn media_for_path(&self, _path: &Path) -> Option<NoteMediaData> {
        None
    }

    fn available_modes(&self) -> NoteModeAvailability {
        NoteModeAvailability {
            meta: true,
            source: true,
            edit: true,
            view: true,
        }
    }

    fn build_embed_descriptor(&self, input: &NoteEmbedDescriptorInput<'_>) -> NoteEmbedDescriptor {
        let extra = &input.metadata.extra;
        let description = extract_description_from_markdown_frontmatter(input.content);
        let title = extra
            .get("youtube_title")
            .and_then(serde_json::Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .unwrap_or(input.title);
        let thumbnail = extra
            .get("youtube_thumbnail_url")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default();

        NoteEmbedDescriptor {
            shape: EmbedShape::Image {
                src: thumbnail.to_string(),
                alt: Some(title.to_string()),
                title: Some(title.to_string()),
                description,
            },
            description_source: Some(EmbedDescriptionSource::PluginDefined),
            primary_action: EmbedAction {
                target: EmbedActionTarget::External,
                path: None,
                url: extra
                    .get("youtube_url")
                    .and_then(serde_json::Value::as_str)
                    .map(str::to_string),
            },
            secondary_action: Some(EmbedAction {
                target: EmbedActionTarget::Note,
                path: Some(input.path.to_string()),
                url: None,
            }),
        }
    }
}

struct ImageNoteTypePlugin;

impl ImageNoteTypePlugin {
    fn mime_for_extension(extension: &str) -> Option<&'static str> {
        match extension.to_ascii_lowercase().as_str() {
            "png" => Some("image/png"),
            "jpg" | "jpeg" => Some("image/jpeg"),
            "gif" => Some("image/gif"),
            "webp" => Some("image/webp"),
            "bmp" => Some("image/bmp"),
            "svg" => Some("image/svg+xml"),
            "tif" | "tiff" => Some("image/tiff"),
            _ => None,
        }
    }
}

impl NoteTypePlugin for ImageNoteTypePlugin {
    fn plugin_id(&self) -> Option<&'static str> {
        Some("image")
    }

    fn display_name(&self) -> Option<&'static str> {
        Some("Image")
    }

    fn description(&self) -> Option<&'static str> {
        Some("Render image files as native viewable notes.")
    }

    fn note_type(&self) -> NoteTypeId {
        NoteTypeId::Image
    }

    fn matches_path(&self, _path: &Path, extension: &str) -> bool {
        Self::mime_for_extension(extension).is_some()
    }

    fn badge_for_extension(&self, extension: &str) -> Option<String> {
        let uppercase = extension.to_ascii_uppercase();
        Some(uppercase.chars().take(4).collect())
    }

    fn media_for_path(&self, path: &Path) -> Option<NoteMediaData> {
        let extension = path.extension()?.to_str()?;
        let mime_type = Self::mime_for_extension(extension)?;
        Some(NoteMediaData {
            mime_type: mime_type.to_string(),
            file_path: path.to_string_lossy().to_string(),
        })
    }

    fn available_modes(&self) -> NoteModeAvailability {
        NoteModeAvailability {
            meta: true,
            source: false,
            edit: false,
            view: true,
        }
    }

    fn build_embed_descriptor(&self, input: &NoteEmbedDescriptorInput<'_>) -> NoteEmbedDescriptor {
        NoteEmbedDescriptor {
            shape: EmbedShape::Image {
                src: input
                    .media
                    .map(|media| media.file_path.clone())
                    .unwrap_or_default(),
                alt: Some(input.title.to_string()),
                title: Some(input.title.to_string()),
                description: None,
            },
            description_source: None,
            primary_action: EmbedAction {
                target: EmbedActionTarget::Note,
                path: Some(input.path.to_string()),
                url: None,
            },
            secondary_action: None,
        }
    }
}

struct PdfNoteTypePlugin;

impl NoteTypePlugin for PdfNoteTypePlugin {
    fn plugin_id(&self) -> Option<&'static str> {
        Some("pdf")
    }

    fn display_name(&self) -> Option<&'static str> {
        Some("PDF")
    }

    fn description(&self) -> Option<&'static str> {
        Some("Render PDF files as view-only notes.")
    }

    fn note_type(&self) -> NoteTypeId {
        NoteTypeId::Pdf
    }

    fn matches_path(&self, _path: &Path, extension: &str) -> bool {
        extension.eq_ignore_ascii_case("pdf")
    }

    fn badge_for_extension(&self, _extension: &str) -> Option<String> {
        Some("PDF".to_string())
    }

    fn media_for_path(&self, path: &Path) -> Option<NoteMediaData> {
        Some(NoteMediaData {
            mime_type: "application/pdf".to_string(),
            file_path: path.to_string_lossy().to_string(),
        })
    }

    fn available_modes(&self) -> NoteModeAvailability {
        NoteModeAvailability {
            meta: false,
            source: false,
            edit: false,
            view: true,
        }
    }

    fn build_embed_descriptor(&self, input: &NoteEmbedDescriptorInput<'_>) -> NoteEmbedDescriptor {
        NoteEmbedDescriptor {
            shape: EmbedShape::Link {
                title: input.title.to_string(),
                description: None,
            },
            description_source: Some(EmbedDescriptionSource::PluginDefined),
            primary_action: EmbedAction {
                target: EmbedActionTarget::Note,
                path: Some(input.path.to_string()),
                url: None,
            },
            secondary_action: None,
        }
    }
}

fn extract_description_from_markdown_frontmatter(markdown: &str) -> Option<String> {
    let body = markdown.strip_prefix("---\n")?;
    let closing = body.find("\n---\n")?;
    let frontmatter = &body[..closing];

    let lines: Vec<&str> = frontmatter.lines().collect();
    let mut index = 0usize;

    while index < lines.len() {
        let trimmed = lines[index].trim();
        let Some((key, value)) = trimmed.split_once(':') else {
            index += 1;
            continue;
        };
        if key.trim() != "description" {
            index += 1;
            continue;
        }

        let raw_value = value.trim();
        if raw_value == "|" || raw_value == "|-" || raw_value == ">" || raw_value == ">-" {
            index += 1;
            let mut block_lines: Vec<String> = Vec::new();

            while index < lines.len() {
                let candidate = lines[index];
                if candidate.starts_with(' ') || candidate.starts_with('\t') {
                    block_lines.push(candidate.trim().to_string());
                    index += 1;
                    continue;
                }
                break;
            }

            let normalized = block_lines.join("\n").trim().to_string();
            if normalized.is_empty() {
                return None;
            }
            return Some(normalized);
        }

        let normalized = raw_value.trim_matches('"').trim_matches('\'').trim();
        if normalized.is_empty() {
            return None;
        }
        return Some(normalized.to_string());
    }

    None
}

pub struct NoteTypeRegistry {
    plugins: Vec<Box<dyn NoteTypePlugin>>,
}

impl Default for NoteTypeRegistry {
    fn default() -> Self {
        Self {
            plugins: vec![
                Box::new(YouTubeNoteTypePlugin),
                Box::new(MarkdownNoteTypePlugin),
                Box::new(PdfNoteTypePlugin),
                Box::new(ImageNoteTypePlugin),
            ],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuiltInNoteTypePluginInfo {
    pub name: String,
    pub display_name: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolvedNoteType {
    pub note_type: NoteTypeId,
    pub type_badge: Option<String>,
    pub is_known: bool,
    pub available_modes: NoteModeAvailability,
    pub media: Option<NoteMediaData>,
    pub metadata: NoteTypeMetadata,
}

impl NoteTypeRegistry {
    pub fn from_plugin_settings(
        plugins_enabled: bool,
        plugin_overrides: &BTreeMap<String, bool>,
    ) -> Self {
        let is_enabled = |plugin_id: &str| -> bool {
            plugins_enabled && plugin_overrides.get(plugin_id).copied().unwrap_or(true)
        };

        let mut plugins: Vec<Box<dyn NoteTypePlugin>> = vec![Box::new(MarkdownNoteTypePlugin)];
        if is_enabled("youtube") {
            plugins.insert(0, Box::new(YouTubeNoteTypePlugin));
        }
        if is_enabled("pdf") {
            plugins.push(Box::new(PdfNoteTypePlugin));
        }
        if is_enabled("image") {
            plugins.push(Box::new(ImageNoteTypePlugin));
        }

        Self { plugins }
    }

    pub fn built_in_plugins() -> Vec<BuiltInNoteTypePluginInfo> {
        vec![
            BuiltInNoteTypePluginInfo {
                name: "image".to_string(),
                display_name: "Image".to_string(),
                description: "Render image files as native viewable notes.".to_string(),
            },
            BuiltInNoteTypePluginInfo {
                name: "pdf".to_string(),
                display_name: "PDF".to_string(),
                description: "Render PDF files as view-only notes.".to_string(),
            },
            BuiltInNoteTypePluginInfo {
                name: "youtube".to_string(),
                display_name: "YouTube".to_string(),
                description: "Render and import YouTube video notes with transcript-backed markdown."
                    .to_string(),
            },
        ]
    }

    pub fn resolve_path(&self, path: &Path) -> ResolvedNoteType {
        let extension = path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();

        for plugin in &self.plugins {
            if plugin.matches_path(path, &extension) {
                return ResolvedNoteType {
                    note_type: plugin.note_type(),
                    type_badge: plugin.badge_for_extension(&extension),
                    is_known: true,
                    available_modes: plugin.available_modes(),
                    media: plugin.media_for_path(path),
                    metadata: NoteTypeMetadata::default(),
                };
            }
        }

        let badge = if extension.is_empty() {
            Some("FILE".to_string())
        } else {
            Some(extension.to_ascii_uppercase().chars().take(4).collect())
        };

        ResolvedNoteType {
            note_type: NoteTypeId::Unknown,
            type_badge: badge,
            is_known: false,
            available_modes: NoteModeAvailability {
                meta: false,
                source: false,
                edit: false,
                view: true,
            },
            media: None,
            metadata: NoteTypeMetadata::default(),
        }
    }

    pub fn build_embed_descriptor(
        &self,
        path: &Path,
        input: &NoteEmbedDescriptorInput<'_>,
    ) -> NoteEmbedDescriptor {
        let extension = path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();

        for plugin in &self.plugins {
            if plugin.matches_path(path, &extension) {
                return plugin.build_embed_descriptor(input);
            }
        }

        NoteEmbedDescriptor::link(input.path, input.title, None)
    }
}

pub fn note_type_has_text_content(note_type: NoteTypeId) -> bool {
    matches!(note_type, NoteTypeId::Markdown | NoteTypeId::YouTube)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn markdown_notes_expose_note_card_embed_contract() {
        let registry = NoteTypeRegistry::default();
        let resolved = registry.resolve_path(Path::new("docs/runtime-design.md"));
        let embed = registry.build_embed_descriptor(
            Path::new("docs/runtime-design.md"),
            &NoteEmbedDescriptorInput {
                path: "docs/runtime-design.md",
                title: "Runtime Design",
                content: "---\ndescription: Runtime overview\n---\n# Runtime Design\n",
                metadata: &resolved.metadata,
                media: resolved.media.as_ref(),
            },
        );

        assert_eq!(resolved.note_type, NoteTypeId::Markdown);
        assert_eq!(
            embed.shape,
            EmbedShape::Link {
                title: "Runtime Design".to_string(),
                description: Some("Runtime overview".to_string()),
            }
        );
        assert_eq!(embed.description_source, Some(EmbedDescriptionSource::PluginDefined));
        assert_eq!(embed.primary_action.target, EmbedActionTarget::Note);
    }

    #[test]
    fn youtube_notes_expose_thumbnail_embed_contract() {
        let registry = NoteTypeRegistry::default();
        let mut resolved = registry.resolve_path(Path::new("videos/demo.youtube.md"));
        resolved.metadata.extra.insert(
            "youtube_title".to_string(),
            serde_json::Value::String("Demo video".to_string()),
        );
        resolved.metadata.extra.insert(
            "youtube_thumbnail_url".to_string(),
            serde_json::Value::String("https://img.youtube.com/demo.jpg".to_string()),
        );
        let embed = registry.build_embed_descriptor(
            Path::new("videos/demo.youtube.md"),
            &NoteEmbedDescriptorInput {
                path: "videos/demo.youtube.md",
                title: "demo",
                content: "---\ndescription: Video summary\n---\n# Demo\n",
                metadata: &resolved.metadata,
                media: resolved.media.as_ref(),
            },
        );

        assert_eq!(resolved.note_type, NoteTypeId::YouTube);
        assert_eq!(
            embed.shape,
            EmbedShape::Image {
                src: "https://img.youtube.com/demo.jpg".to_string(),
                alt: Some("Demo video".to_string()),
                title: Some("Demo video".to_string()),
                description: Some("Video summary".to_string()),
            }
        );
        assert_eq!(embed.primary_action.target, EmbedActionTarget::External);
        assert_eq!(
            embed.secondary_action.as_ref().map(|action| action.target),
            Some(EmbedActionTarget::Note)
        );
    }

    #[test]
    fn image_notes_expose_image_embed_contract() {
        let registry = NoteTypeRegistry::default();
        let resolved = registry.resolve_path(Path::new("assets/photo.png"));
        let embed = registry.build_embed_descriptor(
            Path::new("assets/photo.png"),
            &NoteEmbedDescriptorInput {
                path: "assets/photo.png",
                title: "photo",
                content: "",
                metadata: &resolved.metadata,
                media: resolved.media.as_ref(),
            },
        );

        assert_eq!(resolved.note_type, NoteTypeId::Image);
        assert_eq!(
            embed.shape,
            EmbedShape::Image {
                src: "assets/photo.png".to_string(),
                alt: Some("photo".to_string()),
                title: Some("photo".to_string()),
                description: None,
            }
        );
        assert_eq!(embed.primary_action.target, EmbedActionTarget::Note);
    }

    #[test]
    fn pdf_notes_expose_pdf_summary_embed_contract() {
        let registry = NoteTypeRegistry::default();
        let resolved = registry.resolve_path(Path::new("papers/spec.pdf"));
        let embed = registry.build_embed_descriptor(
            Path::new("papers/spec.pdf"),
            &NoteEmbedDescriptorInput {
                path: "papers/spec.pdf",
                title: "Spec",
                content: "",
                metadata: &resolved.metadata,
                media: resolved.media.as_ref(),
            },
        );

        assert_eq!(resolved.note_type, NoteTypeId::Pdf);
        assert_eq!(
            embed.shape,
            EmbedShape::Link {
                title: "Spec".to_string(),
                description: None,
            }
        );
        assert_eq!(embed.description_source, Some(EmbedDescriptionSource::PluginDefined));
    }

    #[test]
    fn unknown_files_fall_back_to_link_only_embed_contract() {
        let registry = NoteTypeRegistry::default();
        let resolved = registry.resolve_path(Path::new("archive/data.bin"));
        let embed = registry.build_embed_descriptor(
            Path::new("archive/data.bin"),
            &NoteEmbedDescriptorInput {
                path: "archive/data.bin",
                title: "data.bin",
                content: "",
                metadata: &resolved.metadata,
                media: resolved.media.as_ref(),
            },
        );

        assert_eq!(resolved.note_type, NoteTypeId::Unknown);
        assert_eq!(
            embed.shape,
            EmbedShape::Link {
                title: "data.bin".to_string(),
                description: None,
            }
        );
        assert_eq!(embed.secondary_action, None);
    }

    #[test]
    fn markdown_description_extracts_yaml_block_scalars() {
        let description = extract_description_from_markdown_frontmatter(
            "---\ndescription: |-\n  First line.\n  Second line.\nother: value\n---\n# Title\n"
        );

        assert_eq!(description, Some("First line.\nSecond line.".to_string()));
    }
}
