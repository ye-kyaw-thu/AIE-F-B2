"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { shipmentRequestSchema, emptyRequest, type RequestFormState } from "@/lib/shipments/validation";

function mutationMessage(code: string) {
  if (code === "PT409") return "This request changed while you were editing. Open the latest version and try again.";
  if (code === "PT422") return "This shipment is no longer awaiting approval and cannot be edited.";
  if (code === "42501") return "You don’t have access to change this request.";
  if (["22023", "23514", "23503"].includes(code)) return "Check the request fields, pickup date and border gate, then try again.";
  return "We couldn’t save the request. Please try again.";
}

async function saveRequest(form: FormData, edit?: { id: string; updatedAt: string }): Promise<RequestFormState> {
  await requireRole("trader");
  const fields = Object.fromEntries(Object.keys(emptyRequest).map(key => [key, form.get(key)]));
  const parsed = shipmentRequestSchema.safeParse(fields);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, message: "Please check the highlighted fields." };
  if (edit && (!z.uuid().safeParse(edit.id).success || !z.iso.datetime({ offset: true }).safeParse(edit.updatedAt).success)) {
    return { message: "This request link is invalid. Reopen the shipment and try again." };
  }
  let id: string;
  try {
    const supabase = await createClient();
    const result = edit
      ? await supabase.rpc("edit_requested_shipment", { p_shipment_id: edit.id, p_expected_updated_at: edit.updatedAt, p_input: parsed.data })
      : await supabase.rpc("create_shipment", { p_input: parsed.data });
    if (result.error || !result.data) return { message: mutationMessage(result.error?.code ?? "") };
    id = result.data;
  } catch {
    return { message: "The connection was interrupted. Check your shipment list before submitting again." };
  }
  revalidatePath("/trader/dashboard");
  revalidatePath("/trader/shipments");
  revalidatePath(`/trader/shipments/${id}`);
  revalidatePath("/admin/dashboard");
  redirect(`/trader/shipments/${id}?saved=${edit ? "updated" : "created"}`);
}

export async function createRequest(_state: RequestFormState, form: FormData) {
  return saveRequest(form);
}

export async function editRequest(id: string, updatedAt: string, _state: RequestFormState, form: FormData) {
  return saveRequest(form, { id, updatedAt });
}
