import {LanguageSwitch} from "@/components/i18n/language-switch";

import {T} from "@/components/i18n/language-provider";
import { Wordmark } from "@/components/brand/public-brand";
import { WorkspaceNav } from "./workspace-nav";
import { signOut } from "@/app/login/actions";

export function AdminShell({ name, children }: { name: string; children: React.ReactNode }) {
  return <div className="app-shell"><a href="#main-content" className="skip-link"><T>Skip to content</T></a>
    <aside className="sidebar trader-sidebar"><Wordmark href="/admin/dashboard"/><div className="workspace-label"><T>ADMIN WORKSPACE</T></div>
      <WorkspaceNav role="admin"/>
    </aside><div className="workspace"><header className="topbar"><span className="breadcrumb">Myanmar Trading <span>/</span><T> Admin</T></span><div className="topbar-right"><LanguageSwitch/><span className="trader-name">{name}</span><form action={signOut}><button type="submit" className="button signout-button"><T>Sign out</T></button></form></div></header><main className="main-content" id="main-content">{children}</main><footer className="footer"><span><T>Myanmar Trading · Operations workspace</T></span><span><T>Myanmar · UTC+6:30</T></span></footer></div></div>;
}
