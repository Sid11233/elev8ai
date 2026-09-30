import { expect, test } from "@playwright/test";

import { createTestUser, deleteTestUser, logIn } from "./support/users";

test.describe("freelancer profile", () => {
  const created: string[] = [];
  test.afterEach(async () => {
    await Promise.all(created.splice(0).map(deleteTestUser));
  });

  test("talent edits headline and about, and they show on the profile", async ({ page }) => {
    const user = await createTestUser({ onboarded: true });
    created.push(user.id);
    await logIn(page, user.email);

    await page.goto("/app/profile");
    await page.getByRole("link", { name: "Edit profile" }).click();
    await expect(page).toHaveURL(/\/app\/profile\/edit$/);

    await page.getByLabel("Headline").fill("Short-form video editor");
    await page.getByLabel("About you").fill("5 years editing clips for creators.");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();

    await page.goto("/app/profile");
    await expect(page.getByText("Short-form video editor")).toBeVisible();
    await expect(page.getByText("5 years editing clips for creators.")).toBeVisible();
  });
});
