"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/authStore";
import { ROLE_LABEL } from "@/lib/auth/users";
import type { Role } from "@/lib/types";
import { useT } from "@/lib/i18n/useT";
import LanguageToggle from "@/components/LanguageToggle";
import { LogOut } from "lucide-react";

/**
 * Client-side RBAC guard. Wraps a role page's content; redirects to /login if there is
 * no session, or if the logged-in session's role doesn't match this page's role. This
 * is what actually enforces "Trader can't open the Admin console" (README.md #1), rather
 * than the role selector being a plain, unguarded router link.
 */
export default function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && (!session || session.role !== role)) {
      router.replace(`/login?required=${role}`);
    }
  }, [hydrated, session, role, router]);

  if (!hydrated || !session || session.role !== role) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-400">
        Checking access for {ROLE_LABEL[role]}…
      </div>
    );
  }

  return <>{children}</>;
}

export function UserBadge() {
  const session = useAuthStore((s) => s.session);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const t = useT();
  if (!session) return null;
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <LanguageToggle />
      <span>
        {session.displayName} <span className="text-slate-400">· {ROLE_LABEL[session.role]}</span>
      </span>
      <button
        onClick={() => {
          logout();
          router.replace("/login");
        }}
        className="flex items-center gap-1 rounded border border-slate-200 px-2 py-1 font-medium text-slate-500 hover:bg-slate-100"
      >
        <LogOut className="h-3 w-3" />
        {t("logout")}
      </button>
    </div>
  );
}
