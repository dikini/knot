import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

const FRONTMATTER_DELIMITER = "---";
const MANAGED_METADATA_KEYS = new Set(["description", "author", "email", "tags", "version"]);

export interface NoteMetadataDraft {
  description: string;
  author: string;
  email: string;
  version: string;
  tagsText: string;
}

export interface ParsedNoteDocument {
  body: string;
  managed: NoteMetadataDraft;
  extra: string;
  hasFrontmatter: boolean;
}

type YamlMapping = Record<string, unknown>;

function isYamlMapping(value: unknown): value is YamlMapping {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeTagsText(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .join(", ");
  }

  if (typeof value === "string") {
    return value;
  }

  return "";
}

function extractFrontmatter(markdown: string): { frontmatter: string | null; body: string } {
  if (!markdown.startsWith(`${FRONTMATTER_DELIMITER}\n`)) {
    return { frontmatter: null, body: markdown };
  }

  const closingIndex = markdown.indexOf(`\n${FRONTMATTER_DELIMITER}\n`, FRONTMATTER_DELIMITER.length + 1);
  if (closingIndex < 0) {
    return { frontmatter: null, body: markdown };
  }

  const frontmatter = markdown.slice(FRONTMATTER_DELIMITER.length + 1, closingIndex);
  const body = markdown.slice(closingIndex + (`\n${FRONTMATTER_DELIMITER}\n`).length);
  return { frontmatter, body };
}

function parseYamlMapping(source: string, context: "front matter" | "extra metadata"): YamlMapping {
  if (!source.trim()) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(source);
  } catch {
    throw new Error(`${context} must be a valid YAML mapping`);
  }
  if (!isYamlMapping(parsed)) {
    throw new Error(`${context} must be a valid YAML mapping`);
  }
  return parsed;
}

function buildManagedDraft(mapping: YamlMapping): NoteMetadataDraft {
  return {
    description: normalizeString(mapping.description),
    author: normalizeString(mapping.author),
    email: normalizeString(mapping.email),
    version: normalizeString(mapping.version),
    tagsText: normalizeTagsText(mapping.tags),
  };
}

function buildExtraMapping(mapping: YamlMapping): YamlMapping {
  const extraEntries = Object.entries(mapping).filter(([key]) => !MANAGED_METADATA_KEYS.has(key));
  return Object.fromEntries(extraEntries);
}

function stringifyYamlMapping(mapping: YamlMapping): string {
  const serialized = stringifyYaml(mapping, {
    indent: 2,
    lineWidth: 0,
  });
  return serialized.trim();
}

function normalizeManagedMapping(managed: NoteMetadataDraft): YamlMapping {
  const mapping: YamlMapping = {};

  if (managed.description.trim()) {
    mapping.description = managed.description.trim();
  }
  if (managed.author.trim()) {
    mapping.author = managed.author.trim();
  }
  if (managed.email.trim()) {
    mapping.email = managed.email.trim();
  }
  if (managed.version.trim()) {
    mapping.version = managed.version.trim();
  }

  const tags = managed.tagsText
    .split(/[\n,]/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  if (tags.length > 0) {
    mapping.tags = tags;
  }

  return mapping;
}

export function emptyMetadataDraft(): NoteMetadataDraft {
  return {
    description: "",
    author: "",
    email: "",
    version: "",
    tagsText: "",
  };
}

export function parseNoteDocument(markdown: string): ParsedNoteDocument {
  const { frontmatter, body } = extractFrontmatter(markdown);
  const mapping = frontmatter ? parseYamlMapping(frontmatter, "front matter") : {};
  const extraMapping = buildExtraMapping(mapping);

  return {
    body,
    managed: buildManagedDraft(mapping),
    extra: stringifyYamlMapping(extraMapping),
    hasFrontmatter: frontmatter !== null,
  };
}

export function serializeNoteDocument(input: {
  body: string;
  managed: NoteMetadataDraft;
  extraYaml: string;
}): string {
  const extraMapping = parseYamlMapping(input.extraYaml, "extra metadata");

  for (const key of Object.keys(extraMapping)) {
    if (MANAGED_METADATA_KEYS.has(key)) {
      throw new Error("Extra metadata must not redefine managed metadata keys");
    }
  }

  const frontmatter = {
    ...normalizeManagedMapping(input.managed),
    ...extraMapping,
  };

  const trimmedBody = input.body.replace(/^\n+/, "");
  if (Object.keys(frontmatter).length === 0) {
    return trimmedBody;
  }

  return [
    FRONTMATTER_DELIMITER,
    stringifyYamlMapping(frontmatter),
    FRONTMATTER_DELIMITER,
    trimmedBody,
  ]
    .filter((segment, index, all) => !(index === all.length - 1 && segment.length === 0))
    .join("\n");
}

export function validateExtraMetadataYaml(extraYaml: string): string | null {
  try {
    const mapping = parseYamlMapping(extraYaml, "extra metadata");
    for (const key of Object.keys(mapping)) {
      if (MANAGED_METADATA_KEYS.has(key)) {
        return "Extra metadata must not redefine managed metadata keys";
      }
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Extra metadata must be a valid YAML mapping";
  }
}
