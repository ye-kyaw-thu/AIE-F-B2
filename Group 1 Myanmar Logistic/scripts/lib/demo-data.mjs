export const DEMO_PASSWORD = 'Demo-Myanmar!2026-Only';
export const DEMO_MARKER = 'myanmar-logistics-assignment5';
export const demoAccounts = [
  { email: 'admin@demo.com', name: 'Daw May Thu', role: 'admin' },
  { email: 'trader@demo.com', name: 'U Htet Aung', role: 'trader' },
  { email: 'driver@demo.com', name: 'Ko Aung Min', role: 'driver' },
  { email: 'trader2@demo.com', name: 'Isolation Test Trader', role: 'trader' },
  { email: 'driver2@demo.com', name: 'Isolation Test Driver', role: 'driver' },
];
export const shipmentIds = [1, 2, 3, 4].map(n => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
export const museId = '10000000-0000-4000-8000-000000000001';
export const myawaddyId = '10000000-0000-4000-8000-000000000002';

export function demoShipments(users) {
  const pickup = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const base = { trader_id: users['trader@demo.com'], driver_id: users['driver@demo.com'],
    origin: 'Yangon', destination: 'Muse', cargo_type: 'Agricultural goods',
    cargo_description: 'Packed agricultural goods for cross-border trade.', quantity: 12,
    quantity_unit: 'tonnes', pickup_date: pickup, route_gate_id: museId,
    status: 'in_transit', current_lat: 21.9588, current_lng: 96.0891, special_notes: 'Assignment demo shipment.' };
  return [
    { ...base, id: shipmentIds[0] },
    { ...base, id: shipmentIds[1], destination: 'Myawaddy', cargo_type: 'Consumer goods',
      quantity: 8, route_gate_id: myawaddyId, status: 'requested', driver_id: null, current_lat: 16.8409, current_lng: 96.1735 },
    { ...base, id: shipmentIds[2], origin: 'Mandalay', cargo_type: 'Textiles', quantity: 5,
      status: 'customs', current_lat: 23.9869, current_lng: 97.9040 },
    { ...base, id: shipmentIds[3], trader_id: users['trader2@demo.com'], driver_id: users['driver2@demo.com'],
      cargo_type: 'Security test fixture', special_notes: 'Must be invisible to the primary demo trader and driver.' },
  ];
}
