import { expect, type Page, test } from "@playwright/test";

import { adminDb, createTestCompany, deleteCompanyByName, uniqueSuffix } from "./support/data";
import { createTestUser, deleteTestUser, logIn } from "./support/users";

test.describe("chat and notifications", () => {
  const cleanup: { company?: string; users: string[] } = { users: [] };
  test.afterEach(async () => {
    if (cleanup.company) await deleteCompanyByName(cleanup.company);
    await Promise.all(cleanup.users.splice(0).map(deleteTestUser));
  });

  test("notifications fire through the flow and chat delivers messages", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const tag = uniqueSuffix();
    const company = await createTestCompany(`E2E Chat Co ${tag}`);
    cleanup.company = company.name;
    const title = `Edit our reel ${tag}`;
    const { data: job, error } = await adminDb()
      .from("jobs")
      .insert({
        company_id: company.id,
        title,
        description: "Edit a reel.",
        proof_instructions: "Send the link.",
        category: "content",
        pay_cents: 3000,
        pay_type: "fixed",
        slots: 1,
        status: "open",
      })
      .select("id")
      .single();
    if (error) throw error;

    const talent = await createTestUser({ onboarded: true });
    const admin = await createTestUser({ admin: true });
    cleanup.users.push(talent.id, admin.id);

    const adminContext = await browser.newContext();
    const adminPage: Page = await adminContext.newPage();
    await logIn(page, talent.email);
    await logIn(adminPage, admin.email);

    // Talent applies -> admin gets a "New job application" notification.
    await page.goto(`/app/jobs/${job.id}`);
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("Application sent")).toBeVisible();

    await adminPage.goto("/admin");
    await adminPage.getByRole("button", { name: /Notifications/ }).click();
    await expect(adminPage.getByText("New job application")).toBeVisible();

    // Admin accepts from the queue -> talent gets "You're in!" + a thread opens.
    await adminPage.goto("/admin/applications");
    const appCard = adminPage.locator("[data-slot=card]").filter({ hasText: title });
    await appCard.getByRole("button", { name: "Accept" }).click();
    await expect(appCard).toHaveCount(0);

    await page.goto("/app/notifications");
    await expect(page.getByText("You're in!")).toBeVisible();

    // Talent opens the thread and sends a message; contact info warns but doesn't block.
    await page.goto("/app/messages");
    await page.getByRole("link", { name: title }).click();
    await expect(page).toHaveURL(/\/app\/messages\/[0-9a-f-]{36}$/);
    await page.getByLabel("Write a message").fill("Hi! Reach me at me@example.com");
    await expect(page.getByText(/Keep contact details on Elev8ai/)).toBeVisible();
    await page.getByLabel("Write a message").fill("Hi, when do you need this by?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Hi, when do you need this by?")).toBeVisible();

    // Admin sees the thread in the inbox, opens it, sees the message, replies.
    await adminPage.goto("/admin/messages");
    await expect(adminPage.getByText("Hi, when do you need this by?")).toBeVisible();
    await adminPage.getByRole("link", { name: title }).click();
    await expect(adminPage.getByText("Hi, when do you need this by?")).toBeVisible();
    await adminPage.getByLabel("Write a message").fill("By Friday please!");
    await adminPage.getByRole("button", { name: "Send" }).click();
    await expect(adminPage.getByText("By Friday please!")).toBeVisible();

    // Talent receives the reply live (still on the thread page).
    await expect(page.getByText("By Friday please!")).toBeVisible({ timeout: 15000 });

    // Talent gets a new-message notification. The live reply arrives from the
    // message insert, which can beat the separate notification row, so reload.
    await expect(async () => {
      await page.goto("/app/notifications");
      await expect(page.getByText(/New message about/)).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20000 });

    // Mark all read clears the button.
    await page.getByRole("button", { name: "Mark all as read" }).click();
    await expect(page.getByRole("button", { name: "Mark all as read" })).toHaveCount(0);

    await adminContext.close();
  });
});
