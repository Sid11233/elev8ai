import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  // GitHub Codespaces forwards the dev server through *.app.github.dev.
  allowedDevOrigins: ["*.app.github.dev"],
  experimental: {
    serverActions: {
      // Avatars are capped at 2 MB by the storage bucket; leave room for form overhead.
      bodySizeLimit: "3mb",
      // In Codespaces the browser may be on localhost (VS Code forwarding) or on
      // *.app.github.dev while the forwarded host is always the latter.
      allowedOrigins: isDev ? ["*.app.github.dev", "localhost:3000"] : [],
    },
  },
};

export default nextConfig;
