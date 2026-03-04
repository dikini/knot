import { expect, test, type Page } from "@playwright/test";
import { installMockTauriBridge } from "./mock-tauri-bridge";

async function openMarkdownNote(page: Page, content: string): Promise<void> {
  const now = 1_700_000_200;
  const notePath = "gfm-demo.md";
  const noteTitle = "GFM Demo";

  await installMockTauriBridge(page, {
    recentVaults: [],
    vaultOpen: true,
    vaultInfo: {
      path: "/tmp/knot-gfm-demo",
      name: "GFM Demo Vault",
      note_count: 1,
      last_modified: now,
    },
    notes: [
      {
        id: "gfm-1",
        path: notePath,
        title: noteTitle,
        created_at: now,
        modified_at: now,
        word_count: 8,
      },
    ],
    noteDataByPath: {
      [notePath]: {
        id: "gfm-1",
        path: notePath,
        title: noteTitle,
        content,
        created_at: now,
        modified_at: now,
        word_count: 8,
        headings: [{ level: 1, text: "Demo", position: 0 }],
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
            word_count: 8,
          },
        ],
      },
      hidden_policy: "none",
    },
  });

  await page.goto("/");
  await page.getByRole("treeitem", { name: noteTitle }).click();
  await expect(page.locator(".editor-toolbar__title")).toContainText(noteTitle);
}

test("renders GFM tables and footnotes in view mode while keeping raw HTML literal", async ({ page }) => {
  await openMarkdownNote(
    page,
    [
      "# Demo",
      "",
      "| Feature | Details |",
      "| --- | --- |",
      "| Tables | [docs](https://example.com)[^1] |",
      "",
      "[^1]: Footnote body",
      "",
      "<span>unsafe</span>",
    ].join("\n")
  );

  await page.getByRole("tab", { name: "View" }).click();

  await expect(page.locator("table")).toBeVisible();
  await expect(page.locator("sup[data-footnote-reference='true']")).toContainText("1");
  await expect(page.locator("section[data-footnote-definition='true']")).toContainText("Footnote body");
  await expect(page.locator("span")).toHaveCount(0);
  await expect(page.locator(".editor-content")).toContainText("<span>unsafe</span>");
});

test("source mode keeps unsupported rich table-cell content out of the browser lane contract", async ({ page }) => {
  await openMarkdownNote(
    page,
    [
      "# Demo",
      "",
      "| Feature | Details |",
      "| --- | --- |",
      "| Tables | First line |",
    ].join("\n")
  );

  await page.getByRole("tab", { name: "Source" }).click();
  const sourceEditor = page.getByLabel("Source markdown editor");
  await expect(sourceEditor).toHaveValue(/\| Tables \| First line \|/);
  await expect(sourceEditor).not.toHaveValue(/Quoted detail/);
  await expect(sourceEditor).not.toHaveValue(/Item detail/);
});
