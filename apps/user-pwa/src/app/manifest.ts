import type { MetadataRoute } from "next";

/**
 * Web App Manifest — installable PWA for the user app.
 *
 * Brand: AutoGTG, Violet Pulse #5C33FF.
 * Favicon + apple-touch icon are the static `app/icon.png` / `app/apple-icon.png`
 * (AutoGTG car mark on Violet Pulse); installable icons live in `public/`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AutoGTG",
    short_name: "AutoGTG",
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
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
