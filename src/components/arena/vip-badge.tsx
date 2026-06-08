import { cn } from "@/lib/utils";
import { VIP_TIERS, vipBadgeTone } from "@/lib/shop/vip-tiers";

interface VipBadgeProps {
  vipLevel: number;
  className?: string;
  compact?: boolean;
}

export function VipBadge({ vipLevel, className, compact = false }: VipBadgeProps) {
  if (vipLevel <= 0) return null;

  const tier = VIP_TIERS.find((t) => t.level === vipLevel) ?? VIP_TIERS[1]!;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide shrink-0",
        vipBadgeTone(vipLevel),
        className
      )}
      title={tier.name}
    >
      {compact ? `V${vipLevel}` : tier.shortLabel}
    </span>
  );
}
