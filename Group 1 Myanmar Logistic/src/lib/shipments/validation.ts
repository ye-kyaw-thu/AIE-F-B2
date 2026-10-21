import { z } from "zod";

export function myanmarToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Yangon", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export const shipmentRequestSchema = z.object({
  origin: z.string().trim().min(1, "Enter an origin.").max(160),
  destination: z.string().trim().min(1, "Enter a destination.").max(160),
  cargo_type: z.string().trim().min(1, "Enter a cargo type.").max(80),
  cargo_description: z.string().trim().min(1, "Describe your cargo.").max(2000),
  quantity: z.string().regex(/^\d+(\.\d{1,2})?$/, "Use a positive number with up to two decimal places.")
    .transform(Number).pipe(z.number().positive("Quantity must be greater than zero.").max(9999999999.99)),
  quantity_unit: z.enum(["tonnes", "kg", "packages"]),
  pickup_date: z.iso.date("Choose a valid pickup date.")
    .refine(value => value >= myanmarToday(), "Pickup date cannot be in the past in Myanmar."),
  route_gate_id: z.uuid("Choose a border gate."),
  special_notes: z.string().trim().max(2000),
}).refine(value => value.origin.toLowerCase() !== value.destination.toLowerCase(), {
  message: "Destination must differ from origin.", path: ["destination"],
});

export type RequestFields = z.input<typeof shipmentRequestSchema>;
export type RequestFormState = { message?: string; errors?: Partial<Record<keyof RequestFields, string[]>> };

export const emptyRequest: RequestFields = {
  origin: "", destination: "", cargo_type: "", cargo_description: "", quantity: "",
  quantity_unit: "tonnes", pickup_date: "", route_gate_id: "", special_notes: "",
};
