import type { MetadataRoute } from "next";

/**
 * Web App Manifest — installable PWA for the user app.
 *
 * Brand: Mister Waan, Violet Pulse #5C33FF.
 * Icons are generated dynamically by `app/icon.tsx` and `app/apple-icon.tsx`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mister Waan",
    short_name: "Mister Waan",
    description:
      "Book vetted garages in Srinagar for repairs, detailing, and denting & painting. Pay safely, talk privately.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#5C33FF",
    orientation: "portrait",
    categories: ["lifestyle", "auto", "shopping"],
    lang: "en",
    dir: "ltr",
    scope: "/",
    icons: [
      {
        src: "/icon",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
