import type { MetadataRoute } from "next";

function baseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // Keep the app and admin areas out of search results.
      allow: ["/"],
      disallow: ["/app/", "/admin/", "/api/", "/onboarding", "/login", "/auth/"],
    },
    sitemap: `${baseUrl()}/sitemap.xml`,
  };
}
