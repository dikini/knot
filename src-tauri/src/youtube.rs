use quick_xml::escape::unescape;
use quick_xml::events::Event;
use quick_xml::Reader;
use reqwest::blocking::Client;
use reqwest::Url;
use serde_json::Value;

const INNERTUBE_ANDROID_CONTEXT: &str =
    r#"{"client":{"clientName":"ANDROID","clientVersion":"20.10.38"}}"#;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedYouTubeUrl {
    pub video_id: String,
    pub watch_url: String,
    pub embed_url: String,
    pub thumbnail_url: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct YouTubeImportResult {
    pub title: String,
    pub description: String,
    pub transcript: String,
    pub transcript_language: String,
    pub transcript_source: String,
    pub parsed_url: ParsedYouTubeUrl,
}

pub fn normalize_youtube_url(input: &str) -> Result<ParsedYouTubeUrl, String> {
    let url = Url::parse(input.trim()).map_err(|_| "Invalid YouTube URL".to_string())?;
    let host = url
        .host_str()
        .map(|value| value.to_ascii_lowercase())
        .ok_or_else(|| "Invalid YouTube URL".to_string())?;

    let video_id = match host.as_str() {
        "youtu.be" | "www.youtu.be" => url
            .path_segments()
            .and_then(|mut segments| segments.next())
            .filter(|segment| !segment.is_empty())
            .map(str::to_string),
        "youtube.com" | "www.youtube.com" | "m.youtube.com" => {
            if let Some(id) = url
                .query_pairs()
                .find_map(|(key, value)| (key == "v").then(|| value.to_string()))
            {
                Some(id)
            } else {
                let segments = url.path().trim_matches('/').split('/').collect::<Vec<_>>();
                match segments.as_slice() {
                    ["shorts", id] | ["embed", id] | ["live", id] => Some((*id).to_string()),
                    _ => None,
                }
            }
        }
        _ => None,
    }
    .filter(|value| is_valid_video_id(value))
    .ok_or_else(|| "Unsupported YouTube URL".to_string())?;

    Ok(ParsedYouTubeUrl {
        watch_url: format!("https://www.youtube.com/watch?v={video_id}"),
        embed_url: format!("https://www.youtube.com/embed/{video_id}"),
        thumbnail_url: format!("https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"),
        video_id,
    })
}

pub fn parse_transcript_xml(xml: &str) -> Result<String, String> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);
    let mut transcript_parts = Vec::new();

    loop {
        match reader.read_event() {
            Ok(Event::Start(event)) if event.name().as_ref() == b"text" => {
                let decoded = reader
                    .read_text(event.name())
                    .map_err(|err| format!("Invalid transcript XML: {err}"))?;
                let unescaped = unescape(&decoded).map_err(|err| err.to_string())?;
                let normalized = unescaped.replace('\n', " ").trim().to_string();
                if !normalized.is_empty() {
                    transcript_parts.push(normalized);
                }
            }
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(err) => return Err(format!("Invalid transcript XML: {err}")),
        }
    }

    if transcript_parts.is_empty() {
        return Err("No transcript text found".to_string());
    }

    Ok(transcript_parts.join("\n\n"))
}

pub fn build_youtube_note_markdown(
    title: &str,
    description: &str,
    watch_url: &str,
    video_id: &str,
    embed_url: &str,
    thumbnail_url: &str,
    transcript_language: &str,
    transcript_source: &str,
    transcript: &str,
) -> String {
    let normalized_title = normalize_heading_text(title);
    let mut frontmatter = vec![
        "---".to_string(),
        format!("description: {}", yaml_block_scalar(description)),
        format!("youtube_url: {}", yaml_scalar(watch_url)),
        format!("youtube_video_id: {}", yaml_scalar(video_id)),
        format!("youtube_embed_url: {}", yaml_scalar(embed_url)),
        format!("youtube_thumbnail_url: {}", yaml_scalar(thumbnail_url)),
        format!(
            "youtube_title: {}",
            yaml_scalar(title.trim().if_empty_then(&normalized_title))
        ),
        format!(
            "youtube_transcript_language: {}",
            yaml_scalar(transcript_language.trim())
        ),
        format!(
            "youtube_transcript_source: {}",
            yaml_scalar(transcript_source.trim())
        ),
        "---".to_string(),
        format!("# {normalized_title}"),
        String::new(),
        transcript.trim().to_string(),
    ];

    while frontmatter
        .last()
        .map(|line| line.is_empty())
        .unwrap_or(false)
    {
        frontmatter.pop();
    }

    frontmatter.join("\n")
}

pub fn extract_youtube_metadata(markdown: &str) -> serde_json::Map<String, serde_json::Value> {
    let Some(frontmatter) = extract_frontmatter(markdown) else {
        return serde_json::Map::new();
    };

    let mut extra = serde_json::Map::new();
    for line in frontmatter.lines() {
        let trimmed = line.trim();
        let Some((key, value)) = trimmed.split_once(':') else {
            continue;
        };
        if !key.starts_with("youtube_") {
            continue;
        }
        let normalized = value.trim().trim_matches('"').trim_matches('\'');
        if normalized.is_empty() {
            continue;
        }
        extra.insert(key.to_string(), Value::String(normalized.to_string()));
    }
    extra
}

pub fn import_youtube_note(url: &str) -> Result<YouTubeImportResult, String> {
    let parsed_url = normalize_youtube_url(url)?;
    let client = Client::builder()
        .user_agent("Mozilla/5.0 (X11; Linux x86_64) Knot/0.1")
        .build()
        .map_err(|err| format!("Failed to initialize HTTP client: {err}"))?;

    let watch_html = client
        .get(parsed_url.watch_url.clone())
        .send()
        .and_then(|response| response.error_for_status())
        .map_err(|err| format!("Failed to fetch YouTube video page: {err}"))?
        .text()
        .map_err(|err| format!("Failed to read YouTube video page: {err}"))?;

    let player_response_json =
        extract_json_object_after_marker(&watch_html, "ytInitialPlayerResponse = ")
            .or_else(|| {
                extract_json_object_after_marker(&watch_html, "var ytInitialPlayerResponse = ")
            })
            .ok_or_else(|| "Failed to locate YouTube player metadata".to_string())?;
    let player_response: Value = serde_json::from_str(&player_response_json)
        .map_err(|err| format!("Failed to parse YouTube player metadata: {err}"))?;
    let innertube_api_key = extract_innertube_api_key(&watch_html)
        .ok_or_else(|| "Failed to locate YouTube API key".to_string())?;

    let title = player_response
        .pointer("/videoDetails/title")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "YouTube video is missing a title".to_string())?
        .to_string();
    let description = player_response
        .pointer("/videoDetails/shortDescription")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();

    let transcript_player_response =
        fetch_transcript_player_response(&client, &innertube_api_key, &parsed_url.video_id)?;
    let tracks = transcript_player_response
        .pointer("/captions/playerCaptionsTracklistRenderer/captionTracks")
        .and_then(Value::as_array)
        .ok_or_else(|| "No transcript is available for this video".to_string())?;

    let selected_track = select_caption_track(tracks)
        .ok_or_else(|| "No usable transcript track is available for this video".to_string())?;
    let transcript_url = selected_track
        .get("baseUrl")
        .and_then(Value::as_str)
        .ok_or_else(|| "Transcript track is missing a transcript URL".to_string())?;
    let transcript_language = selected_track
        .get("languageCode")
        .and_then(Value::as_str)
        .unwrap_or("unknown")
        .to_string();
    let transcript_source = if selected_track.get("kind").and_then(Value::as_str) == Some("asr") {
        "auto"
    } else {
        "manual"
    }
    .to_string();

    let transcript_xml = client
        .get(transcript_url.replace("&fmt=srv3", ""))
        .send()
        .and_then(|response| response.error_for_status())
        .map_err(|err| format!("Failed to fetch YouTube transcript: {err}"))?
        .text()
        .map_err(|err| format!("Failed to read YouTube transcript: {err}"))?;
    let transcript = parse_transcript_xml(&transcript_xml)?;

    Ok(YouTubeImportResult {
        title,
        description,
        transcript,
        transcript_language,
        transcript_source,
        parsed_url,
    })
}

fn fetch_transcript_player_response(
    client: &Client,
    innertube_api_key: &str,
    video_id: &str,
) -> Result<Value, String> {
    let context: Value =
        serde_json::from_str(INNERTUBE_ANDROID_CONTEXT).map_err(|err| err.to_string())?;
    client
        .post(format!(
            "https://www.youtube.com/youtubei/v1/player?key={innertube_api_key}"
        ))
        .json(&serde_json::json!({
            "context": context,
            "videoId": video_id,
        }))
        .send()
        .and_then(|response| response.error_for_status())
        .map_err(|err| format!("Failed to fetch YouTube transcript metadata: {err}"))?
        .json()
        .map_err(|err| format!("Failed to decode YouTube transcript metadata: {err}"))
}

fn select_caption_track<'a>(tracks: &'a [Value]) -> Option<&'a Value> {
    tracks
        .iter()
        .find(|track| track.get("kind").and_then(Value::as_str) != Some("asr"))
        .or_else(|| tracks.first())
}

fn extract_frontmatter(markdown: &str) -> Option<&str> {
    if !markdown.starts_with("---\n") {
        return None;
    }
    let closing = markdown["---\n".len()..].find("\n---\n")?;
    let start = "---\n".len();
    let end = start + closing;
    Some(&markdown[start..end])
}

fn extract_json_object_after_marker(source: &str, marker: &str) -> Option<String> {
    let marker_index = source.find(marker)?;
    let remainder = &source[(marker_index + marker.len())..];
    let object_start = remainder.find('{')?;
    let json_source = &remainder[object_start..];
    let mut depth = 0usize;
    let mut in_string = false;
    let mut escaped = false;

    for (index, ch) in json_source.char_indices() {
        if in_string {
            if escaped {
                escaped = false;
            } else if ch == '\\' {
                escaped = true;
            } else if ch == '"' {
                in_string = false;
            }
            continue;
        }

        match ch {
            '"' => in_string = true,
            '{' => depth += 1,
            '}' => {
                depth = depth.saturating_sub(1);
                if depth == 0 {
                    return Some(json_source[..=index].to_string());
                }
            }
            _ => {}
        }
    }

    None
}

fn extract_innertube_api_key(source: &str) -> Option<String> {
    let marker = "\"INNERTUBE_API_KEY\":\"";
    let start = source.find(marker)? + marker.len();
    let rest = &source[start..];
    let end = rest.find('"')?;
    Some(rest[..end].to_string())
}

fn is_valid_video_id(value: &str) -> bool {
    value.len() == 11
        && value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_')
}

fn slugify(value: &str) -> String {
    let mut slug = String::new();
    let mut previous_was_dash = false;

    for ch in value.chars() {
        let lower = ch.to_ascii_lowercase();
        if lower.is_ascii_alphanumeric() {
            slug.push(lower);
            previous_was_dash = false;
        } else if !previous_was_dash && !slug.is_empty() {
            slug.push('-');
            previous_was_dash = true;
        }
    }

    slug.trim_matches('-').to_string()
}

pub fn build_youtube_note_path(
    base_folder_path: &str,
    title: &str,
    video_id: &str,
    exists: impl Fn(&str) -> bool,
) -> String {
    let folder = base_folder_path.trim_matches('/');
    let base_slug = slugify(title);
    let stem = if base_slug.is_empty() {
        format!("youtube-{video_id}")
    } else {
        base_slug
    };

    let mut attempt = 1usize;
    loop {
        let suffix = if attempt == 1 {
            String::new()
        } else {
            format!("-{attempt}")
        };
        let file_name = format!("{stem}{suffix}.youtube.md");
        let full_path = if folder.is_empty() {
            file_name
        } else {
            format!("{folder}/{file_name}")
        };
        if !exists(&full_path) {
            return full_path;
        }
        attempt += 1;
    }
}

fn normalize_heading_text(value: &str) -> String {
    value
        .trim()
        .replace('\n', " ")
        .trim()
        .to_string()
        .if_empty_then("YouTube Video")
        .to_string()
}

fn yaml_scalar(value: &str) -> String {
    let escaped = value.replace('\\', "\\\\").replace('"', "\\\"");
    format!("\"{escaped}\"")
}

fn yaml_block_scalar(value: &str) -> String {
    if value.trim().is_empty() {
        return "\"\"".to_string();
    }

    let mut output = String::from("|-\n");
    for line in value.lines() {
        output.push_str("  ");
        output.push_str(line);
        output.push('\n');
    }
    output.trim_end_matches('\n').to_string()
}

trait EmptyStringFallback {
    fn if_empty_then<'a>(&'a self, fallback: &'a str) -> &'a str;
}

impl EmptyStringFallback for str {
    fn if_empty_then<'a>(&'a self, fallback: &'a str) -> &'a str {
        if self.trim().is_empty() {
            fallback
        } else {
            self
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{build_youtube_note_markdown, normalize_youtube_url, parse_transcript_xml};

    #[test]
    fn normalize_youtube_url_extracts_video_id_from_watch_url() {
        let parsed = normalize_youtube_url("https://www.youtube.com/watch?v=abc123xyz00").unwrap();
        assert_eq!(parsed.video_id, "abc123xyz00");
        assert_eq!(
            parsed.watch_url,
            "https://www.youtube.com/watch?v=abc123xyz00"
        );
        assert_eq!(
            parsed.embed_url,
            "https://www.youtube.com/embed/abc123xyz00"
        );
        assert_eq!(
            parsed.thumbnail_url,
            "https://i.ytimg.com/vi/abc123xyz00/hqdefault.jpg"
        );
    }

    #[test]
    fn parse_transcript_xml_flattens_caption_text() {
        let transcript = parse_transcript_xml(
            r#"<?xml version="1.0" encoding="utf-8" ?><transcript><text start="0.0" dur="1.0">Hello &amp; welcome</text><text start="1.0" dur="1.0">Second line</text></transcript>"#,
        )
        .unwrap();

        assert_eq!(transcript, "Hello & welcome\n\nSecond line");
    }

    #[test]
    fn build_youtube_note_markdown_writes_frontmatter_and_transcript_body() {
        let markdown = build_youtube_note_markdown(
            "Sample Video",
            "A long description",
            "https://www.youtube.com/watch?v=abc123xyz00",
            "abc123xyz00",
            "https://www.youtube.com/embed/abc123xyz00",
            "https://i.ytimg.com/vi/abc123xyz00/hqdefault.jpg",
            "en",
            "manual",
            "Transcript body",
        );

        assert!(markdown.contains("youtube_url: \"https://www.youtube.com/watch?v=abc123xyz00\""));
        assert!(markdown.contains("youtube_video_id: \"abc123xyz00\""));
        assert!(markdown.contains("description: |-"));
        assert!(markdown.contains("# Sample Video"));
        assert!(markdown.ends_with("Transcript body"));
    }
}
