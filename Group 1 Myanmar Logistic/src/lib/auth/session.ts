import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUserRole, ROLE_HOME } from "./roles";
import {profileDestination} from "./destination";
import type { UserRole } from "@/types/domain";

// React cache deduplicates within a render, never across users or requests.
export const getIdentity = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

export const getProfile = cache(async () => {
  const user = await getIdentity();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles")
    .select("id,full_name,email,role,driver_access").eq("id", user.id).maybeSingle();
  if (error || !data || !isUserRole(data.role)) return null;
  return data;
});

export async function requireProfile() {
  if (!(await getIdentity())) redirect("/login");
  const profile = await getProfile();
  if (!profile) redirect("/account/setup");
  if(profile.role==="driver"&&profile.driver_access!=="active")redirect(profileDestination(profile));
  return profile;
}

export async function requireRole(role: UserRole) {
  const profile = await requireProfile();
  if (profile.role !== role) redirect(ROLE_HOME[profile.role]);
  return profile;
}
