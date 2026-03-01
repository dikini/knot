import { describe, expect, it } from "vitest";
import {
  parseNoteDocument,
  serializeNoteDocument,
  type NoteMetadataDraft,
} from "./frontmatter";

describe("frontmatter utilities", () => {
  it("splits yaml front matter from the markdown body", () => {
    const parsed = parseNoteDocument([
      "---",
      "description: Sample note",
      "author: Ada Lovelace",
      "custom_flag: true",
      "---",
      "# Heading",
      "",
      "Body text",
    ].join("\n"));

    expect(parsed.body).toBe("# Heading\n\nBody text");
    expect(parsed.managed.description).toBe("Sample note");
    expect(parsed.managed.author).toBe("Ada Lovelace");
    expect(parsed.extra).toContain("custom_flag: true");
  });

  it("preserves unknown keys while serializing managed metadata changes", () => {
    const parsed = parseNoteDocument([
      "---",
      "description: Old",
      "legacy_key: keep-me",
      "---",
      "Body",
    ].join("\n"));

    const updated: NoteMetadataDraft = {
      ...parsed.managed,
      description: "New description",
      author: "Grace Hopper",
      email: "grace@example.com",
      version: "1.2.0",
      tagsText: "docs, release",
    };

    const serialized = serializeNoteDocument({
      body: parsed.body,
      managed: updated,
      extraYaml: parsed.extra,
    });

    expect(serialized).toContain("legacy_key: keep-me");
    expect(serialized).toContain("description: New description");
    expect(serialized).toContain("author: Grace Hopper");
    expect(serialized).toContain("email: grace@example.com");
    expect(serialized).toContain("version: 1.2.0");
    expect(serialized).toContain("- docs");
    expect(serialized).toContain("- release");
    expect(serialized.trimEnd().endsWith("Body")).toBe(true);
  });

  it("rejects invalid extra yaml and duplicate managed keys", () => {
    expect(() =>
      serializeNoteDocument({
        body: "# Test",
        managed: {
          description: "",
          author: "",
          email: "",
          version: "",
          tagsText: "",
        },
        extraYaml: "description: override",
      })
    ).toThrow(/managed metadata keys/i);

    expect(() =>
      serializeNoteDocument({
        body: "# Test",
        managed: {
          description: "",
          author: "",
          email: "",
          version: "",
          tagsText: "",
        },
        extraYaml: "invalid: [",
      })
    ).toThrow(/valid yaml mapping/i);
  });
});
