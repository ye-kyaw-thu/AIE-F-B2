
import {T} from "@/components/i18n/language-provider";
import Link from "next/link";

export default function ShipmentNotFound() {
  return <div className="dashboard-message"><h1><T>Shipment not found.</T></h1><p><T>This shipment is unavailable in your workspace.</T></p><Link href="/trader/shipments" className="text-link"><T>Back to my shipments →</T></Link></div>;
}
