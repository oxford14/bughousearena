import {
  Home,
  Swords,
  Users,
  Castle,
  Trophy,
  User,
  DoorOpen,
  BookOpen,
  Banknote,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";

export interface AppNavItem {
  href: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
}

export const appNavItems: AppNavItem[] = [
  { href: "/app/home", label: "Home", shortLabel: "Home", icon: Home },
  { href: "/app/lobby", label: "Arena", shortLabel: "Arena", icon: Swords },
  { href: "/app/chat", label: "World Chat", shortLabel: "Chat", icon: MessagesSquare },
  { href: "/app/tournaments", label: "Tournaments", shortLabel: "Events", icon: Trophy },
  { href: "/app/redeem", label: "Redeem", shortLabel: "Redeem", icon: Banknote },
  { href: "/app/private", label: "Private Room", shortLabel: "Private", icon: DoorOpen },
  { href: "/app/friends", label: "Friends", shortLabel: "Friends", icon: Users },
  { href: "/app/houses", label: "Houses", shortLabel: "Houses", icon: Castle },
  { href: "/app/leaderboards", label: "Leaderboards", shortLabel: "Ranks", icon: Trophy },
  { href: "/app/rules", label: "Rules", shortLabel: "Rules", icon: BookOpen },
  { href: "/app/profile", label: "Profile", shortLabel: "Profile", icon: User },
];
