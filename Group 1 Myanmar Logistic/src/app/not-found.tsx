
import {T} from "@/components/i18n/language-provider";
import Link from "next/link";

export default function NotFound() {
  return <main className="state-page"><p className="eyebrow"><T>404 · PAGE NOT FOUND</T></p><h1><T>This route isn’t here yet.</T></h1><p className="muted"><T>Return to shipments</T></p><Link href="/" className="button button-dark"><T>Back to overview</T></Link></main>;
}
