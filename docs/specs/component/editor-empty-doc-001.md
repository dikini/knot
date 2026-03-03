# Component Spec: Editor Empty Document Safety

Spec-ID: COMP-EDITOR-EMPTY-DOC-001
Change-Type: bug-fix
Status: implemented
Trace: BUG-editor-empty-doc
Date: 2026-02-20

## Purpose
Prevent editor crashes when opening notes with empty content.

## Functional Requirements
- FR-1: Markdown parsing MUST always produce a valid ProseMirror `doc` matching schema `block+`.
- FR-2: Empty input content MUST parse to a single empty paragraph node.
- FR-3: Regression tests MUST fail if empty input produces an invalid empty `doc`.

## Acceptance Criteria
- AC-1: Opening a note with empty content does not crash editor rendering.
- AC-2: `parseMarkdown("")` returns `doc(paragraph())`.
- AC-3: Targeted editor + markdown tests, typecheck, and lint pass.
