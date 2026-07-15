import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  additionalPrecacheEntries: [
    { url: "/app/loader", revision: "3" },
    { url: "/app/lobby", revision: "3" },
    { url: "/app/home", revision: "3" },
    { url: "/app/profile", revision: "3" },
    { url: "/app/friends", revision: "3" },
    { url: "/offline", revision: "3" },
    { url: "/assets/hero-arena.png", revision: "1" },
    { url: "/assets/loader-bg.png", revision: "1" },
  ],
});

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
      {
        source: "/app/match/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "credentialless",
          },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
