import { expect, test, type Page } from "@playwright/test";
import { installMockTauriBridge } from "./mock-tauri-bridge";

async function openVaultWithTwoNotes(page: Page): Promise<void> {
  const now = 1_700_000_200;

  await installMockTauriBridge(page, {
    recentVaults: [],
    vaultOpen: true,
    vaultInfo: {
      path: "/tmp/knot-demo",
      name: "Demo Vault",
      note_count: 2,
      last_modified: now,
    },
    notes: [
      {
        id: "n1",
        path: "first.md",
        title: "First",
        created_at: now,
        modified_at: now,
        word_count: 3,
      },
      {
        id: "n2",
        path: "second.md",
        title: "Second",
        created_at: now,
        modified_at: now,
        word_count: 3,
      },
    ],
    noteDataByPath: {
      "first.md": {
        id: "n1",
        path: "first.md",
        title: "First",
        content: "# First\n\nOriginal first note.",
        created_at: now,
        modified_at: now,
        word_count: 4,
        headings: [{ level: 1, text: "First", position: 0 }],
        backlinks: [],
      },
      "second.md": {
        id: "n2",
        path: "second.md",
        title: "Second",
        content: "# Second\n\nOriginal second note.",
        created_at: now,
        modified_at: now,
        word_count: 4,
        headings: [{ level: 1, text: "Second", position: 0 }],
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
            path: "first.md",
            title: "First",
            display_title: "First",
            modified_at: now,
            word_count: 3,
          },
          {
            path: "second.md",
            title: "Second",
            display_title: "Second",
            modified_at: now,
            word_count: 3,
          },
        ],
      },
      hidden_policy: "none",
    },
    graphLayout: {
      nodes: [
        { id: "first.md", label: "First", x: 220, y: 180 },
        { id: "second.md", label: "Second", x: 420, y: 200 },
      ],
      edges: [{ source: "first.md", target: "second.md" }],
    },
  });

  await page.goto("/");
  await page.getByRole("treeitem", { name: "First" }).click();
  await expect(page.locator(".editor-toolbar__title")).toContainText("First");
}

test("note edit/save persists when switching notes and returning", async ({ page }) => {
  await openVaultWithTwoNotes(page);

  await page.getByRole("tab", { name: "Source" }).click();
  const sourceEditor = page.getByLabel("Source markdown editor");
  await sourceEditor.fill("# First Updated\n\nSaved from journey test.");

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeDisabled();

  await page.getByRole("treeitem", { name: "Second" }).click();
  await expect(page.locator(".editor-toolbar__title")).toContainText("Second");

  await page.getByRole("treeitem", { name: "First" }).click();
  await page.getByRole("tab", { name: "View" }).click();
  await expect(page.getByRole("heading", { name: "First Updated" })).toBeVisible();
});

test("can switch editor to graph mode and back", async ({ page }) => {
  await openVaultWithTwoNotes(page);

  await page.getByRole("button", { name: "Graph mode" }).click();
  await expect(page.getByRole("img", { name: "Note link graph" })).toBeVisible();

  await page.getByRole("button", { name: "Edit note" }).click();
  await expect(page.getByRole("tab", { name: "Edit" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".editor-toolbar__title")).toContainText("First");
});

test("prompts on unsaved switch and saves when confirmed", async ({ page }) => {
  await openVaultWithTwoNotes(page);

  await page.getByRole("tab", { name: "Source" }).click();
  const sourceEditor = page.getByLabel("Source markdown editor");
  await sourceEditor.fill("# First\n\nChanged and saved during switch.");

  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    await dialog.accept();
  });
  await page.getByRole("treeitem", { name: "Second" }).click();
  await expect(page.locator(".editor-toolbar__title")).toContainText("Second");

  await page.getByRole("treeitem", { name: "First" }).click();
  await page.getByRole("tab", { name: "Source" }).click();
  await expect(page.getByLabel("Source markdown editor")).toHaveValue(
    "# First\n\nChanged and saved during switch."
  );
});
