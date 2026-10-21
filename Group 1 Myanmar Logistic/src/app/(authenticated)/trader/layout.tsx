import { requireRole } from "@/lib/auth/session";
import { TraderShell } from "@/components/layout/trader-shell";
import { createClient } from "@/lib/supabase/server";

export default async function TraderLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole("trader");
  const supabase=await createClient();const unread=await supabase.from("alerts").select("id",{count:"exact",head:true}).eq("trader_id",profile.id).eq("is_read",false);
  return <TraderShell name={profile.full_name} unreadAlerts={unread.error?0:unread.count??0}>{children}</TraderShell>;
}
