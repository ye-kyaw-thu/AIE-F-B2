"use client";

// Session storage is deliberately used instead of localStorage here.
//
// The "cloud" business state (gates/shipments/telemetry, appStore.ts) intentionally
// lives in localStorage + BroadcastChannel so Admin/Trader/Driver tabs in the SAME
// browser share one backend for the no-infrastructure live demo. But localStorage is
// also shared across those same tabs — if the login session used it too, logging in as
// Admin in one tab would silently log every other tab in as Admin as well, breaking the
// three-roles-in-three-tabs demo pattern entirely.
//
// sessionStorage is scoped per browsing-context (per tab), so each tab keeps its own
// independent login while still sharing the same underlying data.

import { create } from "zustand";
import type { Role } from "@/lib/types";
import { DEMO_USERS } from "./users";

const SESSION_KEY = "rlts_mm_session_v1";

export interface Session {
  username: string;
  displayName: string;
  role: Role;
}

interface AuthStore {
  session: Session | null;
  hydrated: boolean;
  hydrate: () => void;
  login: (username: string, password: string) => { ok: true } | { ok: false; error: string };
  logout: () => void;
}

function readSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function writeSession(session: Session | null) {
  if (typeof window === "undefined") return;
  try {
    if (session) window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // sessionStorage can throw in private-browsing edge cases; login still works for
    // the current render, it just won't survive a refresh in that tab.
  }
}

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  hydrated: false,

  hydrate: () => {
    set({ session: readSession(), hydrated: true });
  },

  login: (username, password) => {
    const match = DEMO_USERS.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password
    );
    if (!match) {
      return { ok: false, error: "Incorrect username or password." };
    }
    const session: Session = { username: match.username, displayName: match.displayName, role: match.role };
    writeSession(session);
    set({ session });
    return { ok: true };
  },

  logout: () => {
    writeSession(null);
    set({ session: null });
  },
}));
