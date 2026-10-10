"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store/appStore";

/** Mounted once in the root layout: loads persisted state and wires up the cross-tab channel. */
export default function StoreHydrator() {
  const hydrate = useAppStore((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
  return null;
}
