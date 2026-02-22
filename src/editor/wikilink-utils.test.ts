import { describe, expect, it } from "vitest";
import {
  buildKnownWikilinkTargets,
  getWikilinkSuggestions,
  isKnownWikilinkTarget,
  notePathFromWikilinkTarget,
  resolveWikilinkTargetPath,
} from "./wikilink-utils";

const notes = [
  {
    id: "1",
    path: "project-alpha.md",
    title: "Project Alpha",
    created_at: 0,
    modified_at: 0,
    word_count: 0,
  },
  {
    id: "2",
    path: "notes/architecture.md",
    title: "Architecture",
    created_at: 0,
    modified_at: 0,
    word_count: 0,
  },
] as const;

describe("wikilink utils", () => {
  it("resolves wikilink targets by title or path", () => {
    expect(resolveWikilinkTargetPath([...notes], "Project Alpha")).toBe("project-alpha.md");
    expect(resolveWikilinkTargetPath([...notes], "architecture")).toBe("notes/architecture.md");
    expect(resolveWikilinkTargetPath([...notes], "missing")).toBeNull();
  });

  it("returns top suggestions and hasMore flag", () => {
    const { items, hasMore } = getWikilinkSuggestions([...notes], "arc", 1);
    expect(items).toHaveLength(1);
    expect(items[0].target).toBe("Architecture");
    expect(hasMore).toBe(false);
  });

  it("creates note path from wikilink target", () => {
    expect(notePathFromWikilinkTarget("New Note")).toBe("New Note.md");
    expect(notePathFromWikilinkTarget("already.md")).toBe("already.md");
  });

  it("tracks known wikilink targets case-insensitively", () => {
    const known = buildKnownWikilinkTargets([...notes]);
    expect(isKnownWikilinkTarget("project alpha", known)).toBe(true);
    expect(isKnownWikilinkTarget("ARCHITECTURE", known)).toBe(true);
    expect(isKnownWikilinkTarget("not-there", known)).toBe(false);
  });
});
