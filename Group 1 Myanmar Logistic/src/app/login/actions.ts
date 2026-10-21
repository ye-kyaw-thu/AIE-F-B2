"use server";
import {profileDestination} from "@/lib/auth/destination";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, type LoginState } from "@/lib/auth/validation";
import { isUserRole } from "@/lib/auth/roles";

export async function login(_previous: LoginState, form: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  let destination = "/account/setup";
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error || !data.user) {
      return { message: "Unable to sign in. Check your email and password, or try again shortly." };
    }
    const { data: profile } = await supabase.from("profiles")
      .select("role,driver_access").eq("id", data.user.id).maybeSingle();
    if (profile && isUserRole(profile.role)) destination = profileDestination({...profile,role:profile.role});
  } catch {
    return { message: "The sign-in service is unavailable. Please try again shortly." };
  }
  revalidatePath("/", "layout");
  redirect(destination);
}

export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error("Sign-out failed. Please try again.");
  revalidatePath("/", "layout");
  redirect("/login");
}
