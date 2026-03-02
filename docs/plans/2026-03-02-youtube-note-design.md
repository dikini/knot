# YouTube Note Type Design

Date: `2026-03-02`
Scope: `component`
Related spec: `docs/specs/component/youtube-note-type-015.md`

## Goal

Add a new app-level note type for YouTube videos that creates a markdown-backed note from a YouTube URL or external URL drag-drop. The note stores YouTube metadata in frontmatter, uses the transcript as the main editable markdown body, shows an embedded player at the top in view mode, and shows a thumbnail card instead of the player in edit mode.

## Chosen Approach

Use a markdown-backed note with a dedicated file suffix, `.youtube.md`, plus frontmatter metadata and transcript body content.

Why this approach:
- it fits the existing note model, search indexing, and editor flows
- it avoids scanning all markdown files to infer note type from content
- it keeps the explorer and backend note-type registry path-based and cheap
- it preserves full source/edit/view support while still allowing specialized rendering

## Note Model

YouTube notes are regular files ending in `.youtube.md`.

Frontmatter stores:
- `description`: YouTube video description
- `youtube_url`
- `youtube_video_id`
- `youtube_embed_url`
- `youtube_thumbnail_url`
- `youtube_title`
- `youtube_transcript_language`
- `youtube_transcript_source`

The markdown body starts with `# <video title>` followed by transcript text. That keeps the note title stable and searchable while preserving the transcript as normal editable content.

## Import Flow

Creation starts from either:
- a dedicated sidebar action that prompts for a YouTube URL
- external drag-drop of a YouTube URL onto the explorer root, a folder row, or a note row

Backend import flow:
1. Normalize and validate the YouTube URL.
2. Extract the video ID.
3. Fetch the watch page HTML.
4. Extract player metadata and caption track information from the embedded player response JSON.
5. Select a preferred transcript track.
6. Fetch captions XML and flatten it into transcript markdown text.
7. Generate note content and a unique `<slug>.youtube.md` path under the requested folder.
8. Save and return the created note.

No video bytes are downloaded locally.

## Rendering

Explorer:
- YouTube notes render as known notes with a `YT` badge.

Editor modes:
- `meta`: existing metadata editor, with YouTube-specific keys in extra YAML
- `source`: raw markdown/frontmatter
- `edit`: normal editor plus a thumbnail header card
- `view`: rendered markdown plus embedded YouTube iframe at the top

The player is never mounted in edit mode.

## Error Handling

Creation fails with a typed error when:
- the URL is not a supported YouTube URL
- the video page cannot be read
- no caption track is available
- transcript fetch fails

The first revision does not create transcript-less YouTube notes.

## Dependencies

Backend adds:
- `reqwest` for HTTP fetching
- `quick-xml` for caption XML parsing

No YouTube API key, no local video download, and no external CLI dependency.

## Testing

Targeted coverage:
- backend URL parsing, filename generation, caption XML parsing, and note content generation
- note-type resolution for `.youtube.md`
- sidebar action and drag-drop creation flows
- editor rendering for player in view mode and thumbnail in edit mode
