import { ImageResponse } from "next/og";

export const alt = "iFind — AI-powered internship matching for students in India";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Social-share card (also used as the Twitter card). Brand tokens are inlined because ImageResponse
// renders outside the app's CSS.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: "linear-gradient(135deg, #f4f5f7 0%, #eaf5fc 100%)",
          color: "#1e2128",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: "#3daee9",
              color: "#fff",
              fontSize: 44,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            i
          </div>
          <div style={{ fontSize: 56, fontWeight: 800, display: "flex" }}>
            i<span style={{ color: "#3daee9" }}>Find</span>
          </div>
        </div>
        <div style={{ marginTop: 48, fontSize: 76, fontWeight: 800, lineHeight: 1.1, display: "flex", flexWrap: "wrap" }}>
          Find internships that match <span style={{ color: "#3daee9", marginLeft: 18 }}>your skills</span>
        </div>
        <div style={{ marginTop: 28, fontSize: 34, color: "#545a6b", display: "flex" }}>
          Upload your resume once. Get matched with verified roles across India.
        </div>
      </div>
    ),
    size,
  );
}
