import { expect, test } from "@playwright/test";

test("home page shows the Elev8ai name", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Elev8ai" })).toBeVisible();
});
