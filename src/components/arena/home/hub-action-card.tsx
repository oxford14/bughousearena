"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface HubActionCardProps {
  label: string;
  iconSrc: string;
  onClick?: () => void;
  variant?: "shop" | "events" | "default";
  badge?: string;
  disabled?: boolean;
  className?: string;
}

export function HubActionCard({
  label,
  iconSrc,
  onClick,
  variant = "default",
  badge,
  disabled,
  className,
}: HubActionCardProps) {
  const variantClass =
    variant === "shop"
      ? "home-hub-card--shop"
      : variant === "events"
        ? "home-hub-card--events home-events-soon"
        : "home-hub-card--default";

  const content = (
    <>
      {badge && (
        <span className="home-hub-card__badge absolute right-2 top-2 rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          {badge}
        </span>
      )}
      <div className="home-hub-card__icon relative mx-auto mb-2 flex h-14 w-14 items-center justify-center">
        <Image src={iconSrc} alt="" width={56} height={56} className="h-12 w-12 drop-shadow-[0_0_10px_rgba(124,58,237,0.4)]" />
      </div>
      <p className="font-heading text-sm uppercase tracking-wider text-foreground">{label}</p>
    </>
  );

  const cardClass = cn(
    "home-hub-card relative flex flex-col items-center justify-center rounded-2xl border p-4 text-center transition-all",
    variantClass,
    disabled ? "cursor-default opacity-75" : "cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
    className
  );

  return (
    <motion.button
      type="button"
      className={cardClass}
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
    >
      {content}
    </motion.button>
  );
}
