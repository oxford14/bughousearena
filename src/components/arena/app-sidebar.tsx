"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Swords } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAuth } from "@/providers/auth-provider";
import { getRankAssetPath, getRankLabel, getRankTier } from "@/lib/game/elo";
import { appNavItems } from "@/lib/nav-items";
import { AppBottomNav } from "@/components/arena/app-bottom-nav";
import { NotificationBell } from "@/components/arena/notification-bell";
import { ProfileMenu } from "@/components/arena/profile-menu";
import { SoundToggle } from "@/components/arena/sound-toggle";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSound } from "@/providers/sound-provider";

function DesktopSidebar() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const { play, unlock } = useSound();
  const tier = profile ? getRankTier(profile.rating) : "pawn";

  return (
    <Sidebar collapsible="icon" className="border-r border-primary/20">
      <SidebarHeader className="border-b border-primary/20 p-4 group-data-[collapsible=icon]:p-2">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <Swords className="h-6 w-6 shrink-0 text-primary" />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="font-heading text-sm neon-glow truncate">Bughouse Arena</p>
            {profile && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                <Image src={getRankAssetPath(tier)} alt="" width={14} height={14} />
                {getRankLabel(tier)} · {profile.rating}
              </p>
            )}
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigate</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {appNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    tooltip={item.label}
                    render={
                      <Link
                        href={item.href}
                        className="cursor-pointer"
                        onClick={() => {
                          unlock();
                          play("uiNav");
                        }}
                      />
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

function DesktopSidebarGate() {
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || isMobile) return null;
  return <DesktopSidebar />;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <DesktopSidebarGate />
      <main className="flex min-h-svh flex-1 flex-col md:min-h-screen">
        <header className="flex items-center gap-4 border-b border-primary/20 px-4 py-3">
          <SidebarTrigger className="hidden cursor-pointer md:inline-flex" />
          <div className="flex min-w-0 flex-1 items-center gap-2 md:hidden">
            <Swords className="h-5 w-5 shrink-0 text-primary" />
            <span className="font-heading truncate text-sm neon-glow">Bughouse Arena</span>
          </div>
          <div className="hidden flex-1 md:block" />
          <div className="flex shrink-0 items-center gap-1">
            <SoundToggle compact />
            <NotificationBell />
            <ProfileMenu />
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 pb-24 md:p-6 md:pb-6">{children}</div>
      </main>
      <AppBottomNav />
    </SidebarProvider>
  );
}
