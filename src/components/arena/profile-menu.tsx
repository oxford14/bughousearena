"use client";

import { useRouter } from "next/navigation";
import { KeyRound, LogOut, User, BookOpen } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/providers/auth-provider";
import { logOut } from "@/lib/firebase/auth";
import { getRankLabel, getRankTier } from "@/lib/game/elo";
import { useSound } from "@/providers/sound-provider";

function profileInitials(name: string | undefined): string {
  if (!name) return "P";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function ProfileMenu() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { play } = useSound();

  const displayName = profile?.displayName ?? user?.displayName ?? "Player";
  const photoURL = profile?.photoURL ?? user?.photoURL ?? undefined;
  const tier = profile ? getRankTier(profile.rating) : "pawn";

  const handleLogout = async () => {
    play("uiTab");
    await logOut();
    router.push("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full ring-2 ring-primary/35 transition-shadow hover:ring-primary/60 focus-visible:outline-none focus-visible:ring-primary"
        aria-label="Account menu"
      >
        <Avatar className="h-9 w-9 after:hidden">
          <AvatarImage src={photoURL} alt={displayName} />
          <AvatarFallback className="bg-gradient-to-br from-primary/80 to-accent/80 text-xs font-semibold text-primary-foreground">
            {profileInitials(displayName)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <p className="truncate font-medium text-foreground">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {profile?.email ?? user?.email ?? getRankLabel(tier)}
            </p>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => {
              play("uiNav");
              router.push("/app/profile");
            }}
          >
            <User />
            View profile
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => {
              play("uiNav");
              router.push("/app/rules");
            }}
          >
            <BookOpen />
            Rules & how to play
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => {
              play("uiNav");
              router.push("/app/profile#security");
            }}
          >
            <KeyRound />
            Change password
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            className="cursor-pointer"
            onClick={() => void handleLogout()}
          >
            <LogOut />
            Log out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
