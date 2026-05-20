import { ImageResponse } from "next/og";

/**
 * Dynamic favicon / app icon.
 *
 * Brand placeholder until designer ships real wordmark — "MW" on
 * Violet Pulse. Generated at build / first-request, served as PNG.
 */

export const size = { width: 256, height: 256 };
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
          background: "#5C33FF",
          color: "#FFFFFF",
          fontSize: 128,
          fontWeight: 700,
          fontFamily: "system-ui, -apple-system, sans-serif",
          letterSpacing: -4,
        }}
      >
        MW
      </div>
    ),
    { ...size },
  );
}
