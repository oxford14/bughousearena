export interface VipTier {
  level: number;
  name: string;
  shortLabel: string;
  minTopUpCentavos: number;
}

/** VIP tiers — based on lifetime real-money top-up (PHP centavos). */
export const VIP_TIERS: VipTier[] = [
  { level: 0, name: "Member", shortLabel: "Member", minTopUpCentavos: 0 },
  { level: 1, name: "Bronze VIP", shortLabel: "VIP 1", minTopUpCentavos: 2_900 },
  { level: 2, name: "Silver VIP", shortLabel: "VIP 2", minTopUpCentavos: 9_900 },
  { level: 3, name: "Gold VIP", shortLabel: "VIP 3", minTopUpCentavos: 39_900 },
  { level: 4, name: "Platinum VIP", shortLabel: "VIP 4", minTopUpCentavos: 79_900 },
  { level: 5, name: "Diamond VIP", shortLabel: "VIP 5", minTopUpCentavos: 149_900 },
  { level: 6, name: "Legend VIP", shortLabel: "VIP 6", minTopUpCentavos: 300_000 },
];

export function getVipTier(totalTopUpCentavos: number): VipTier {
  const safe = Math.max(0, Math.floor(totalTopUpCentavos));
  let tier = VIP_TIERS[0]!;
  for (const candidate of VIP_TIERS) {
    if (safe >= candidate.minTopUpCentavos) {
      tier = candidate;
    }
  }
  return tier;
}

export function getVipLevel(totalTopUpCentavos: number): number {
  return getVipTier(totalTopUpCentavos).level;
}

export function getVipLevelFromTopUp(totalTopUpCentavos?: number | null): number {
  return getVipLevel(totalTopUpCentavos ?? 0);
}

export function getNextVipTier(totalTopUpCentavos: number): VipTier | null {
  const current = getVipLevel(totalTopUpCentavos);
  return VIP_TIERS.find((t) => t.level === current + 1) ?? null;
}

export function vipBadgeTone(level: number): string {
  switch (level) {
    case 1:
      return "bg-amber-900/50 text-amber-200 border-amber-700/50";
    case 2:
      return "bg-slate-500/30 text-slate-100 border-slate-400/40";
    case 3:
      return "bg-yellow-600/35 text-yellow-100 border-yellow-500/45";
    case 4:
      return "bg-cyan-900/40 text-cyan-100 border-cyan-500/40";
    case 5:
      return "bg-violet-900/45 text-violet-100 border-violet-400/45";
    case 6:
      return "bg-gradient-to-r from-amber-500/40 to-rose-500/40 text-amber-50 border-amber-300/50";
    default:
      return "bg-muted/40 text-muted-foreground border-border/50";
  }
}
