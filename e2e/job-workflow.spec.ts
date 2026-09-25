import { expect, type Page, test } from "@playwright/test";

import { adminDb, createTestCompany, deleteCompanyByName, uniqueSuffix } from "./support/data";
import { createTestUser, deleteTestUser, logIn } from "./support/users";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

test.describe("job workflow", () => {
  const cleanup: { company?: string; users: string[] } = { users: [] };
  test.afterEach(async () => {
    if (cleanup.company) await deleteCompanyByName(cleanup.company);
    await Promise.all(cleanup.users.splice(0).map(deleteTestUser));
  });

  test("apply -> accept -> submit -> changes -> approve -> paid", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const tag = uniqueSuffix();
    const company = await createTestCompany(`E2E Flow Co ${tag}`);
    cleanup.company = company.name;
    const title = `Clip the pilot ${tag}`;
    const { data: job, error } = await adminDb()
      .from("jobs")
      .insert({
        company_id: company.id,
        title,
        description: "Cut clips.",
        proof_instructions: "Posted link plus a views screenshot.",
        category: "clipping",
        pay_cents: 500,
        pay_type: "per_unit",
        unit_label: "clip",
        max_units: 3,
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

    // Talent applies
    await page.goto(`/app/jobs/${job.id}`);
    await expect(page.getByText("1 of 1 spot left")).toBeVisible();
    await page.getByLabel("Why you? (optional)").fill("I edit clips every day.");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("Application sent")).toBeVisible();
    await page.goto("/app/my-jobs?tab=applied");
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText("Waiting for decision")).toBeVisible();

    // Admin accepts
    await adminPage.goto("/admin/applications");
    const appCard = adminPage.locator("[data-slot=card]").filter({ hasText: title });
    await expect(appCard.getByText("I edit clips every day.")).toBeVisible();
    await appCard.getByLabel("Note to the applicant").fill("Welcome aboard");
    await appCard.getByRole("button", { name: "Accept" }).click();
    await expect(appCard).toHaveCount(0);

    // Talent submits (last spot filled, so the job closed but stays visible to them)
    await page.goto(`/app/jobs/${job.id}`);
    await expect(page.getByText("You're in!")).toBeVisible();
    await expect(page.getByText("Welcome aboard")).toBeVisible();
    await page.getByRole("link", { name: "Go to this job" }).click();
    await expect(page.getByText("Submit your work")).toBeVisible();
    await page.getByRole("button", { name: "Submit work" }).click();
    await expect(page.getByText("Add at least one link or file as proof")).toBeVisible();
    await page.getByLabel("Links").fill("https://www.tiktok.com/@e2e/video/1");
    await page.getByLabel("Files (optional)").setInputFiles({
      name: "views.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await page.getByLabel("How many clips did you complete?").fill("5");
    await page.getByRole("button", { name: "Submit work" }).click();
    await expect(page.getByText("Your work is being reviewed")).toBeVisible();
    await expect(page.getByRole("link", { name: "views.png" })).toBeVisible();

    // Admin requests changes (note required), payout preview is capped at 3 clips
    await adminPage.goto("/admin/submissions");
    const subCard = adminPage.locator("[data-slot=card]").filter({ hasText: title });
    await expect(subCard.getByRole("link", { name: "views.png" })).toBeVisible();
    await expect(subCard.getByText("Payout if approved: $15")).toBeVisible();
    await subCard.getByRole("button", { name: "Request changes" }).click();
    await expect(subCard.getByText("Add a note so the talent knows")).toBeVisible();
    await subCard.getByLabel("Note to talent").fill("Please add captions.");
    await subCard.getByRole("button", { name: "Request changes" }).click();
    await expect(subCard).toHaveCount(0);

    // Talent resubmits
    await page.reload();
    await expect(page.getByText("Resubmit your work")).toBeVisible();
    await expect(page.getByText("Please add captions.").first()).toBeVisible();
    await page.getByLabel("Links").fill("https://www.tiktok.com/@e2e/video/2");
    await page.getByLabel("How many clips did you complete?").fill("2");
    await page.getByRole("button", { name: "Submit work" }).click();
    await expect(page.getByText("Your work is being reviewed")).toBeVisible();

    // Admin approves 2 clips -> $10 owed
    await adminPage.goto("/admin/submissions");
    await expect(subCard.getByText("Payout if approved: $10")).toBeVisible();
    await subCard.getByRole("button", { name: "Approve" }).click();
    await expect(subCard).toHaveCount(0);

    await page.goto("/app/earnings");
    await expect(page.getByText("Owed to you")).toBeVisible();
    await expect(page.getByRole("link", { name: title })).toBeVisible();
    await expect(page.getByText("Owed", { exact: true })).toBeVisible();

    // Admin marks it paid
    await adminPage.goto("/admin/payouts");
    const payCard = adminPage.locator("[data-slot=card]").filter({ hasText: title });
    await expect(payCard.getByText("$10").first()).toBeVisible();
    await payCard.getByRole("button", { name: "Mark paid" }).click();
    await expect(payCard.getByText("Choose how you sent the money")).toBeVisible();
    await payCard.getByLabel("Payment method").selectOption("wise");
    await payCard.getByLabel("Payment reference").fill(`TX-${tag}`);
    await payCard.getByRole("button", { name: "Mark paid" }).click();
    await expect(adminPage.getByText(`TX-${tag}`)).toBeVisible();

    const csv = await adminPage.request.get("/admin/payouts/export?status=paid");
    expect(csv.headers()["content-type"]).toContain("text/csv");
    expect(await csv.text()).toContain(`TX-${tag}`);

    // Talent sees it paid
    await page.goto("/app/earnings");
    await expect(page.getByText("Paid", { exact: true })).toBeVisible();
    await page.goto("/app/my-jobs?tab=completed");
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText("$10 paid")).toBeVisible();

    // Talent can't use the admin CSV export
    const blocked = await page.request.get("/admin/payouts/export?status=all");
    expect(blocked.status()).not.toBe(200);

    await adminContext.close();
  });
});
