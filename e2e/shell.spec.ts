import { expect, test } from "@playwright/test";

import { createTestUser, deleteTestUser, logIn } from "./support/users";

test.describe("app shell navigation", () => {
  const created: string[] = [];
  test.afterEach(async () => {
    await Promise.all(created.splice(0).map(deleteTestUser));
  });

  test("talent can reach every section from the main navigation", async ({ page }) => {
    const user = await createTestUser({ onboarded: true });
    created.push(user.id);
    await logIn(page, user.email);
    await expect(page).toHaveURL(/\/app\/jobs$/);

    // Bottom bar on phones, sidebar on desktop: exactly one is visible.
    const nav = page.getByRole("navigation").filter({ visible: true });
    for (const [label, path, heading] of [
      ["My Jobs", "/app/my-jobs", "My Jobs"],
      ["Learn", "/app/learn", "Learn"],
      ["Messages", "/app/messages", "Messages"],
      ["Profile", "/app/profile", "Profile"],
      ["Jobs", "/app/jobs", "Welcome, E2E"],
    ]) {
      await nav.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(nav.getByRole("link", { name: label, exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );
    }

    // The bell opens a dropdown; "See all" goes to the notifications page.
    await page.getByRole("button", { name: /Notifications/ }).click();
    await page.getByRole("link", { name: "See all" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
  });

  test("admin can reach every admin section", async ({ page, isMobile }) => {
    const user = await createTestUser({ admin: true });
    created.push(user.id);
    await logIn(page, user.email);
    await expect(page).toHaveURL(/\/admin$/);

    for (const label of [
      "Companies",
      "Jobs",
      "Applications",
      "Submissions",
      "Payouts",
      "Courses",
      "Grading",
      "Messages",
      "Users",
    ]) {
      if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
      await page
        .getByRole("navigation")
        .filter({ visible: true })
        .getByRole("link", { name: label, exact: true })
        .click();
      await expect(page.getByRole("heading", { level: 1, name: label })).toBeVisible();
    }
  });
});
