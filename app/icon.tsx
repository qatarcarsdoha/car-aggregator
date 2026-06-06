import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#c8553d",
          color: "#f5f1eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "ui-serif, Georgia, serif",
          fontWeight: 600,
          fontSize: 24,
          letterSpacing: "-0.04em",
          borderRadius: 6,
          lineHeight: 1,
        }}
      >
        Q
      </div>
    ),
    { ...size },
  );
}
