"use client";

import Link from "next/link";
import LanguageToggle from "@/components/LanguageToggle";
import { useT } from "@/lib/i18n/useT";
import { PackagePlus, ShieldCheck, Truck, Warehouse } from "lucide-react";

const ROLES = [
  {
    href: "/login?as=clerk",
    titleKey: "roleClerk" as const,
    desc: "Enter route, driver, cargo, and cargo value once — synced to Driver and Trader instantly.",
    icon: PackagePlus,
    color: "bg-amber-700",
  },
  {
    href: "/login?as=admin",
    titleKey: "roleAdmin" as const,
    desc: "Toggle border gate status, broadcast alerts, oversee the fleet.",
    icon: ShieldCheck,
    color: "bg-slate-800",
  },
  {
    href: "/login?as=trader",
    titleKey: "roleTrader" as const,
    desc: "Track your cargo, view the milestone timeline, get gate alerts.",
    icon: Warehouse,
    color: "bg-sky-700",
  },
  {
    href: "/login?as=driver",
    titleKey: "roleDriver" as const,
    desc: "Check in at checkpoints, works offline, syncs when reconnected.",
    icon: Truck,
    color: "bg-emerald-700",
  },
];

export default function LandingPage() {
  const t = useT();
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-8 px-6 py-12">
      <div className="flex w-full justify-end">
        <LanguageToggle />
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">{t("appTitle")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("appSubtitle")} — rapid prototype</p>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map(({ href, titleKey, desc, icon: Icon, color }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className={`rounded-lg ${color} p-2.5 text-white`}>
              <Icon className="h-5 w-5" />
            </span>
            <span className="font-semibold text-slate-900">{t(titleKey)}</span>
            <span className="text-xs text-slate-500">{desc}</span>
          </Link>
        ))}
      </div>

      <p className="max-w-lg text-center text-xs text-slate-400">
        Each card takes you to sign-in for that role — the page itself enforces the role (a
        Trader account can&apos;t open /admin). Everyone now shares one real backend (not just
        a browser trick), so the web portal, other browsers, and the Android driver app all
        see the same live data. A Data Entry Clerk enters a shipment once; it appears for the
        assigned Driver and Trader immediately.
      </p>
    </main>
  );
}
