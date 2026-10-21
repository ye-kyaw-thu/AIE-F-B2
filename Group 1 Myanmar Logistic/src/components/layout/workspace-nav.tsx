"use client";
import {T,useLanguage} from "@/components/i18n/language-provider";


import Link from "next/link";
import {usePathname} from "next/navigation";
import {Icon} from "@/components/ui/icon";

export function WorkspaceNav({role,unreadAlerts=0}:{role:"admin"|"trader";unreadAlerts?:number}) {
  const {t}=useLanguage();
  const pathname=usePathname();
  const links=role==="admin"
    ? [{href:"/admin/dashboard",label:"Dashboard",icon:"grid"},{href:"/admin/shipments",label:"All shipments",icon:"box"},{href:"/admin/drivers",label:"Drivers",icon:"truck"},{href:"/admin/gates",label:"Border gates",icon:"route"},{href:"/admin/alerts",label:"Alerts",icon:"bell"}] as const
    : [{href:"/trader/dashboard",label:"Dashboard",icon:"grid"},{href:"/trader/shipments",label:"My shipments",icon:"box"},{href:"/trader/shipments/new",label:"New request",icon:"route"},{href:"/trader/alerts",label:"Alerts",icon:"bell"}] as const;
  return <nav className="main-nav" aria-label={t(role==="admin"?"Admin navigation":"Trader navigation")}>{links.map(link=>{
    const active=pathname===link.href||(link.icon==="box"&&pathname.startsWith(link.href+"/")&&pathname!=="/trader/shipments/new");
    return <Link key={link.href} href={link.href} aria-current={active?"page":undefined}><Icon name={link.icon}/><T>{link.label}</T>{link.icon==="bell"&&unreadAlerts>0&&<span className="nav-count" aria-label={unreadAlerts+" "+t("Unread")}>{unreadAlerts>99?"99+":unreadAlerts}</span>}</Link>;
  })}</nav>;
}
