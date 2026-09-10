import { ImageResponse } from "next/og";

// Generated favicon — a hanko (seal-stamp) mark: a vermillion circle with a
// thin washi-cream ring, and three shrinking bars suggesting lines of text.
// Drawn from plain shapes (no font dependency) so it renders identically
// everywhere and needs no external asset.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f2e7",
          borderRadius: 14,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "#c1440e",
            border: "3px solid #f7f2e7",
            boxShadow: "0 0 0 1.5px #c1440e",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
          }}
        >
          <div style={{ width: 22, height: 3, borderRadius: 2, background: "#f7f2e7" }} />
          <div style={{ width: 16, height: 3, borderRadius: 2, background: "#f7f2e7" }} />
          <div style={{ width: 10, height: 3, borderRadius: 2, background: "#f7f2e7" }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
