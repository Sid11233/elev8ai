import { createHmac } from "node:crypto";

import { expect, test } from "@playwright/test";

import { adminDb, uniqueSuffix } from "./support/data";
import { createTestUser, deleteTestUser, logIn } from "./support/users";

// Remove a course and everything hanging off it.
async function deleteCourse(id: string) {
  const db = adminDb();
  const { data: lessons } = await db.from("lessons").select("id").eq("course_id", id);
  await db
    .from("lesson_completions")
    .delete()
    .in(
      "lesson_id",
      (lessons ?? []).map((l) => l.id),
    );
  await db.from("course_access").delete().eq("course_id", id);
  await db.from("lessons").delete().eq("course_id", id);
  await db.from("courses").delete().eq("id", id);
}

test.describe("courses", () => {
  const cleanup: { courseId?: string; users: string[] } = { users: [] };
  test.afterEach(async () => {
    if (cleanup.courseId) await deleteCourse(cleanup.courseId);
    await Promise.all(cleanup.users.splice(0).map(deleteTestUser));
  });

  test("admin authors and publishes a course", async ({ page }) => {
    const tag = uniqueSuffix();
    const admin = await createTestUser({ admin: true });
    cleanup.users.push(admin.id);
    await logIn(page, admin.email);

    await page.goto("/admin/courses/new");
    await page.getByLabel("Title").fill(`Clipping 101 ${tag}`);
    await page.getByLabel("Price (USD)").fill("12");
    await page.getByLabel("Badge awarded").selectOption({ label: "Clipping" });
    // Publish is blocked without a variant id.
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText(/Add the Lemon Squeezy variant id/)).toBeVisible();
    await page.getByLabel("Lemon Squeezy variant id").fill(`var-${tag}`);
    await page.getByRole("button", { name: "Create draft" }).click();
    // Now on the edit page; capture the id for cleanup.
    await expect(page).toHaveURL(/\/admin\/courses\/[0-9a-f-]{36}$/);
    cleanup.courseId = page.url().split("/").pop()!;

    // Add a lesson with markdown + preview.
    await page.getByRole("button", { name: "Add lesson" }).click();
    await page.getByLabel("Lesson title").fill("Finding the hook");
    await page.getByLabel("Bunny video id (optional)").fill("test-video-guid");
    await page
      .locator('textarea[name="body_md"]')
      .fill("# Hook\n\nGrab attention in **3 seconds**.");
    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByRole("heading", { name: "Hook" })).toBeVisible();
    await page.getByRole("button", { name: "Add lesson" }).click();
    await expect(page.getByText("Finding the hook")).toBeVisible();

    // Publish (the edit form then offers Unpublish), and the list shows it live.
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("button", { name: "Unpublish" })).toBeVisible();
    await page.goto("/admin/courses");
    await expect(
      page
        .locator("[data-slot=card]")
        .filter({ hasText: `Clipping 101 ${tag}` })
        .getByText("Published"),
    ).toBeVisible();
  });

  test("talent sees catalog, buys via webhook, learns and completes", async ({ page, request }) => {
    const tag = uniqueSuffix();
    const db = adminDb();
    const { data: skill } = await db.from("skills").select("id").eq("slug", "clipping").single();
    const { data: course } = await db
      .from("courses")
      .insert({
        slug: `clip-${tag}`,
        title: `Clipping ${tag}`,
        description: "Learn to clip.",
        price_cents: 1200,
        skill_id: skill!.id,
        lemon_variant_id: `var-${tag}`,
        published: true,
      })
      .select("id")
      .single();
    cleanup.courseId = course!.id;
    const { data: lessons } = await db
      .from("lessons")
      .insert([
        { course_id: course!.id, position: 1, title: "Finding the hook", body_md: "Hook fast." },
        { course_id: course!.id, position: 2, title: "Cutting", body_md: "Cut tight." },
      ])
      .select("id");

    const talent = await createTestUser({ onboarded: true });
    cleanup.users.push(talent.id);
    await logIn(page, talent.email);

    // Catalog + course page (not owned): syllabus visible, Buy button present.
    await page.goto("/app/learn");
    await expect(page.getByRole("heading", { name: `Clipping ${tag}` })).toBeVisible();
    await page.getByRole("link", { name: `Clipping ${tag}` }).click();
    await expect(page).toHaveURL(new RegExp(`/app/learn/clip-${tag}$`));
    await expect(page.getByText("Finding the hook")).toBeVisible();
    await expect(page.getByRole("button", { name: /Buy for \$12/ })).toBeVisible();

    // Bad webhook signature is rejected.
    const payload = JSON.stringify({
      meta: {
        event_name: "order_created",
        custom_data: { user_id: talent.id, course_id: course!.id },
      },
      data: { id: `order-${tag}`, attributes: { total: 1200 } },
    });
    const bad = await request.post("/api/webhooks/lemonsqueezy", {
      headers: { "x-signature": "deadbeef", "content-type": "application/json" },
      data: payload,
    });
    expect(bad.status()).toBe(401);

    // Valid signature grants access.
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET!;
    const sig = createHmac("sha256", secret).update(payload).digest("hex");
    const ok = await request.post("/api/webhooks/lemonsqueezy", {
      headers: { "x-signature": sig, "content-type": "application/json" },
      data: payload,
    });
    expect(ok.status()).toBe(200);
    // Idempotent: replaying the same order doesn't create a second access row.
    await request.post("/api/webhooks/lemonsqueezy", {
      headers: { "x-signature": sig, "content-type": "application/json" },
      data: payload,
    });
    const { count } = await db
      .from("course_access")
      .select("id", { count: "exact", head: true })
      .eq("user_id", talent.id)
      .eq("course_id", course!.id);
    expect(count).toBe(1);

    // Now owned: continue into the first lesson, mark complete, progress updates.
    await page.reload();
    await expect(page.getByText("Your progress")).toBeVisible();
    await page.getByRole("link", { name: /Start course/ }).click();
    await expect(page).toHaveURL(new RegExp(`/app/learn/clip-${tag}/${lessons![0].id}$`));
    await expect(page.getByText("Hook fast.")).toBeVisible();
    await page.getByRole("button", { name: "Mark complete" }).click();
    await expect(page.getByRole("button", { name: "Completed" })).toBeVisible();
    await page.getByRole("link", { name: /Next/ }).click();
    await expect(page).toHaveURL(new RegExp(`/${lessons![1].id}$`));

    // The completion write races the Next navigation, so poll the course page.
    await expect(async () => {
      await page.goto(`/app/learn/clip-${tag}`);
      await expect(page.getByText("1/2 lessons")).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });
  });
});
