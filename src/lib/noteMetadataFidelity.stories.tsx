import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import type { NoteData } from "@/types/vault";

// Trace: DESIGN-storybook-note-metadata-coverage-2026-02-22
type NoteMetadataHarnessProps = {
  note: NoteData;
};

function NoteMetadataHarness({ note }: NoteMetadataHarnessProps) {
  return (
    <section style={{ padding: "1rem", display: "grid", gap: "1rem", maxWidth: 780 }}>
      <h3>{note.title}</h3>
      <div>
        <h4>Headings</h4>
        <ul aria-label="Heading metadata">
          {note.headings.map((heading) => (
            <li key={`${heading.level}-${heading.position}-${heading.text}`}>
              <strong>{heading.text}</strong> <span>(L{heading.level} at byte {heading.position})</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h4>Backlinks</h4>
        <ul aria-label="Backlink metadata">
          {note.backlinks.map((backlink) => (
            <li key={backlink.source_path}>
              <strong>{backlink.source_title}</strong> <span>{backlink.source_path}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const metadataNote: NoteData = {
  id: "meta-1",
  path: "notes/metadata-target.md",
  title: "Metadata Target",
  content: "# Top\n\nText\n## Child",
  created_at: 1_708_700_000,
  modified_at: 1_708_700_000,
  word_count: 4,
  headings: [
    { level: 1, text: "Top", position: 0 },
    { level: 2, text: "Child", position: 12 },
  ],
  backlinks: [
    {
      source_path: "projects/alpha.md",
      source_title: "Alpha",
      context: "Links to Metadata Target",
    },
    {
      source_path: "drafts/untitled-note.md",
      source_title: "untitled-note",
      context: "Fallback title when source note unavailable",
    },
  ],
};

const meta = {
  title: "Data/NoteMetadataFidelity",
  component: NoteMetadataHarness,
  args: {
    note: metadataNote,
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof NoteMetadataHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BacklinkTitlesAndHeadingOffsets: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Spec: COMP-NOTE-METADATA-001 FR-1/FR-2/FR-4. Shows resolved backlink source titles and deterministic heading byte offsets in returned note metadata.",
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("list", { name: "Heading metadata" })).toBeInTheDocument();
    await expect(canvas.getByText("Top")).toBeInTheDocument();
    await expect(canvas.getByText("(L1 at byte 0)")).toBeInTheDocument();
    await expect(canvas.getByText("(L2 at byte 12)")).toBeInTheDocument();
    await expect(canvas.getByRole("list", { name: "Backlink metadata" })).toBeInTheDocument();
    await expect(canvas.getByText("Alpha")).toBeInTheDocument();
    await expect(canvas.getByText("untitled-note")).toBeInTheDocument();
  },
};
