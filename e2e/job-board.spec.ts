import { expect, test } from "@playwright/test";

import { adminDb, createTestCompany, deleteCompanyByName, uniqueSuffix } from "./support/data";
import { createTestUser, deleteTestUser, logIn } from "./support/users";

test.describe("talent job board", () => {
  const cleanup: { companyName?: string; userId?: string } = {};
  test.afterEach(async () => {
    if (cleanup.companyName) await deleteCompanyByName(cleanup.companyName);
    if (cleanup.userId) await deleteTestUser(cleanup.userId);
  });

  test("shows open jobs, filters them, and locks badge-gated jobs", async ({ page }) => {
    const tag = uniqueSuffix();
    const company = await createTestCompany(`E2E Board Co ${tag}`);
    cleanup.companyName = company.name;
    const db = adminDb();
    const { data: coldCalling } = await db
      .from("skills")
      .select("id")
      .eq("slug", "cold_calling")
      .single();

    const base = {
      company_id: company.id,
      description: "Job description here.",
      proof_instructions: "Send a link.",
    };
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const { data: jobs, error } = await db
      .from("jobs")
      .insert([
        {
          ...base,
          title: `Starter clips ${tag}`,
          category: "clipping",
          pay_cents: 200,
          pay_type: "per_unit",
          unit_label: "clip",
          max_units: 5,
          status: "open",
        },
        {
          ...base,
          title: `Book meetings ${tag}`,
          category: "cold_calling",
          pay_cents: 2500,
          pay_type: "per_unit",
          unit_label: "meeting",
          max_units: 10,
          required_skill_id: coldCalling!.id,
          status: "open",
        },
        {
          ...base,
          title: `Hidden draft ${tag}`,
          category: "content",
          pay_cents: 1000,
          pay_type: "fixed",
          status: "draft",
        },
        {
          ...base,
          title: `Expired job ${tag}`,
          category: "content",
          pay_cents: 1000,
          pay_type: "fixed",
          status: "open",
          deadline: past,
        },
      ])
      .select("id, title");
    if (error) throw error;
    const byTitle = (prefix: string) => jobs!.find((j) => j.title.startsWith(prefix))!;

    const talent = await createTestUser({ onboarded: true });
    cleanup.userId = talent.id;
    await logIn(page, talent.email);
    await expect(page).toHaveURL(/\/app\/jobs$/);

    const card = (prefix: string) =>
      page.locator("[data-slot=card]").filter({ hasText: `${prefix} ${tag}` });

    // Open jobs show; drafts and expired jobs don't.
    await expect(card("Starter clips")).toBeVisible();
    await expect(card("Starter clips").getByText("$2 per clip")).toBeVisible();
    await expect(card("Book meetings")).toBeVisible();
    await expect(card("Hidden draft")).toHaveCount(0);
    await expect(card("Expired job")).toHaveCount(0);

    // The gated job is locked with a path to the badge.
    await expect(card("Book meetings").getByText("Needs the Cold Calling badge")).toBeVisible();
    await expect(
      card("Book meetings").getByRole("link", { name: "Get the badge" }),
    ).toHaveAttribute("href", "/app/learn");
    await expect(card("Starter clips").getByText(/Needs the/)).toHaveCount(0);

    // Availability filters
    await page
      .getByRole("group", { name: "Availability" })
      .getByRole("link", { name: "Can take now" })
      .click();
    await expect(page).toHaveURL(/show=available/);
    await expect(card("Starter clips")).toBeVisible();
    await expect(card("Book meetings")).toHaveCount(0);

    await page
      .getByRole("group", { name: "Availability" })
      .getByRole("link", { name: "Locked" })
      .click();
    await expect(card("Book meetings")).toBeVisible();
    await expect(card("Starter clips")).toHaveCount(0);

    // Category + minimum pay (Book meetings can earn up to $250, Starter clips up to $10)
    await page.goto("/app/jobs?category=clipping");
    await expect(card("Starter clips")).toBeVisible();
    await expect(card("Book meetings")).toHaveCount(0);
    await page.goto("/app/jobs?min=5000");
    await expect(card("Book meetings")).toBeVisible();
    await expect(card("Starter clips")).toHaveCount(0);

    // Detail pages
    await page.goto("/app/jobs");
    await card("Starter clips")
      .getByRole("link", { name: `Starter clips ${tag}` })
      .click();
    await expect(page).toHaveURL(new RegExp(`/app/jobs/${byTitle("Starter clips").id}$`));
    await expect(
      page.getByRole("heading", { level: 1, name: `Starter clips ${tag}` }),
    ).toBeVisible();
    await expect(page.getByText("What to submit")).toBeVisible();
    await expect(page.getByText("max 5 clips · up to $10")).toBeVisible();

    await page.goto(`/app/jobs/${byTitle("Book meetings").id}`);
    await expect(page.getByText("Needs the Cold Calling badge")).toBeVisible();

    // Drafts can't be opened by URL.
    // (The page streams behind a loading skeleton, so Next renders not-found
    // content rather than a 404 status.)
    await page.goto(`/app/jobs/${byTitle("Hidden draft").id}`);
    await expect(page.getByText("This page could not be found.")).toBeVisible();
    await expect(page.getByText(`Hidden draft ${tag}`)).toHaveCount(0);

    // Earning the badge unlocks the job.
    await db
      .from("user_skills")
      .insert({ user_id: talent.id, skill_id: coldCalling!.id, source: "manual" });
    await page.goto(`/app/jobs/${byTitle("Book meetings").id}`);
    await expect(page.getByText("Needs the Cold Calling badge")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Apply" })).toBeVisible();
  });
});
