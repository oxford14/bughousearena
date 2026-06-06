"use client";

import { LandingHero, FeatureGrid, LandingFooter } from "@/components/arena/landing-hero";
import { LeaderboardPreview } from "@/components/arena/leaderboard-preview";
import { StandaloneRedirect } from "@/components/pwa/standalone-redirect";

export default function HomePage() {
  return (
    <>
      <StandaloneRedirect />
      <LandingHero />
      <FeatureGrid />
      <LeaderboardPreview />
      <LandingFooter />
    </>
  );
}
