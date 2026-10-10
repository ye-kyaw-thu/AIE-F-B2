"use client";

// Simulated live GPS mapping (README requirement: "Simulated live GPS mapping of the
// truck"). Deliberately a self-contained inline SVG rather than a tiled-map library:
// no OSM tile server call means the map keeps rendering even mid-demo blackout, which
// is thematically the whole point of this prototype, and it removes a dependency that
// could fail on unfamiliar venue wifi.

import type { BorderGate } from "@/lib/types";
import type { RouteWaypoint } from "@/lib/geo/myanmar-routes";
import { positionAlongRoute } from "@/lib/geo/myanmar-routes";

// Bounding box covering both corridors (Yangon up to Muse, east to Myawaddy).
const LAT_MIN = 16.2;
const LAT_MAX = 24.4;
const LNG_MIN = 95.8;
const LNG_MAX = 99.0;
const VIEW_W = 380;
const VIEW_H = 480;

function project(lat: number, lng: number) {
  const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * VIEW_W;
  const y = VIEW_H - ((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * VIEW_H;
  return { x, y };
}

const GATE_COLOR: Record<string, string> = {
  OPEN: "#16a34a",
  CONGESTED: "#eab308",
  CLOSED: "#dc2626",
  ARMED_INSPECTION: "#dc2626",
  FLOODING: "#dc2626",
  EMERGENCY_HALT: "#dc2626",
};

export default function MapView({
  route,
  progress,
  gates,
  compact = false,
}: {
  route: RouteWaypoint[];
  progress: number;
  gates: BorderGate[];
  compact?: boolean;
}) {
  const truck = positionAlongRoute(route, progress);
  const truckPt = project(truck.lat, truck.lng);
  const routePts = route.map((w) => project(w.lat, w.lng));
  const pathD = routePts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className={compact ? "h-64 w-full" : "h-[420px] w-full"}
        role="img"
        aria-label="Simulated GPS map of shipment route"
      >
        <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="#f1f5f9" />

        {/* route line */}
        <path d={pathD} fill="none" stroke="#94a3b8" strokeWidth={3} strokeDasharray="1 0" />
        <path d={pathD} fill="none" stroke="#0ea5e9" strokeWidth={2} strokeDasharray="6 5" />

        {/* named checkpoint towns only — the route itself has ~100-150 road-shape points
            (see myanmar-routes.ts), most unnamed; drawing a dot for every one of those
            would clutter the map, so only the named subset gets a marker + label. */}
        {routePts.map((p, i) => {
          const name = route[i].name;
          if (!name) return null;
          return (
            <g key={name}>
              <circle cx={p.x} cy={p.y} r={4} fill="#334155" />
              {!compact && (
                <text x={p.x + 6} y={p.y - 4} fontSize={9} fill="#475569">
                  {name.split(" (")[0]}
                </text>
              )}
            </g>
          );
        })}

        {/* border gates */}
        {gates.map((g) => {
          const p = project(g.lat, g.lng);
          const color = GATE_COLOR[g.status] ?? "#64748b";
          return (
            <g key={g.id}>
              <rect x={p.x - 6} y={p.y - 6} width={12} height={12} fill={color} stroke="#0f172a" strokeWidth={1} rx={2} />
              <text x={p.x + 8} y={p.y + 4} fontSize={10} fontWeight={600} fill="#0f172a">
                {g.name.split(" (")[0]} · {g.status}
              </text>
            </g>
          );
        })}

        {/* truck marker */}
        <g transform={`translate(${truckPt.x}, ${truckPt.y})`}>
          <circle r={9} fill="#f97316" fillOpacity={0.25} />
          <circle r={5} fill="#f97316" stroke="#7c2d12" strokeWidth={1.5} />
        </g>
      </svg>
    </div>
  );
}
