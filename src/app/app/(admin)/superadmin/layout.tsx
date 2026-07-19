import { ProtectedRoute } from "@/components/auth/protected-route";
import { SuperAdminGuard } from "@/components/arena/admin/super-admin-guard";
import { AdminShell } from "@/components/arena/admin/admin-shell";

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <SuperAdminGuard>
        <AdminShell>{children}</AdminShell>
      </SuperAdminGuard>
    </ProtectedRoute>
  );
}
