"use client";

import { useEffect, useState } from "react";
import type { NetworkState } from "@/lib/types";

// Network Information API isn't in lib.dom's TS types.
interface NavigatorConnection {
  effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
}

function getConnection(): NavigatorConnection | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as unknown as { connection?: NavigatorConnection }).connection;
}

function detect(): NetworkState {
  if (typeof navigator === "undefined") return "ONLINE";
  if (!navigator.onLine) return "OFFLINE";
  const effectiveType = getConnection()?.effectiveType;
  if (effectiveType === "2g" || effectiveType === "slow-2g") return "SLOW_2G";
  return "ONLINE";
}

/**
 * The *real* device connectivity, distinct from the in-app demo toggle
 * (NetworkSimulator.tsx). Chrome on Android — the emulator's default browser — supports
 * both `navigator.onLine` and the Network Information API
 * (`navigator.connection.effectiveType`), so this hook genuinely changes value when:
 *   - Airplane mode is toggled on the device/emulator -> OFFLINE
 *   - The emulator's network profile is set to GPRS/EDGE (Extended Controls -> Cellular
 *     -> Network type) -> SLOW_2G
 *   - Normal wifi/LTE -> ONLINE
 *
 * This is what makes testing the offline queue on a real Android emulator meaningful —
 * without it, "offline" in this app would only ever mean "someone clicked a UI button",
 * never anything the device itself reported.
 */
export function useRealNetworkState(): NetworkState {
  const [state, setState] = useState<NetworkState>("ONLINE");

  useEffect(() => {
    setState(detect());
    const update = () => setState(detect());
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const conn = getConnection();
    conn?.addEventListener?.("change", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      conn?.removeEventListener?.("change", update);
    };
  }, []);

  return state;
}
