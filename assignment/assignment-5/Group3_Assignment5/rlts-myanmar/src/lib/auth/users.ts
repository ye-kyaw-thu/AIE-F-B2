import type { Role } from "@/lib/types";

/**
 * DEMO credentials only — plaintext, hardcoded, no hashing, no server. This is
 * deliberately not production auth; it exists to satisfy the assignment's RBAC
 * requirement (README.md #1) for a 3-day prototype with three known roles. Wiring this
 * to real Supabase Auth (email/password or magic link) against the `logistics_admin` /
 * `cargo_trader` / `truck_driver` roles already present in supabase/schema.sql is the
 * natural next step once the Supabase backend (src/lib/store/supabaseAdapter.ts) is
 * wired in — see README.md "Next steps for the team".
 */
export interface DemoUser {
  username: string;
  password: string;
  role: Role;
  displayName: string;
}

export const DEMO_USERS: DemoUser[] = [
  { username: "admin", password: "admin123", role: "logistics_admin", displayName: "Dispatch Admin" },
  { username: "clerk", password: "clerk123", role: "data_entry_clerk", displayName: "Data Entry Clerk" },
  { username: "trader", password: "trader123", role: "cargo_trader", displayName: "Golden Land Trading Co." },
  { username: "trader2", password: "trader123", role: "cargo_trader", displayName: "Irrawaddy Exports Ltd." },
  { username: "driver", password: "driver123", role: "truck_driver", displayName: "U Aung Ko" },
  { username: "driver2", password: "driver123", role: "truck_driver", displayName: "Daw Hla Hla Win" },
];

export const ROLE_HOME: Record<Role, string> = {
  logistics_admin: "/admin",
  data_entry_clerk: "/clerk",
  cargo_trader: "/trader",
  truck_driver: "/driver",
};

export const ROLE_LABEL: Record<Role, string> = {
  logistics_admin: "Admin / Dispatcher",
  data_entry_clerk: "Data Entry Clerk",
  cargo_trader: "Trader",
  truck_driver: "Driver",
};

export function usersByRole(role: Role): DemoUser[] {
  return DEMO_USERS.filter((u) => u.role === role);
}
