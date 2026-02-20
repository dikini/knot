// SPEC: COMP-EDITOR-READING-001 FR-4
export function getEditorMeasureBand(contentWidth: number): 45 | 54 | 62 | 70 {
  if (contentWidth < 760) return 45;
  if (contentWidth < 840) return 54;
  if (contentWidth < 1080) return 62;
  return 70;
}
