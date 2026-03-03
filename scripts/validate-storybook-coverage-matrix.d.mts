export function fail(message: string): never;
export function parseUiSpecRows(markdown: string): Array<{
  specId: string;
  status: string;
}>;
export function parseGapSummary(markdown: string): {
  partialOrMissing: number;
  covered: number;
};
export function ensureUiQaDxCovered(markdown: string): void;
export function validateStorybookCoverageMatrix(): void;
