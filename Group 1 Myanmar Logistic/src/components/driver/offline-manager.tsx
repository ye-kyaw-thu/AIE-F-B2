"use client";
import {T,useLanguage} from "@/components/i18n/language-provider";


import { useState, useEffect, useCallback, useSyncExternalStore, useMemo } from "react";
import { getQueue, clearSynced, removeFromQueue } from "@/lib/offline/queue";
import { syncQueue, type SyncResult } from "@/lib/offline/sync";
import { SHIPMENT_STATUS_LABELS } from "@/types/domain";

type Props = { userId: string };

function subscribeOnline(callback:()=>void) {
  window.addEventListener("online",callback);window.addEventListener("offline",callback);
  return ()=>{window.removeEventListener("online",callback);window.removeEventListener("offline",callback);};
}
function subscribeQueue(callback:()=>void) {
  window.addEventListener("offline-queue-updated",callback);window.addEventListener("storage",callback);
  return ()=>{window.removeEventListener("offline-queue-updated",callback);window.removeEventListener("storage",callback);};
}
const emptyQueueSnapshot=()=>"[]";

export function OfflineManager({ userId }: Props) {
  const {locale}=useLanguage();
  const [simulated, setSimulated] = useState(false);
  const online=useSyncExternalStore(subscribeOnline,()=>navigator.onLine,()=>true);
  const getSnapshot=useCallback(()=>JSON.stringify(getQueue(userId)),[userId]);
  const queueSnapshot=useSyncExternalStore(subscribeQueue,getSnapshot,emptyQueueSnapshot);
  const queue=useMemo(()=>JSON.parse(queueSnapshot) as ReturnType<typeof getQueue>,[queueSnapshot]);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  const effectivelyOffline = simulated || !online;

  const refreshQueue=()=>window.dispatchEvent(new Event("offline-queue-updated"));

  // Expose simulated offline state for the update form to check
  useEffect(() => {
    (window as unknown as Record<string, boolean>).__simulatedOffline = simulated;
    return () => { delete (window as unknown as Record<string, boolean>).__simulatedOffline; };
  }, [simulated]);

  async function handleSync() {
    if (syncing || effectivelyOffline) return;
    setSyncing(true);
    setLastResult(null);
    try {
      const result = await syncQueue(userId, () => refreshQueue());
      setLastResult(result);
    } finally {
      setSyncing(false);
      refreshQueue();
    }
  }

  function handleClearSynced() {
    clearSynced(userId);
    refreshQueue();
  }

  function handleDismissError(entryId: string) {
    removeFromQueue(userId, entryId);
    refreshQueue();
  }

  const pending = queue.filter((e) => e.syncStatus === "pending");
  const synced = queue.filter((e) => e.syncStatus === "synced");
  const errors = queue.filter((e) => e.syncStatus === "error");

  return <section className="panel offline-manager">
    <div className="panel-heading">
      <div>
        <h2><T>Offline queue</T></h2>
        <p className="panel-subtitle">
          <T>{effectivelyOffline
            ? "You are offline. Updates are saved locally."
            : pending.length > 0
              ? locale==="my" ? `${pending.length} ခု ပေးပို့ရန် အဆင်သင့်ဖြစ်သည်။` : `${pending.length} pending update${pending.length === 1 ? "" : "s"} ready to sync.`
              : queue.length > 0
                ? "All updates synced."
                : "Simulated offline mode is available for demo."}</T>
        </p>
      </div>
      <div className="offline-controls">
        <button
          type="button"
          className={`button ${simulated ? "button-dark" : "signout-button"}`}
          onClick={() => setSimulated(!simulated)}
        >
          <T>{simulated ? "Go online" : "Simulate offline"}</T>
        </button>
      </div>
    </div>

    {/* Sync button */}
    {pending.length > 0 && !effectivelyOffline && (
      <div className="offline-sync-bar">
        <button
          type="button"
          className="button button-dark"
          onClick={handleSync}
          disabled={syncing}
        >
          <T>{syncing ? "Syncing…" : locale==="my" ? `မှတ်တမ်း ${pending.length} ခု ပေးပို့ရန်` : `Sync ${pending.length} update${pending.length === 1 ? "" : "s"}`}</T>
        </button>
        {lastResult && (
          <p className="sync-result" role="status">
            {lastResult.synced > 0 && <>{lastResult.synced} <T>synced.</T> </>}
            {lastResult.failed > 0 && <>{lastResult.failed} <T>need review.</T> </>}
            {lastResult.pending > 0 && <>{lastResult.pending} <T>still pending.</T> </>}
          </p>
        )}
      </div>
    )}

    {/* Queue items */}
    {queue.length > 0 && (
      <ul className="offline-queue-list">
        {queue.map((entry) => (
          <li key={entry.id} className={`queue-item queue-${entry.syncStatus}`}>
            <div className="queue-item-head">
              <span className={`queue-badge queue-badge-${entry.syncStatus}`}>
                <T>{entry.syncStatus === "pending" ? "Pending Sync" : entry.syncStatus === "synced" ? "Synced" : "Needs Review"}</T>
              </span>
              <span className="queue-shipment">{entry.shipmentNumber}</span>
            </div>
            <div className="queue-item-body">
              <strong><T>{SHIPMENT_STATUS_LABELS[entry.status]}</T></strong>
              {entry.note && <p>{entry.note}</p>}
              {entry.latitude !== null && entry.longitude !== null && (
                <small>GPS: {entry.latitude.toFixed(4)}, {entry.longitude.toFixed(4)}</small>
              )}
              <time dateTime={entry.queuedAt}><T>
                Queued </T>{new Date(entry.queuedAt).toLocaleString("en-GB", { timeZone: "Asia/Yangon", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </time>
            </div>
            {entry.syncStatus === "error" && entry.errorMessage && (
              <div className="queue-error">
                <p role="alert"><T>{entry.errorMessage}</T></p>
                <button type="button" className="button signout-button" onClick={() => handleDismissError(entry.id)}><T>
                  Dismiss
                </T></button>
              </div>
            )}
          </li>
        ))}
      </ul>
    )}

    {/* Clear synced */}
    {synced.length > 0 && (
      <div className="offline-sync-bar">
        <button type="button" className="button signout-button" onClick={handleClearSynced}><T>
          Clear </T>{synced.length}<T> synced </T><T><T>{synced.length === 1 ? "entry" : "entries"}</T></T>
        </button>
      </div>
    )}

    {/* Error summary */}
    {errors.length > 0 && (
      <p className="queue-error-summary" role="status">
        {errors.length}<T> update</T>{errors.length === 1 ? "" : "s"}<T> could not be synced. Review and dismiss to continue.
      </T></p>
    )}
  </section>;
}
