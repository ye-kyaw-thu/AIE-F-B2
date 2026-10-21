import type { UserRole } from "@/types/domain";

export const ROLE_HOME: Record<UserRole, string> = {
  admin: "/admin/dashboard",
  trader: "/trader/dashboard",
  driver: "/driver/dashboard",
};

export function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "trader" || value === "driver";
}
