import { expect, type Page, test } from "@playwright/test";

import { adminDb, createTestCompany, deleteCompanyByName, uniqueSuffix } from "./support/data";
import { createTestUser, deleteTestUser, logIn } from "./support/users";

async function deleteCourse(id: string) {
  const db = adminDb();
  const { data: lessons } = await db.from("lessons").select("id").eq("course_id", id);
  await db.from("lesson_completions").delete().in("lesson_id", (lessons ?? []).map((l) => l.id));
  await db.from("course_assignments").delete().eq("course_id", id);
  await db.from("course_access").delete().eq("course_id", id);
  await db.from("lessons").delete().eq("course_id", id);
  await db.from("courses").delete().eq("id", id);
}

test.describe("badges and gated jobs", () => {
  const cleanup: { courseId?: string; company?: string; users: string[] } = { users: [] };
  test.afterEach(async () => {
    if (cleanup.courseId) await deleteCourse(cleanup.courseId);
    if (cleanup.company) await deleteCompanyByName(cleanup.company);
    await Promise.all(cleanup.users.splice(0).map(deleteTestUser));
  });

  test("assignment -> grade -> badge unlocks a gated job", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const tag = uniqueSuffix();
    const db = adminDb();
    const { data: skill } = await db.from("skills").select("id, name").eq("slug", "clipping").single();

    const { data: course } = await db
      .from("courses")
      .insert({
        slug: `badge-${tag}`,
        title: `Clipping ${tag}`,
        price_cents: 1200,
        skill_id: skill!.id,
        assignment_brief: "Submit 3 clips from the sample episode.",
        published: true,
      })
      .select("id")
      .single();
    cleanup.courseId = course!.id;

    const company = await createTestCompany(`Badge Co ${tag}`);
    cleanup.company = company.name;
    const jobTitle = `Gated clipping ${tag}`;
    await db.from("jobs").insert({
      company_id: company.id,
      title: jobTitle,
      description: "Clip our show.",
      proof_instructions: "Send links.",
      category: "clipping",
      pay_cents: 2500,
      pay_type: "fixed",
      slots: 3,
      required_skill_id: skill!.id,
      status: "open",
    });

    const talent = await createTestUser({ onboarded: true });
    const admin = await createTestUser({ admin: true });
    cleanup.users.push(talent.id, admin.id);
    // Grant course access (as the webhook would).
    await db.from("course_access").insert({ user_id: talent.id, course_id: course!.id, amount_cents: 1200 });

    const adminCtx = await browser.newContext();
    const adminPage: Page = await adminCtx.newPage();
    await logIn(page, talent.email);
    await logIn(adminPage, admin.email);

    // Job is locked before the badge.
    await page.goto("/app/jobs?show=locked");
    await expect(page.locator("[data-slot=card]").filter({ hasText: jobTitle }).getByText(/Needs the Clipping badge/)).toBeVisible();

    // Submit the assignment.
    await page.goto(`/app/learn/badge-${tag}`);
    await expect(page.getByText("Submit 3 clips from the sample episode.")).toBeVisible();
    await page.getByLabel("Links").fill("https://tiktok.com/@me/1");
    await page.getByRole("button", { name: "Submit assignment" }).click();
    await expect(page.getByText(/We'll grade it within 72 hours/)).toBeVisible();

    // Admin fails it with feedback.
    await adminPage.goto("/admin/grading");
    const gradeCard = adminPage.locator("[data-slot=card]").filter({ hasText: `Clipping ${tag}` });
    await expect(gradeCard.getByText("https://tiktok.com/@me/1")).toBeVisible();
    await gradeCard.getByRole("button", { name: "Fail" }).click();
    await expect(gradeCard.getByText(/Add feedback/)).toBeVisible();
    await gradeCard.getByLabel("Feedback").fill("Hook is too slow — recut.");
    await gradeCard.getByRole("button", { name: "Fail" }).click();
    await expect(gradeCard).toHaveCount(0);

    // Talent sees the feedback and resubmits.
    await page.reload();
    await expect(page.getByText("Hook is too slow — recut.")).toBeVisible();
    await page.getByLabel("Links").fill("https://tiktok.com/@me/2");
    await page.getByRole("button", { name: "Resubmit" }).click();
    await expect(page.getByText(/We'll grade it within 72 hours/)).toBeVisible();

    // Admin passes and awards the badge.
    await adminPage.goto("/admin/grading");
    await adminPage
      .locator("[data-slot=card]")
      .filter({ hasText: `Clipping ${tag}` })
      .getByRole("button", { name: "Pass & award badge" })
      .click();

    // Talent now has the badge and the gated job is unlocked.
    await expect(async () => {
      await page.goto("/app/profile");
      await expect(page.getByText("Badges")).toBeVisible();
      await expect(
        page.locator("[data-slot=card]").filter({ hasText: "Badges" }).getByText(skill!.name),
      ).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });

    await page.goto(`/app/jobs?badge=${skill!.id}`);
    const card = page.locator("[data-slot=card]").filter({ hasText: jobTitle });
    await expect(card).toBeVisible();
    await expect(card.getByText("Newly unlocked")).toBeVisible();
    await expect(card.getByText(/Needs the Clipping badge/)).toHaveCount(0);

    await adminCtx.close();
  });

  test("payout settings and manual badge award", async ({ page, browser }) => {
    test.setTimeout(90_000);
    const tag = uniqueSuffix();
    const talent = await createTestUser({ onboarded: true });
    const admin = await createTestUser({ admin: true });
    cleanup.users.push(talent.id, admin.id);

    // Talent saves MCB Juice payout details.
    await logIn(page, talent.email);
    await page.goto("/app/settings/payout");
    await page.getByLabel("Payout method").selectOption("juice");
    await page.getByLabel("Juice phone number").fill("+230 5123 4567");
    await page.getByRole("button", { name: "Save payout details" }).click();
    await expect(page.getByText("Payout details saved.")).toBeVisible();

    // Admin awards and revokes a badge from the Users page. Target the talent's
    // card by their unique @username.
    const { data: prof } = await adminDb()
      .from("profiles")
      .select("username")
      .eq("user_id", talent.id)
      .single();
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await logIn(adminPage, admin.email);
    await adminPage.goto("/admin/users");
    const card = adminPage.locator("[data-slot=card]").filter({ hasText: `@${prof!.username}` });
    await card.getByLabel("Award a badge").selectOption({ label: "Cold Calling" });
    await card.getByRole("button", { name: "Award" }).click();
    await expect(card.getByText("Cold Calling")).toBeVisible();
    await card.getByRole("button", { name: "Remove Cold Calling badge" }).click();
    await expect(card.getByRole("button", { name: "Remove Cold Calling badge" })).toHaveCount(0);

    await adminCtx.close();
  });
});
