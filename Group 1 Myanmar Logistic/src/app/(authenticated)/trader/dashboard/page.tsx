
import {T} from "@/components/i18n/language-provider";
﻿import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ShipmentList } from "@/components/shipments/shipment-list";
import { TraderAlertSummary } from "@/components/alerts/trader-alert-summary";

export default async function TraderDashboard() {
  const profile = await requireRole("trader");
  const supabase = await createClient();
  const [all, requested, active, delivered] = await Promise.all([
    supabase.from("shipments").select("id", { count: "exact", head: true }).eq("trader_id", profile.id),
    supabase.from("shipments").select("id", { count: "exact", head: true }).eq("trader_id", profile.id).eq("status", "requested"),
    supabase.from("shipments").select("id", { count: "exact", head: true }).eq("trader_id", profile.id).in("status", ["approved", "picked_up", "in_transit", "arrived_at_checkpoint", "customs"]),
    supabase.from("shipments").select("id", { count: "exact", head: true }).eq("trader_id", profile.id).eq("status", "delivered"),
  ]);
  const metrics = [
    { label: "Total shipments", result: all, note: "Your trading activity" },
    { label: "Awaiting approval", result: requested, note: "Request details can be edited" },
    { label: "Active shipments", result: active, note: "Approved and on the move" },
    { label: "Delivered", result: delivered, note: "Completed journeys" },
  ];
  return <>
    <div className="page-heading"><div><p className="eyebrow"><T>YOUR TRADING WORKSPACE</T></p><h1><T>Welcome, </T>{profile.full_name.split(" ")[0]}<span>.</span></h1><p className="muted"><T>Request transport and follow your cargo, all in one place.</T></p></div><Link className="button button-dark" href="/trader/shipments/new"><T>New transport request →</T></Link></div>
    <section className="stats-grid" aria-label="Your shipment statistics">{metrics.map(metric => <article className="stat-card" key={metric.label}><p className="stat-top"><T>{metric.label}</T></p><p className="stat-value">{metric.result.error ? "—" : metric.result.count ?? 0}</p><p className="stat-detail"><T>{metric.result.error ? "Temporarily unavailable" : metric.note}</T></p></article>)}</section>
    <TraderAlertSummary /><ShipmentList compact />
  </>;
}
