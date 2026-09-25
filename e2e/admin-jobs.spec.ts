import { expect, test } from "@playwright/test";

import { deleteCompanyByName, uniqueSuffix } from "./support/data";
import { createTestUser, deleteTestUser, logIn } from "./support/users";

test.describe("admin companies and jobs", () => {
  let adminId: string | undefined;
  let companyName: string | undefined;

  test.afterEach(async () => {
    if (companyName) await deleteCompanyByName(companyName);
    if (adminId) await deleteTestUser(adminId);
  });

  test("admin creates a company, posts a job, duplicates and closes it", async ({ page }) => {
    const admin = await createTestUser({ admin: true });
    adminId = admin.id;
    companyName = `E2E Podcast ${uniqueSuffix()}`;
    await logIn(page, admin.email);

    // Company
    await page.goto("/admin/companies/new");
    await page.getByLabel("Name").fill(companyName);
    await page.getByLabel("Description").fill("Test company for e2e.");
    await page.getByRole("button", { name: "Create company" }).click();
    await expect(page).toHaveURL(/\/admin\/companies$/);
    await expect(page.getByRole("link", { name: companyName })).toBeVisible();

    // Job: per-unit pay with a live preview
    await page.goto("/admin/jobs/new");
    await page.getByLabel("Company").selectOption({ label: companyName });
    await page.getByLabel("Category").selectOption("clipping");
    await page.getByLabel("Title").fill("Clip episode 12");
    await page.getByLabel("Description", { exact: true }).fill("Cut 30-60s clips with captions.");
    await page.getByLabel("Pay type").selectOption("per_unit");
    await page.getByLabel("Pay per unit (USD)").fill("5");
    await page.getByLabel("Unit", { exact: true }).fill("clip");
    await page.getByLabel("Max units paid per person").fill("20");
    await page.getByLabel("Spots").fill("3");
    await expect(page.getByText("$5 per clip · max 20 clips · up to $100")).toBeVisible();

    // Publishing needs proof instructions
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Add proof instructions before publishing")).toBeVisible();
    await expect(page.getByLabel("Title")).toHaveValue("Clip episode 12");

    await page.getByLabel("Proof instructions").fill("Posted link plus a views screenshot.");
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page).toHaveURL(/\/admin\/jobs$/);

    const card = page.locator("[data-slot=card]").filter({ hasText: "Clip episode 12" }).first();
    await expect(card.getByText("Open", { exact: true })).toBeVisible();
    await expect(card.getByText("$5 per clip")).toBeVisible();

    // Duplicate opens the copy as a draft
    await card.getByRole("button", { name: "Duplicate" }).click();
    await expect(page).toHaveURL(/\/admin\/jobs\/[0-9a-f-]{36}$/);
    await expect(page.getByLabel("Title")).toHaveValue("Clip episode 12 (copy)");
    await expect(page.getByText("Draft", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Pay per unit (USD)")).toHaveValue("5");

    // Close the original from the list, filtered to this company
    await page.goto("/admin/jobs");
    await page.getByLabel("Company", { exact: true }).selectOption({ label: companyName });
    await page.getByRole("button", { name: "Filter" }).click();
    const original = page
      .locator("[data-slot=card]")
      .filter({ hasText: "Clip episode 12" })
      .filter({ hasNotText: "(copy)" });
    await original.getByRole("button", { name: "Close" }).click();
    await expect(original.getByText("Closed", { exact: true })).toBeVisible();
    await expect(page.locator("[data-slot=card]")).toHaveCount(2);
  });

  test("talent cannot open admin job pages", async ({ page }) => {
    const talent = await createTestUser({ onboarded: true });
    adminId = talent.id;
    await logIn(page, talent.email);
    await page.goto("/admin/jobs/new");
    await expect(page).toHaveURL(/\/app\/jobs$/);
  });
});
