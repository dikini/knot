import type { Node as ProseMirrorNode } from "prosemirror-model";

export type MarkdownEngineName = "legacy" | "gfm";
export type MarkdownDiagnosticSeverity = "info" | "warning" | "error";

export interface ReferenceDefinition {
  id: string;
  href: string;
  title: string | null;
}

export interface MarkdownReferenceState {
  referenceDefinitions: Record<string, ReferenceDefinition>;
  referenceOrder: string[];
}

export interface MarkdownDiagnostic {
  code: string;
  engine: MarkdownEngineName;
  feature: string;
  message: string;
  severity: MarkdownDiagnosticSeverity;
}

export interface MarkdownEngineResult {
  engine: MarkdownEngineName;
  markdown: string;
  document: ProseMirrorNode | null;
  diagnostics: MarkdownDiagnostic[];
  syntaxTree?: unknown;
}

export interface MarkdownEngineComparison {
  legacy: MarkdownEngineResult;
  gfm: MarkdownEngineResult;
}

export function createMarkdownDiagnostic(
  engine: MarkdownEngineName,
  code: string,
  feature: string,
  message: string,
  severity: MarkdownDiagnosticSeverity = "warning"
): MarkdownDiagnostic {
  return { code, engine, feature, message, severity };
}
