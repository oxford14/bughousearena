import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const FRAME_STYLES: Record<string, string> = {
  frame_neon: "ring-2 ring-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.5)]",
  frame_gold: "ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.45)]",
};

export function getAvatarFrameClass(frameId: string | null | undefined): string {
  if (!frameId) return "";
  return FRAME_STYLES[frameId] ?? "";
}

export function AvatarFrameWrapper({
  frameId,
  className,
  children,
}: {
  frameId?: string | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("rounded-full", getAvatarFrameClass(frameId), className)}>
      {children}
    </div>
  );
}
