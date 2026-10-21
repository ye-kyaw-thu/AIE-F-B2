"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { SHIPMENT_STATUSES } from "@/types/domain";

export type AdminFormState = { message?: string };
const revision = z.object({ id: z.uuid(), updatedAt: z.iso.datetime({ offset: true }) });
const operation = z.object({ action: z.enum(["assign","approve","status"]), driver: z.union([z.uuid(),z.literal("")]), status: z.enum(SHIPMENT_STATUSES), note: z.string().trim().max(1800) });
function errorMessage(code: string, message: string) {
  if (code === "PT409") return "This record changed. Reload the page before saving again.";
  if (["PT422","22023"].includes(code)) return message;
  if (code === "42501") return "Administrator access is required.";
  if (code === "PT404") return "This record is no longer available.";
  return "Could not save. Refresh the page and try again.";
}
export async function manageShipment(_state: AdminFormState, form: FormData): Promise<AdminFormState> {
  await requireRole("admin");
  const record = revision.safeParse({ id: form.get("record_id"), updatedAt: form.get("revision") });
  if (!record.success) return { message: "Invalid shipment reference. Reload the page." };
  const {id,updatedAt} = record.data;
  const fields = operation.safeParse({ action: form.get("operation"), driver: form.get("driver") ?? "", status: form.get("status") ?? "approved", note: form.get("note") ?? "" });
  if (!revision.safeParse({id,updatedAt}).success || !fields.success) return { message: "Check the driver, status and note, then try again." };
  const value = fields.data;
  if (value.action === "assign" && !value.driver) return { message: "Choose a driver before assigning." };
  if (value.action === "status" && !value.note) return { message: "Enter a reason for the status correction." };
  try {
    const supabase = await createClient();
    const result = await supabase.rpc("manage_shipment", { p_id:id, p_expected_updated_at:updatedAt, p_action:value.action, p_driver_id:value.driver || null, p_status:value.status, p_note:value.note });
    if (result.error) return { message:errorMessage(result.error.code,result.error.message) };
  } catch { return { message: "Connection interrupted. Reload the shipment to check whether the change was saved." }; }
  for (const path of ["/admin/dashboard","/admin/shipments",`/admin/shipments/${id}`,"/trader/dashboard","/trader/shipments",`/trader/shipments/${id}`,"/driver/dashboard"]) revalidatePath(path);
  redirect(`/admin/shipments/${id}?saved=1`);
}
export async function changeGate(_state: AdminFormState, form: FormData): Promise<AdminFormState> {
  await requireRole("admin");
  const record = revision.safeParse({ id: form.get("record_id"), updatedAt: form.get("revision") });
  if (!record.success) return { message: "Invalid gate reference. Reload the page." };
  const {id,updatedAt} = record.data;
  const parsed = z.object({ status:z.enum(["open","delayed","closed"]), reason:z.string().trim().max(1000) }).safeParse({ status:form.get("status"), reason:form.get("reason") });
  if (!revision.safeParse({id,updatedAt}).success || !parsed.success) return { message:"Choose a status and keep the reason within 1000 characters." };
  if (parsed.data.status !== "open" && !parsed.data.reason) return { message:"Enter a reason for the delay or closure." };
  try {
    const supabase = await createClient();
    const result = await supabase.rpc("change_gate_status", { p_id:id,p_expected_updated_at:updatedAt,p_status:parsed.data.status,p_reason:parsed.data.reason });
    if (result.error) return { message:errorMessage(result.error.code,result.error.message) };
  } catch { return { message:"Connection interrupted. Reload gates to check whether the change was saved." }; }
  revalidatePath("/admin", "layout"); revalidatePath("/trader", "layout");
  redirect("/admin/gates?saved=1");
}
