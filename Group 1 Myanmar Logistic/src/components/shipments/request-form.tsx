"use client";
import {T} from "@/components/i18n/language-provider";
import {Input,Textarea} from "@/components/i18n/fields";


import Link from "next/link";
import { useActionState, useState } from "react";
import { createRequest, editRequest } from "@/app/(authenticated)/trader/shipments/actions";
import { emptyRequest, type RequestFields, type RequestFormState } from "@/lib/shipments/validation";
import type { Database } from "@/types/database";

type Gate = Pick<Database["public"]["Tables"]["gate_statuses"]["Row"], "id" | "gate_name" | "status" | "reason">;
type Props = { gates: Gate[]; today: string; initial?: RequestFields; edit?: { id: string; updatedAt: string } };

export function RequestForm({ gates, today, initial, edit }: Props) {
  const [values, setValues] = useState<RequestFields>(initial ?? { ...emptyRequest, pickup_date: today });
  // Controlled fields retain their initial draft across refreshes; retain the
  // matching revision and action too, so a concurrent edit cannot be overwritten.
  const [action] = useState(() => edit ? editRequest.bind(null, edit.id, edit.updatedAt) : createRequest);
  const [state, formAction, pending] = useActionState<RequestFormState, FormData>(action, {});
  const selectedGate = gates.find(gate => gate.id === values.route_gate_id);
  const cancelHref = edit ? `/trader/shipments/${edit.id}` : "/trader/shipments";
  const set = (key: keyof RequestFields, value: string) => setValues(previous => ({ ...previous, [key]: value }));
  const fieldProps = (key: keyof RequestFields) => ({
    id: key, name: key, value: values[key],
    "aria-invalid": !!state.errors?.[key], "aria-describedby": state.errors?.[key] ? `${key}-error` : undefined,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(key, event.target.value),
  });
  const error = (key: keyof RequestFields) => state.errors?.[key] && <p className="field-error" id={`${key}-error`}><T>{state.errors[key]?.[0]}</T></p>;

  return <form action={formAction} className="shipment-form">
    <fieldset disabled={pending || gates.length === 0}>
      <legend><T>Route & pickup</T></legend>
      <div className="form-grid">
        <div className="form-field"><label htmlFor="origin"><T>Origin </T><span>*</span></label><Input {...fieldProps("origin")} required maxLength={160} placeholder="e.g. Yangon" list="myanmar-locations" />{error("origin")}</div>
        <div className="form-field"><label htmlFor="destination"><T>Destination </T><span>*</span></label><Input {...fieldProps("destination")} required maxLength={160} placeholder="e.g. Muse" list="myanmar-locations" />{error("destination")}</div>
        <div className="form-field"><label htmlFor="pickup_date"><T>Pickup date </T><span>*</span></label><Input {...fieldProps("pickup_date")} type="date" required min={today} /><small><T>Dates use Myanmar local time.</T></small>{error("pickup_date")}</div>
        <div className="form-field"><label htmlFor="route_gate_id"><T>Border gate / route </T><span>*</span></label><select {...fieldProps("route_gate_id")} required><option value=""><T>Select a border gate</T></option>{gates.map(gate => <option key={gate.id} value={gate.id}>{gate.gate_name} — <T>{gate.status}</T></option>)}</select>{error("route_gate_id")}</div>
      </div>
      <datalist id="myanmar-locations"><option value="Yangon" /><option value="Mandalay" /><option value="Muse" /><option value="Myawaddy" /></datalist>
      {selectedGate && selectedGate.status !== "open" && <div className="gate-warning" role="status">{selectedGate.gate_name}<T> Gate is </T><T>{selectedGate.status}</T>. {selectedGate.reason}<T> You can submit a request for admin review.</T></div>}
    </fieldset>
    <fieldset disabled={pending || gates.length === 0}>
      <legend><T>Cargo details</T></legend>
      <div className="form-grid">
        <div className="form-field span-two"><label htmlFor="cargo_type"><T>Cargo type </T><span>*</span></label><Input {...fieldProps("cargo_type")} required maxLength={80} list="cargo-types" placeholder="e.g. Agricultural goods" />{error("cargo_type")}</div>
        <datalist id="cargo-types"><option value="Agricultural goods" /><option value="Consumer goods" /><option value="Textiles" /><option value="Construction materials" /><option value="Machinery" /></datalist>
        <div className="form-field span-two"><label htmlFor="cargo_description"><T>Cargo description </T><span>*</span></label><Textarea {...fieldProps("cargo_description")} required maxLength={2000} rows={4} placeholder="Describe the goods, packaging and handling requirements." />{error("cargo_description")}</div>
        <div className="form-field"><label htmlFor="quantity"><T>Quantity </T><span>*</span></label><Input {...fieldProps("quantity")} required type="number" inputMode="decimal" min="0.01" max="9999999999.99" step="0.01" placeholder="12" />{error("quantity")}</div>
        <div className="form-field"><label htmlFor="quantity_unit"><T>Unit </T><span>*</span></label><select {...fieldProps("quantity_unit")}><option value="tonnes"><T>Tonnes</T></option><option value="kg"><T>Kilograms</T></option><option value="packages"><T>Packages</T></option></select>{error("quantity_unit")}</div>
        <div className="form-field span-two"><label htmlFor="special_notes"><T>Special notes </T><small><T>Optional</T></small></label><Textarea {...fieldProps("special_notes")} maxLength={2000} rows={3} placeholder="Contact instructions or anything else the team should know." />{error("special_notes")}</div>
      </div>
    </fieldset>
    {gates.length === 0 && <p className="auth-error" role="alert"><T>No border gates are available. Contact your administrator before submitting a request.</T></p>}
    <div aria-live="polite" aria-atomic="true">{state.message && <p className="auth-error" role="alert"><T>{state.message}</T> {edit && <Link href={cancelHref}><T>Open latest shipment</T></Link>}</p>}</div>
    <div className="form-actions"><Link className="button signout-button" href={cancelHref}><T>Cancel</T></Link><button type="submit" disabled={pending || gates.length === 0} className="button button-dark"><T>{pending ? "Saving request…" : edit ? "Save changes" : "Submit transport request"}</T></button></div>
    <p className="form-help"><T>{edit ? "You can edit this request until it is approved." : "Your request will be sent to the operations team for approval and driver assignment."}</T></p>
  </form>;
}
