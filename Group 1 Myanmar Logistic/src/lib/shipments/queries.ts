import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function getTraderShipment(id: string) {
  const profile = await requireRole("trader");
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.from("shipments")
    .select("*,gate_statuses(id,gate_name,status,reason)")
    .eq("id", id).eq("trader_id", profile.id).maybeSingle();
  if (error) throw new Error("We couldn’t load the shipment. Please try again.");
  if (!data) notFound();
  return data;
}

export async function getRequestGates() {
  await requireRole("trader");
  const supabase = await createClient();
  const { data, error } = await supabase.from("gate_statuses").select("id,gate_name,status,reason").order("gate_name");
  if (error) throw new Error("We couldn’t load border gates. Please try again.");
  return data;
}

export function formatDate(value: string, withTime = false) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Yangon", day: "numeric", month: "short", year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } as const : {}),
  }).format(new Date(value.length === 10 ? `${value}T00:00:00+06:30` : value));
}
