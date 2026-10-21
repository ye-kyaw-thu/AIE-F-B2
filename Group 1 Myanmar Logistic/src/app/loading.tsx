
import {T} from "@/components/i18n/language-provider";
export default function Loading() {
  return <main className="state-page" role="status"><span className="loading-ring" /><h1><T>Loading workspace…</T></h1><p className="muted">Preparing your logistics overview.</p></main>;
}
