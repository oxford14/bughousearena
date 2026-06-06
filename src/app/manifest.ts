import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bughouse Arena",
    short_name: "Arena",
    description:
      "Competitive 4-player Bughouse Chess with ranked matches, houses, and voice chat.",
    start_url: "/app/loader",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0F0F23",
    theme_color: "#7C3AED",
    categories: ["games", "entertainment"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
