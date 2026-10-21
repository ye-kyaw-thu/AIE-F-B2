import type { GatePreview, ShipmentPreview } from "@/types/domain";

// Illustrative fixtures, not seeded database records or live gate reports.
export const previewGates: GatePreview[] = [
  { id: "muse", name: "Muse", connection: "Myanmar / China", status: "open" },
  { id: "myawaddy", name: "Myawaddy", connection: "Myanmar / Thailand", status: "open" },
];

export const previewShipments: ShipmentPreview[] = [
  { id: "preview-1", shipmentNumber: "MMT-000001", origin: "Yangon", destination: "Muse", cargo: "Agricultural goods", quantity: "12 tonnes", driver: "Ko Aung Min", gateId: "muse", status: "in_transit" },
  { id: "preview-2", shipmentNumber: "MMT-000002", origin: "Yangon", destination: "Myawaddy", cargo: "Consumer goods", quantity: "8 tonnes", driver: null, gateId: "myawaddy", status: "requested" },
  { id: "preview-3", shipmentNumber: "MMT-000003", origin: "Mandalay", destination: "Muse", cargo: "Textiles", quantity: "5 tonnes", driver: "Ko Aung Min", gateId: "muse", status: "customs" },
];
