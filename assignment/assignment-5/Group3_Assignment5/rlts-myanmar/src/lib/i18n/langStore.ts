"use client";

// Language preference is a device/browser setting, not an identity — unlike the auth
// session (sessionStorage, per-tab, see authStore.ts), this deliberately uses
// localStorage so switching to Myanmar in one tab is remembered for the whole browser.

import { create } from "zustand";
import type { Lang } from "./translations";

const KEY = "rlts_mm_lang_v1";

function readLang(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "mm" ? "mm" : "en";
  } catch {
    return "en";
  }
}

interface LangStore {
  lang: Lang;
  hydrated: boolean;
  hydrate: () => void;
  setLang: (lang: Lang) => void;
}

export const useLangStore = create<LangStore>((set) => ({
  lang: "en",
  hydrated: false,
  hydrate: () => set({ lang: readLang(), hydrated: true }),
  setLang: (lang) => {
    try {
      window.localStorage.setItem(KEY, lang);
    } catch {
      // best-effort; the in-memory value still updates for this render
    }
    set({ lang });
  },
}));
