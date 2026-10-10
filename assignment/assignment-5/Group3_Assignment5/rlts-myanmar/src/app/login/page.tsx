"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/auth/authStore";
import { DEMO_USERS, ROLE_HOME, ROLE_LABEL } from "@/lib/auth/users";
import { useT } from "@/lib/i18n/useT";
import LanguageToggle from "@/components/LanguageToggle";
import type { Role } from "@/lib/types";
import { PackagePlus, ShieldCheck, Truck, Warehouse } from "lucide-react";

const ROLE_ICON: Record<Role, typeof ShieldCheck> = {
  logistics_admin: ShieldCheck,
  data_entry_clerk: PackagePlus,
  cargo_trader: Warehouse,
  truck_driver: Truck,
};

// One representative demo account per role for the quick-login grid — DEMO_USERS also
// has trader2/driver2 (for testing that one account can't see another's shipments, see
// TEST_PLAN.md), which stay reachable via the manual form but would just clutter this grid.
const QUICK_LOGIN_USERS = Array.from(new Map(DEMO_USERS.map((u) => [u.role, u])).values());

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const hydrate = useAuthStore((s) => s.hydrate);
  const session = useAuthStore((s) => s.session);
  const t = useT();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const requiredRole = params.get("required") as Role | null;
  const suggestedUsername = params.get("as"); // convenience prefill from the landing page cards, e.g. ?as=admin

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (suggestedUsername && DEMO_USERS.some((u) => u.username === suggestedUsername)) {
      setUsername(suggestedUsername);
    }
  }, [suggestedUsername]);

  // Already logged in (e.g. this tab's session survived a refresh) — go straight in.
  useEffect(() => {
    if (session) router.replace(ROLE_HOME[session.role]);
  }, [session, router]);

  function submit(u: string, p: string) {
    const result = login(u, p);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    const loggedInRole = DEMO_USERS.find((d) => d.username === u)?.role;
    if (loggedInRole) router.replace(ROLE_HOME[loggedInRole]);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div className="flex justify-end">
        <LanguageToggle />
      </div>
      <div className="text-center">
        <h1 className="text-xl font-bold text-slate-900">{t("appTitle")} — {t("signIn")}</h1>
        <p className="mt-1 text-xs text-slate-500">{t("appSubtitle")}</p>
        {requiredRole && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            That page requires the <strong>{ROLE_LABEL[requiredRole]}</strong> role. Log in with an account that has
            it.
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(username, password);
        }}
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <div>
          <label htmlFor="login-username" className="mb-1 block text-xs font-medium text-slate-600">
            {t("username")}
          </label>
          <input
            id="login-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
            autoComplete="username"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="mb-1 block text-xs font-medium text-slate-600">
            {t("password")}
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
            autoComplete="current-password"
          />
        </div>
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        <button type="submit" className="w-full rounded-md bg-slate-800 py-2 text-sm font-semibold text-white hover:bg-slate-900">
          {t("signIn")}
        </button>
      </form>

      <div>
        <p className="mb-2 text-center text-xs font-semibold uppercase text-slate-400">{t("demoAccounts")}</p>
        <div className="grid grid-cols-4 gap-2">
          {QUICK_LOGIN_USERS.map((u) => {
            const Icon = ROLE_ICON[u.role];
            return (
              <button
                key={u.username}
                onClick={() => {
                  setUsername(u.username);
                  setPassword(u.password);
                  submit(u.username, u.password);
                }}
                className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 bg-white p-2.5 text-center hover:bg-slate-50"
              >
                <Icon className="h-4 w-4 text-slate-500" />
                <span className="text-[11px] font-semibold text-slate-700">{ROLE_LABEL[u.role]}</span>
                <span className="font-mono text-[10px] text-slate-400">
                  {u.username} / {u.password}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-center text-[11px] text-slate-400">
          Demo credentials only, shown on-screen on purpose — this is a rapid prototype, not production auth.
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
