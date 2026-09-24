import { expect, test } from "@playwright/test";

import { avatarUrlOf, createTestUser, deleteTestUser, logIn } from "./support/users";

test.describe("auth and onboarding", () => {
  const created: string[] = [];
  test.afterEach(async () => {
    await Promise.all(created.splice(0).map(deleteTestUser));
  });

  test("signed-out visitors are sent to login", async ({ page }) => {
    for (const path of ["/app/jobs", "/admin", "/onboarding"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login\?next=/);
    }
    await expect(page.getByRole("button", { name: "Email me a login link" })).toBeVisible();
  });

  test("new user is rejected under 18, then completes onboarding and logs out", async ({
    page,
  }) => {
    const user = await createTestUser();
    created.push(user.id);

    await logIn(page, user.email);
    await expect(page).toHaveURL(/\/onboarding$/);

    // An onboarding-incomplete user can't reach the app yet.
    await page.goto("/app/jobs");
    await expect(page).toHaveURL(/\/onboarding$/);

    const underage = new Date();
    underage.setFullYear(underage.getFullYear() - 16);
    const username = `e2e_${Date.now()}`.slice(0, 20);

    await page.getByLabel("Full name").fill("Aisha Test");
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Date of birth").fill(underage.toISOString().slice(0, 10));
    await page.getByLabel("Country").fill("Mauritius");
    await page.getByRole("button", { name: "Finish setup" }).click();
    await expect(page.getByText("You need to be 18 or older to join Elev8ai.")).toBeVisible();
    // Entered values survive the failed submit.
    await expect(page.getByLabel("Username")).toHaveValue(username);

    await page.getByLabel("Date of birth").fill("2001-05-20");
    await page.getByLabel("Profile photo (optional)").setInputFiles({
      name: "me.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await page.getByRole("button", { name: "Finish setup" }).click();
    await expect(page).toHaveURL(/\/app\/jobs$/);
    await expect(page.getByRole("heading", { name: "Welcome, Aisha" })).toBeVisible();
    expect(await avatarUrlOf(user.id)).toContain(`/avatars/${user.id}/avatar-`);

    // Onboarding can't be revisited once done.
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/app\/jobs$/);

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/app/jobs");
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test("talent cannot open the admin area", async ({ page }) => {
    const user = await createTestUser({ onboarded: true });
    created.push(user.id);

    await logIn(page, user.email);
    await expect(page).toHaveURL(/\/app\/jobs$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/app\/jobs$/);
  });

  test("admin lands in the admin area", async ({ page }) => {
    const user = await createTestUser({ admin: true });
    created.push(user.id);

    await logIn(page, user.email);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
  });

  test("login returns the user to the page they asked for", async ({ page }) => {
    const user = await createTestUser({ onboarded: true });
    created.push(user.id);

    await logIn(page, user.email, "/app/jobs?from=email");
    await expect(page).toHaveURL(/\/app\/jobs\?from=email$/);
  });
});
