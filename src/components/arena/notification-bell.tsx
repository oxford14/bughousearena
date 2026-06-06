"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
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
import { subscribeToFriendRequests } from "@/lib/social/friends";
import { subscribeToPartyInvites } from "@/lib/social/party";
import type { FriendRequest, PartyInvite } from "@/types/firestore";
import { useSound } from "@/providers/sound-provider";

export function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const { play } = useSound();
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [partyInvites, setPartyInvites] = useState<PartyInvite[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsubFriends = subscribeToFriendRequests(user.uid, setFriendRequests);
    const unsubParty = subscribeToPartyInvites(user.uid, setPartyInvites);
    return () => {
      unsubFriends();
      unsubParty();
    };
  }, [user]);

  const count = friendRequests.length + partyInvites.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={`Notifications${count > 0 ? `, ${count} unread` : ""}`}
        onClick={() => play("uiClick")}
      >
        <Bell className="h-5 w-5" />
        {count > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {count === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">No new notifications</p>
        ) : (
          <>
            <DropdownMenuGroup>
              {partyInvites.map((invite) => (
                <DropdownMenuItem
                  key={`party-${invite.id}`}
                  className="cursor-pointer flex-col items-start gap-0.5 py-2"
                  onClick={() => {
                    play("uiNav");
                    router.push("/app/lobby");
                  }}
                >
                  <span className="font-medium">Party invite</span>
                  <span className="text-xs text-muted-foreground">
                    From {invite.fromDisplayName}
                  </span>
                </DropdownMenuItem>
              ))}
              {friendRequests.map((req) => (
                <DropdownMenuItem
                  key={`friend-${req.id}`}
                  className="cursor-pointer flex-col items-start gap-0.5 py-2"
                  onClick={() => {
                    play("uiNav");
                    router.push("/app/friends");
                  }}
                >
                  <span className="font-medium">Friend request</span>
                  <span className="text-xs text-muted-foreground">
                    From {req.fromDisplayName}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="cursor-pointer justify-center text-primary"
                onClick={() => {
                  play("uiNav");
                  router.push("/app/friends");
                }}
              >
                View all
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
