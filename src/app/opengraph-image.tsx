import { ImageResponse } from "next/og";

// Render on request rather than at build (next/og can't prerender here).
export const dynamic = "force-dynamic";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Elev8ai — Get paid for real work. Learn skills that pay more.";

// Generated Open Graph image for link previews.
export default function OgImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        background: "#101a2e",
        color: "#ffffff",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 44, fontWeight: 700 }}>
        Elev8<span style={{ color: "#33d17a" }}>ai</span>
      </div>
      <div style={{ marginTop: 32, fontSize: 68, fontWeight: 800, lineHeight: 1.1, maxWidth: 900 }}>
        Get paid for real work.
      </div>
      <div
        style={{ marginTop: 8, fontSize: 68, fontWeight: 800, lineHeight: 1.1, color: "#33d17a" }}
      >
        Learn skills that pay more.
      </div>
      <div style={{ marginTop: 40, fontSize: 30, color: "#c7d0e0" }}>
        Paid micro-jobs and courses for ambitious 18+ talent.
      </div>
    </div>,
    size,
  );
}
