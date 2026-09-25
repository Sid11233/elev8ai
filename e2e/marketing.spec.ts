import { expect, test } from "@playwright/test";

test.describe("public pages", () => {
  test("landing page loads and links to sign up", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Get paid for real work/ })).toBeVisible();
    await page.getByRole("link", { name: "Start earning" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("legal pages render", async ({ page }) => {
    for (const [path, heading] of [
      ["/terms", "Terms of Service"],
      ["/privacy", "Privacy Policy"],
      ["/contractor-agreement", "Independent Contractor Agreement"],
    ]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }
  });

  test("robots and sitemap are served", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBeTruthy();
    expect(await robots.text()).toContain("Sitemap");
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBeTruthy();
    expect(await sitemap.text()).toContain("<urlset");
  });
});
