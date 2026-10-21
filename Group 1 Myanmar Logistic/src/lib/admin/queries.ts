import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function getAdminShipment(id: string) {
  await requireRole("admin");
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.from("shipments").select("*,gate_statuses(id,gate_name,status,reason)").eq("id",id).maybeSingle();
  if (error) throw new Error("Could not load shipment. Refresh to retry.");
  if (!data) notFound();
  return data;
}
