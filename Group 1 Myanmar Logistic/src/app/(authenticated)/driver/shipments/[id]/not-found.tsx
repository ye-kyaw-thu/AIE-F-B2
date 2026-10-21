
import {T} from "@/components/i18n/language-provider";
import Link from "next/link";
export default function NotFound() { return <section className="panel dashboard-message"><h1><T>Assignment not found</T></h1><p><T>This shipment is not assigned to you or is unavailable.</T></p><Link href="/driver/dashboard" className="text-link"><T>Return to assignments</T></Link></section>; }
