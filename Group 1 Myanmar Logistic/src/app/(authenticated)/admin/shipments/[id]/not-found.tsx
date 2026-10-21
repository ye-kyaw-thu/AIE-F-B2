
import {T} from "@/components/i18n/language-provider";
import Link from "next/link";
export default function NotFound() { return <section className="panel dashboard-message"><h1><T>Shipment not found</T></h1><p><T>This shipment is unavailable.</T></p><Link href="/admin/shipments" className="text-link"><T>Return to shipments</T></Link></section>; }
