
import {T} from "@/components/i18n/language-provider";
import Link from "next/link";
import { RequestForm } from "@/components/shipments/request-form";
import { getRequestGates } from "@/lib/shipments/queries";
import { myanmarToday } from "@/lib/shipments/validation";

export default async function NewShipmentPage() {
  const gates = await getRequestGates();
  return <div className="request-page"><Link className="back-link" href="/trader/shipments"><T>← My shipments</T></Link><div className="page-heading"><div><p className="eyebrow">LET’S PLAN YOUR NEXT JOURNEY</p><h1><T>New transport request</T><span>.</span></h1><p className="muted"><T>Tell us what you’re moving and where it needs to go.</T></p></div></div><section className="panel"><RequestForm gates={gates} today={myanmarToday()} /></section></div>;
}
