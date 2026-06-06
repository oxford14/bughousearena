import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/arena/app-sidebar";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}
