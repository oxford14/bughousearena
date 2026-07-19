"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
import { cn } from "@/lib/utils";
import { adminNavItems } from "@/lib/admin/admin-nav-items";
import { NotificationBell } from "@/components/arena/notification-bell";
import { ProfileMenu } from "@/components/arena/profile-menu";
import { useIsMobile } from "@/hooks/use-mobile";

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/app/superadmin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AdminDesktopSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" className="border-r border-primary/20">
      <SidebarHeader className="border-b border-primary/20 p-4 group-data-[collapsible=icon]:p-2">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <ShieldCheck className="h-6 w-6 shrink-0 text-primary" />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="font-heading text-sm neon-glow truncate">Super Admin</p>
            <p className="text-xs text-muted-foreground truncate">Console</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={isActivePath(pathname, item.href)}
                    tooltip={item.label}
                    render={<Link href={item.href} className="cursor-pointer" />}
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
      <SidebarFooter className="border-t border-primary/20">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Back to app"
              render={<Link href="/app/home" className="cursor-pointer" />}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to app</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function AdminDesktopSidebarGate() {
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || isMobile) return null;
  return <AdminDesktopSidebar />;
}

function AdminBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-primary/20 bg-background/95 backdrop-blur-md md:hidden"
      aria-label="Super admin navigation"
    >
      <ul className="flex items-stretch justify-around px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
        {adminNavItems.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href} className="flex-1 min-w-0">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 text-[10px] font-medium transition-colors cursor-pointer",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    active && "drop-shadow-[0_0_6px_rgba(124,58,237,0.6)]"
                  )}
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

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <AdminDesktopSidebarGate />
      <main className="flex min-h-svh flex-1 flex-col md:min-h-screen">
        <header className="flex items-center gap-4 border-b border-primary/20 px-4 py-3">
          <SidebarTrigger className="hidden cursor-pointer md:inline-flex" />
          <div className="flex min-w-0 flex-1 items-center gap-2 md:hidden">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
            <span className="font-heading truncate text-sm neon-glow">
              Super Admin
            </span>
          </div>
          <div className="hidden flex-1 md:block" />
          <div className="flex shrink-0 items-center gap-1">
            <Link
              href="/app/home"
              className="mr-1 hidden items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground md:inline-flex cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to app
            </Link>
            <NotificationBell />
            <ProfileMenu />
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 pb-24 md:p-6 md:pb-6">
          {children}
        </div>
      </main>
      <AdminBottomNav />
    </SidebarProvider>
  );
}
