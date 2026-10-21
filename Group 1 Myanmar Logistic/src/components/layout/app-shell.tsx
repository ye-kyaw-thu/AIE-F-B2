
import {T} from "@/components/i18n/language-provider";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link"><T>Skip to content</T></a>
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="Myanmar Trading overview"><span className="brand-mark"><Icon name="layers" /></span><span>MYANMAR<span className="brand-subtitle">TRADING & LOGISTICS</span></span></Link>
        <div className="workspace-label"><T>OPERATIONS WORKSPACE</T></div>
        <nav aria-label="Main navigation" className="main-nav">
          <Link href="/#overview"><Icon name="grid" /><T>Overview</T></Link>
          <Link href="/#shipments"><Icon name="box" /><T>Shipments</T><span className="nav-count">3</span></Link>
          <Link href="/#gates"><Icon name="route" /><T>Border gates</T></Link>
          <Link href="/#alerts"><Icon name="bell" /><T>Alerts</T></Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="foundation-card"><span className="tiny-label"><T>BUILT FOR MYANMAR</T></span><p><T>Every shipment.</T><br /><T>A clearer journey.</T></p><span>Assignment 5 · AI Engineering</span></div>
          <Link href="/login" className="profile-link"><span className="avatar">MT</span><span>Demo workspace<small>Design preview</small></span><Icon name="arrow" /></Link>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar"><div className="breadcrumb"><T>Workspace </T><span>/</span> <strong>Foundation preview</strong></div><div className="topbar-right"><span className="preview-pill">Sample data</span><span className="timezone"><T>Myanmar · UTC+6:30</T></span></div></header>
        <main id="main-content" className="main-content">{children}</main>
        <footer className="footer"><span>Myanmar Trading · Logistics Monitoring</span><span>Phase 1 / 10 — Foundation</span></footer>
      </div>
    </div>
  );
}
