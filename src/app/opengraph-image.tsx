import { ImageResponse } from "next/og";

// Render on request rather than at build (next/og can't prerender here).
export const dynamic = "force-dynamic";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "lockedinnn — Level up, get paid!";

// Generated Open Graph image: parchment background, cosmic-red accent.
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#faf7f0",
          color: "#221c1a",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "#7a1f2b" }}>
          lockedinnn
        </div>
        <div
          style={{ marginTop: 28, fontSize: 92, fontWeight: 800, lineHeight: 1.05, maxWidth: 1000 }}
        >
          Level up,
        </div>
        <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1.05, color: "#7a1f2b" }}>
          get paid!
        </div>
        <div style={{ marginTop: 40, fontSize: 30, color: "#8a7f77" }}>
          Paid micro-jobs and courses for ambitious 18+ talent.
        </div>
      </div>
    ),
    size,
  );
}
