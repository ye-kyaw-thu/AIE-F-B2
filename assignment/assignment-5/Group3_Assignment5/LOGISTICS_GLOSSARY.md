# Logistics Glossary, Considerations & Dashboard KPIs

Reference doc for the team: domain terms used across `README.md` / `project_detail.md`,
things worth weighing before adding more dashboard features, and a concrete set of KPI
cards for the Admin/Trader dashboards — each one tied to a field that already exists in
`rlts-myanmar/src/lib/types.ts`, so every card below is actually buildable, not aspirational.

---

## 1. Logistics terms and terminology

| Term | Meaning in this context |
|---|---|
| **Consignment / Shipment** | One load of cargo moving under one tracking number (`Shipment.trackingNumber`) |
| **Consignor / Consignee** | The sender and receiver of goods — roughly the Trader and the counterpart on the other side of the border |
| **Waybill** | The document accompanying cargo (route, cargo type, weight); the driver's "waybill photo" capture is this |
| **Manifest** | The full list of cargo/shipments for a truck or a period — the Admin's "Shipment Manifest" table |
| **HS Code** | Harmonized System code — the customs classification number for cargo type, used at border clearance |
| **Incoterms** (FOB, CIF, DAP, etc.) | Standardized terms defining who bears cost/risk at each stage of a shipment — relevant once pricing/liability is modeled |
| **Corridor** | A defined trade route between two points — the `Northern (China)` / `Eastern (Thailand)` corridors |
| **Checkpoint / Inspection station** | A stop where cargo/documents are checked — the `checkpointName` field |
| **Border gate / Trade zone** | The formal crossing point itself (Muse, Myawaddy) vs. the surrounding trade zone |
| **Customs clearance** | Formal approval to cross the border — the `CUSTOMS_PROCESSING` status |
| **Dwell time** | Time cargo spends stationary at a checkpoint/gate — computable from `ARRIVED` → `CLEARED` telemetry timestamps |
| **Transit time / Lead time** | Total time from pickup to delivery — `createdAt` to the `DELIVERED` telemetry event |
| **ETA / ETD / ATA / ATD** | Estimated/Actual Time of Arrival/Departure — `estimatedArrival` is the ETA; an actual delivery event would be the ATA |
| **Demurrage / Detention** | Charges for cargo/vehicle held too long at a gate or depot — a real cost driver at Myanmar border crossings, not currently modeled |
| **FTL / LTL** | Full Truckload vs. Less-than-Truckload — whether a truck carries one consignment or several |
| **POD** | Proof of Delivery — a signed/photographed confirmation at final delivery, same idea as the checkpoint photo capture |
| **OTIF** | On-Time-In-Full — delivered by ETA *and* with the complete/correct cargo, a standard freight KPI |
| **Reroute / Diversion** | Moving a shipment off its planned route — the `REROUTED` status and `rerouteShipment` action |
| **Escort** | A military/police-accompanied convoy, common on some Myanmar routes during instability — a real constraint the prototype simplifies away; worth naming explicitly in the AI Engineering Reflection |
| **Informal/unofficial fees** | Payments at checkpoints outside formal tariffs — a real, sensitive feature of the region; deliberately not modeled, and worth naming as a scope boundary rather than pretending it doesn't exist |
| **Chokepoint** | Any point where the whole corridor narrows to one path (a single bridge, a single mountain pass) — Muse and the Dawna Range Pass both function this way |

---

## 2. Considerations for a live logistics dashboard

- **Data latency is a KPI in itself.** The dashboard polls every 2 seconds; show a "last
  updated" timestamp on the dashboard itself so viewers know how fresh the numbers are,
  especially since a driver's device may be offline for hours.
- **Currency normalization.** Any aggregate money KPI (e.g. total cargo value in transit)
  must convert USD/CNY/MMK to one common currency before summing — use the same
  `convertCurrency()` helper already in `rlts-myanmar/src/lib/currency.ts`, and label the
  number as "approx., static demo rates."
- **Role-scoped visibility.** Cargo value and delay reasons are commercially sensitive —
  a KPI dashboard should follow the same per-trader/per-driver scoping already enforced
  on the Trader/Driver pages, not just the Admin console.
- **Denominator clarity.** "80% on-time" is meaningless without stating on-time out of
  *how many* — always show the count alongside the rate (e.g. "12 of 15 delivered on time").
- **Avoid alert fatigue.** If every `CONGESTED` gate or minor delay becomes a red KPI,
  real emergencies stop standing out — reserve red/critical styling for
  `CLOSED`/`EMERGENCY_HALT` gates and `CRITICAL` broadcasts specifically.
- **Timezone.** Myanmar is UTC+6:30, a half-hour offset that's easy to get wrong in
  date-math; decide once whether dashboard timestamps show device-local time or MMT, and
  be consistent.
- **Small-N statistics.** With one or two seeded shipments, a rate-based KPI like
  "on-time %" will look meaningless or wildly swingy — fine for demo purposes, but say so
  if asked, and prefer count-based cards over rate-based ones until there's a realistic
  shipment volume.
- **Degrade visibly, not silently.** If the 2-second poll fails, the dashboard should
  show a stale/error state (`appStore.ts` already tracks `lastError`) rather than
  silently freezing on old numbers.

---

## 3. KPI cards for the live dashboard

| Card | What it shows | Computed from |
|---|---|---|
| Active Shipments | Count of shipments not yet `DELIVERED` | `shipments.filter(s => s.currentStatus !== "DELIVERED").length` |
| In Transit | Count currently `IN_TRANSIT` | filter on `currentStatus` |
| Held at Checkpoint | Count currently `HELD_AT_CHECKPOINT` | filter on `currentStatus` |
| In Customs | Count currently `CUSTOMS_PROCESSING` | filter on `currentStatus` |
| Delayed Shipments | Count with `isDelayed = true`, plus % of active | filter + divide |
| Delivered Today | Count of `DELIVERED` shipments with a matching telemetry event today | join `shipments` to their last `CLEARED`/delivery telemetry event |
| Avg. Transit Time | Mean of (delivery time − `createdAt`) across delivered shipments | needs a delivery timestamp, not just status |
| On-Time Rate | Delivered shipments where delivery time ≤ `estimatedArrival`, shown as "X of Y" | same data as above |
| Cargo Value In Transit | Sum of `cargoValue` across active shipments, converted to one currency | `convertCurrency()` + sum |
| Gate Status Summary | Count of gates by status (Open / Congested / Closed) | `gates` array, grouped |
| Active Critical Alerts | Count of `broadcasts` where `isActive && severity === "CRITICAL"` | filter |
| Avg. Checkpoint Dwell Time | Mean time between `ARRIVED` and the next `CLEARED` event per shipment | pair up consecutive telemetry events |
| Devices With Pending Sync | Count of drivers whose last-known queue had unsynced items | needs the driver client to report queue depth to the server — not currently sent, would be a small addition |
| Fleet Active Today | Distinct `driverUsername` values with at least one telemetry event today | `telemetry` grouped by driver |

The last two rows are the most interesting to build next: dwell time and pending-sync
count both directly showcase the offline-sync architecture that's the heart of this
assignment, rather than being generic freight metrics any dashboard could show.
