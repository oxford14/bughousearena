"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { appNavItems } from "@/lib/nav-items";
import { useSound } from "@/providers/sound-provider";

export function AppBottomNav() {
  const pathname = usePathname();
  const { play, unlock } = useSound();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-primary/20 bg-background/95 backdrop-blur-md md:hidden"
      aria-label="Main navigation"
    >
      <ul className="flex items-stretch justify-around px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
        {appNavItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <li key={item.href} className="flex-1 min-w-0">
              <Link
                href={item.href}
                onClick={() => {
                  unlock();
                  play("uiNav");
                }}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 text-[10px] font-medium transition-colors cursor-pointer",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon
                  className={cn("h-5 w-5 shrink-0", isActive && "drop-shadow-[0_0_6px_rgba(124,58,237,0.6)]")}
                />
                <span className="truncate w-full text-center">
                  {item.shortLabel ?? item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
