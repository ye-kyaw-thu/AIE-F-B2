"use client";

import { useEffect } from "react";
import { useLangStore } from "@/lib/i18n/langStore";

export default function LanguageToggle() {
  const lang = useLangStore((s) => s.lang);
  const hydrated = useLangStore((s) => s.hydrated);
  const hydrate = useLangStore((s) => s.hydrate);
  const setLang = useLangStore((s) => s.setLang);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) return null;

  return (
    <div className="flex overflow-hidden rounded-md border border-slate-200 text-[11px] font-semibold">
      <button
        onClick={() => setLang("en")}
        className={`px-2 py-1 ${lang === "en" ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-100"}`}
      >
        EN
      </button>
      <button
        onClick={() => setLang("mm")}
        className={`px-2 py-1 ${lang === "mm" ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-100"}`}
      >
        MM
      </button>
    </div>
  );
}
