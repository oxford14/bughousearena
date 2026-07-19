import {
  LayoutDashboard,
  Users,
  Banknote,
  Receipt,
  Trophy,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
}

export const adminNavItems: AdminNavItem[] = [
  { href: "/app/superadmin", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard },
  { href: "/app/superadmin/players", label: "Players", shortLabel: "Players", icon: Users },
  { href: "/app/superadmin/withdrawals", label: "Withdrawals", shortLabel: "Payouts", icon: Banknote },
  { href: "/app/superadmin/transactions", label: "Transactions", shortLabel: "Ledger", icon: Receipt },
  { href: "/app/superadmin/tournaments", label: "Tournaments", shortLabel: "Events", icon: Trophy },
];
