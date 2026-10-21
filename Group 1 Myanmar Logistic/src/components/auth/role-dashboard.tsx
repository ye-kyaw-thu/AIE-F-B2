
import {T} from "@/components/i18n/language-provider";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ROLE_HOME } from "@/lib/auth/roles";
import { signOut } from "@/app/login/actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { Icon } from "@/components/ui/icon";
import type { UserRole } from "@/types/domain";

const descriptions: Record<UserRole, string> = {
  admin: "Your operations workspace. Review the shipments across your trading network.",
  trader: "Your cargo, your workspace. Only your shipment records appear here.",
  driver: "Your next journey starts here. Only shipments assigned to you appear below.",
};

export async function RoleDashboard({ role }: { role: UserRole }) {
  // Every data entry point verifies its own role; a parent layout is not sufficient.
  const profile = await requireRole(role);
  const supabase = await createClient();
  const { data: shipments, error } = await supabase.from("shipments")
    .select("id,shipment_number,origin,destination,status,cargo_type,pickup_date")
    .order("created_at", { ascending: false }).limit(50);

  return <div className="secure-workspace">
    <header className="secure-header">
      <Link className="brand" href={ROLE_HOME[role]}><span className="brand-mark"><Icon name="layers" /></span><span>MYANMAR<span className="brand-subtitle">TRADING & LOGISTICS</span></span></Link>
      <div className="secure-user"><span>{profile.full_name}<small>{role}<T> workspace</T></small></span><form action={signOut}><button type="submit" className="button signout-button"><T>Sign out</T></button></form></div>
    </header>
    <div className="secure-content">
      <div className="page-heading"><div><p className="eyebrow">{role.toUpperCase()}<T> WORKSPACE</T></p><h1><T>Welcome, </T>{profile.full_name.split(" ")[0]}<span>.</span></h1><p className="muted">{descriptions[role]}</p></div><span className="preview-pill">Connected to Supabase</span></div>
      <section className="panel"><div className="panel-heading"><div><h2><T>{role === "admin" ? "All shipments" : role === "driver" ? "Assigned shipments" : "Your shipments"}</T></h2><p className="panel-subtitle"><T>{error ? "Shipment records are temporarily unavailable." : `${shipments?.length ?? 0} shipment${shipments?.length === 1 ? "" : "s"} · Most recent 50`}</T></p></div></div>
        {error ? <div className="dashboard-message" role="alert"><h3><T>We couldn’t load shipments.</T></h3><p><T>Please try refreshing. Your administrator may need to finish workspace setup.</T></p></div>
          : shipments?.length ? <div className="table-scroll" tabIndex={0} role="region" aria-label="Your authorized shipment records"><table><thead><tr><th scope="col"><T>SHIPMENT</T></th><th scope="col"><T>ROUTE</T></th><th scope="col"><T>CARGO</T></th><th scope="col"><T>STATUS</T></th></tr></thead><tbody>{shipments.map((shipment) => <tr key={shipment.id}><td className="shipment-number">{shipment.shipment_number}</td><td>{shipment.origin} → {shipment.destination}</td><td>{shipment.cargo_type}</td><td><StatusBadge status={shipment.status} /></td></tr>)}</tbody></table></div>
          : <div className="dashboard-message"><h3><T>{role === "driver" ? "No assignments yet" : "No shipments yet"}</T></h3><p><T>{role === "driver" ? "Shipments will appear here when an administrator assigns them to you." : "Your shipment records will appear here when they are created."}</T></p></div>}
      </section>
      <div className="phase-progress"><Icon name="check" /><p>Secure access is ready. Shipment actions will be added in the next phases.</p><Link href="/">View design preview</Link></div>
    </div>
  </div>;
}
