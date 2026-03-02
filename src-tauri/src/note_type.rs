use serde::{Deserialize, Serialize};
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

pub trait NoteTypePlugin: Send + Sync {
    fn note_type(&self) -> NoteTypeId;
    fn matches_path(&self, path: &Path, extension: &str) -> bool;
    fn badge_for_extension(&self, extension: &str) -> Option<String>;
    fn media_for_path(&self, path: &Path) -> Option<NoteMediaData>;
    fn available_modes(&self) -> NoteModeAvailability;
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
}

struct YouTubeNoteTypePlugin;

impl NoteTypePlugin for YouTubeNoteTypePlugin {
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
}

struct PdfNoteTypePlugin;

impl NoteTypePlugin for PdfNoteTypePlugin {
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
pub struct ResolvedNoteType {
    pub note_type: NoteTypeId,
    pub type_badge: Option<String>,
    pub is_known: bool,
    pub available_modes: NoteModeAvailability,
    pub media: Option<NoteMediaData>,
    pub metadata: NoteTypeMetadata,
}

impl NoteTypeRegistry {
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
}

pub fn note_type_has_text_content(note_type: NoteTypeId) -> bool {
    matches!(note_type, NoteTypeId::Markdown | NoteTypeId::YouTube)
}
