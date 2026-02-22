import { expect, test } from "@playwright/test";
import { installMockTauriBridge } from "./mock-tauri-bridge";

test("shows welcome shell and recent vaults via mocked Tauri bridge", async ({ page }) => {
  await installMockTauriBridge(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Welcome to Knot" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Existing Vault" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create New Vault" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent Vaults" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Demo Vault/ })).toBeVisible();
});
