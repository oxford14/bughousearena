import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  additionalPrecacheEntries: [
    { url: "/app/loader", revision: "1" },
    { url: "/app/lobby", revision: "1" },
    { url: "/offline", revision: "1" },
    { url: "/assets/hero-arena.png", revision: "1" },
    { url: "/assets/loader-bg.png", revision: "1" },
  ],
});

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
};

export default withSerwist(nextConfig);
