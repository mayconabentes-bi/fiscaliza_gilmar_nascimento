export const ALLOWED_ADMIN_PROFILES = ["ADMIN", "SUPER_ADMIN"] as const;

export type AdminProfile = typeof ALLOWED_ADMIN_PROFILES[number];

export function isAllowedAdminProfile(value: unknown): value is AdminProfile {
  return ALLOWED_ADMIN_PROFILES.includes(String(value || "") as AdminProfile);
}

export function normalizeAdminProfile(value: unknown): AdminProfile | null {
  const normalized = String(value || "");
  return isAllowedAdminProfile(normalized) ? normalized : null;
}
