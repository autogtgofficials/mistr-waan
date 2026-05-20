import { ImageResponse } from "next/og";

/**
 * Apple touch icon — 180×180 with rounded corners (iOS adds them anyway,
 * but rendering at full bleed avoids any inner padding artifact).
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#5C33FF",
          color: "#FFFFFF",
          fontSize: 92,
          fontWeight: 700,
          fontFamily: "system-ui, -apple-system, sans-serif",
          letterSpacing: -3,
        }}
      >
        MW
      </div>
    ),
    { ...size },
  );
}
