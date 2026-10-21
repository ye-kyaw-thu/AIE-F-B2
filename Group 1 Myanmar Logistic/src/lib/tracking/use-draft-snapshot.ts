"use client";

import { useState } from "react";

// Keep the draft's original revision even if an already-running route refresh
// finishes after the first interaction. The database can then reject conflicts.
export function useDraftSnapshot<T>(current:T) {
  const [draft,setDraft]=useState<{value:T}|null>(null);
  const capture=()=>setDraft(previous=>previous ?? {value:current});
  return {value:draft ? draft.value : current,capture};
}
