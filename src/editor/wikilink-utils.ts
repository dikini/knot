import type { NoteSummary } from "../types/vault";

export interface WikilinkSuggestion {
  target: string;
  label: string;
  path: string;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function basename(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const segment = normalized.split("/").at(-1) ?? normalized;
  return segment;
}

function basenameWithoutExt(path: string): string {
  const name = basename(path);
  return name.endsWith(".md") ? name.slice(0, -3) : name;
}

function noteCandidates(note: NoteSummary): string[] {
  return [
    note.title,
    note.path,
    basename(note.path),
    basenameWithoutExt(note.path),
  ].filter((candidate): candidate is string => candidate.trim().length > 0);
}

export function resolveWikilinkTargetPath(noteList: NoteSummary[], target: string): string | null {
  const wanted = normalize(target);
  if (!wanted) return null;

  for (const note of noteList) {
    for (const candidate of noteCandidates(note)) {
      if (normalize(candidate) === wanted) {
        return note.path;
      }
    }
  }

  return null;
}

export function getWikilinkSuggestions(
  noteList: NoteSummary[],
  query: string,
  limit: number = 5
): { items: WikilinkSuggestion[]; hasMore: boolean } {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length < 3) {
    return { items: [], hasMore: false };
  }

  const scored = noteList
    .map((note) => {
      const title = note.title?.trim() || basenameWithoutExt(note.path);
      const normalizedTitle = normalize(title);
      const normalizedPath = normalize(note.path);

      let score = 0;
      if (normalizedTitle.startsWith(normalizedQuery)) score += 4;
      else if (normalizedTitle.includes(normalizedQuery)) score += 2;

      if (normalizedPath.startsWith(normalizedQuery)) score += 2;
      else if (normalizedPath.includes(normalizedQuery)) score += 1;

      return {
        note,
        title,
        score,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  const items = scored.slice(0, limit).map((entry) => ({
    target: entry.title,
    label: entry.title,
    path: entry.note.path,
  }));

  return {
    items,
    hasMore: scored.length > limit,
  };
}

export function notePathFromWikilinkTarget(target: string): string {
  const trimmed = target.trim();
  if (!trimmed) {
    return "Untitled.md";
  }

  return trimmed.endsWith(".md") ? trimmed : `${trimmed}.md`;
}

export function buildKnownWikilinkTargets(noteList: NoteSummary[]): Set<string> {
  const known = new Set<string>();
  for (const note of noteList) {
    for (const candidate of noteCandidates(note)) {
      known.add(normalize(candidate));
    }
  }
  return known;
}

export function isKnownWikilinkTarget(target: string, knownTargets: Set<string>): boolean {
  return knownTargets.has(normalize(target));
}
