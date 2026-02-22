import { expect, test, type Page } from "@playwright/test";
import { installMockTauriBridge } from "./mock-tauri-bridge";

async function openDemoNote(page: Page, content: string = "# Demo\n\nSeed text."): Promise<void> {
  const now = 1_700_000_100;
  const notePath = "demo.md";
  const noteTitle = "Demo";

  await installMockTauriBridge(page, {
    recentVaults: [],
    vaultOpen: true,
    vaultInfo: {
      path: "/tmp/knot-demo",
      name: "Demo Vault",
      note_count: 1,
      last_modified: now,
    },
    notes: [
      {
        id: "n1",
        path: notePath,
        title: noteTitle,
        created_at: now,
        modified_at: now,
        word_count: 2,
      },
    ],
    noteDataByPath: {
      [notePath]: {
        id: "n1",
        path: notePath,
        title: noteTitle,
        content,
        created_at: now,
        modified_at: now,
        word_count: 4,
        headings: [
          { level: 1, text: "Demo", position: 0 },
        ],
        backlinks: [],
      },
    },
    explorerTree: {
      root: {
        path: "",
        name: "root",
        expanded: true,
        folders: [],
        notes: [
          {
            path: notePath,
            title: noteTitle,
            display_title: noteTitle,
            modified_at: now,
            word_count: 2,
          },
        ],
      },
      hidden_policy: "none",
    },
  });

  await page.goto("/");

  await page.getByRole("treeitem", { name: noteTitle }).click();
  await expect(page.getByRole("tab", { name: "Source" })).toBeVisible();
  await expect(page.locator(".editor-toolbar__title")).toContainText(noteTitle);
}

test("inserts Mermaid block, keeps markdown unescaped, and renders in view mode", async ({ page }) => {
  await openDemoNote(page);

  await page.getByRole("button", { name: "Open block menu" }).click();
  await page.getByRole("menuitem", { name: "Mermaid diagram" }).click();

  await page.getByRole("tab", { name: "Source" }).click();
  const sourceEditor = page.getByLabel("Source markdown editor");
  await expect(sourceEditor).toHaveValue(/```mermaid/);
  await expect(sourceEditor).toHaveValue(/A\[Start\] --> B\[End\]/);
  await expect(sourceEditor).not.toHaveValue(/\\\[Start\\\]/);

  await page.getByRole("tab", { name: "View" }).click();
  const mermaidBlock = page.locator(".editor-mermaid[data-mermaid-diagram='true']");
  await expect(mermaidBlock).toBeVisible();

  await expect(
    page.locator(".editor-mermaid[data-mermaid-rendered='true'] .editor-mermaid__diagram svg")
  ).toBeVisible();
});

test("renders Mermaid in view mode when fence is pasted in Source mode", async ({ page }) => {
  await openDemoNote(page);

  const sourceMarkdown = [
    "# Demo",
    "",
    "```mermaid",
    "graph TD",
    "  A[Start] --> B[End]",
    "```",
    "",
    "Tail paragraph.",
  ].join("\n");

  await page.getByRole("tab", { name: "Source" }).click();
  const sourceEditor = page.getByLabel("Source markdown editor");
  await sourceEditor.fill(sourceMarkdown);
  await expect(sourceEditor).toHaveValue(/A\[Start\] --> B\[End\]/);
  await expect(sourceEditor).not.toHaveValue(/\\\[Start\\\]/);

  await page.getByRole("tab", { name: "View" }).click();
  await expect(
    page.locator(".editor-mermaid[data-mermaid-rendered='true'] .editor-mermaid__diagram svg")
  ).toBeVisible();
});

test("inserts Mermaid when cursor is inside inline formatted text", async ({ page }) => {
  await openDemoNote(page, "# Demo\n\nBefore **bold** and *emphasis* after.");

  await page.locator(".ProseMirror strong").first().click();
  await page.getByRole("button", { name: "Open block menu" }).click();
  await page.getByRole("menuitem", { name: "Mermaid diagram" }).click();

  await page.getByRole("tab", { name: "Source" }).click();
  const sourceEditor = page.getByLabel("Source markdown editor");
  const sourceValue = await sourceEditor.inputValue();
  await expect(sourceEditor).toHaveValue(/```mermaid/);
  await expect(sourceEditor).toHaveValue(/A\[Start\] --> B\[End\]/);
  await expect(sourceEditor).toHaveValue(/emphasis/);
  await expect(sourceEditor).not.toHaveValue(/\\\[Start\\\]/);
  expect(sourceValue).toContain("**bo**");
  expect(sourceValue).toContain("**ld**");

  await page.getByRole("tab", { name: "View" }).click();
  await expect(
    page.locator(".editor-mermaid[data-mermaid-rendered='true'] .editor-mermaid__diagram svg")
  ).toBeVisible();
});
