import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  // GitHub Codespaces forwards the dev server through *.app.github.dev.
  allowedDevOrigins: ["*.app.github.dev"],
  experimental: {
    serverActions: {
      // Avatars are capped at 2 MB by the storage bucket; leave room for form overhead.
      bodySizeLimit: "3mb",
      allowedOrigins: isDev ? ["*.app.github.dev"] : [],
    },
  },
};

export default nextConfig;
