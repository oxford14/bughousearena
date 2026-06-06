import type { Metadata } from "next";
import { RulesGuide } from "@/components/arena/rules-guide";

export const metadata: Metadata = {
  title: "Rules & How to Play — Bughouse Arena",
  description:
    "Complete guide to Bughouse chess: teams, drops, captures, restrictions, winning, and how to play on Bughouse Arena.",
};

export default function AppRulesPage() {
  return <RulesGuide embedded />;
}
