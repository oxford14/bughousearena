const DEFAULT_SUPER_ADMIN_EMAILS = ["oxfordgalawan@gmail.com"];

/**
 * Email allowlist for super admins. Used as a bootstrap so super-admin gating
 * works even before the `superAdmin` custom claim has propagated to a token.
 * Configure via SUPER_ADMIN_EMAILS (comma-separated).
 */
export function getSuperAdminEmails(): string[] {
  const fromEnv = process.env.SUPER_ADMIN_EMAILS;
  const list = fromEnv
    ? fromEnv.split(",").map((e) => e.trim()).filter(Boolean)
    : DEFAULT_SUPER_ADMIN_EMAILS;
  return list.map((e) => e.toLowerCase());
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getSuperAdminEmails().includes(email.toLowerCase());
}
