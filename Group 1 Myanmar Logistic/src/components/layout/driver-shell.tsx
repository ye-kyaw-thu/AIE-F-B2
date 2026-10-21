import {LanguageSwitch} from "@/components/i18n/language-switch";

import {T} from "@/components/i18n/language-provider";
import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { Wordmark } from "@/components/brand/public-brand";
export function DriverShell({name,children}:{name:string;children:React.ReactNode}) {
  return <div className="driver-workspace"><a href="#main-content" className="skip-link"><T>Skip to content</T></a><header className="driver-header"><Wordmark href="/driver/dashboard"/><LanguageSwitch/><form action={signOut}><button className="button signout-button"><T>Sign out</T></button></form></header><div className="driver-greeting"><span>{name}</span><Link href="/driver/dashboard" className="text-link"><T>My assignments</T></Link></div><main id="main-content" className="driver-content">{children}</main><footer className="footer"><span><T>Myanmar Trading · Driver workspace</T></span><span><T>Myanmar · UTC+6:30</T></span></footer></div>;
}
