"use client";

import { useLangStore } from "./langStore";
import { translations, type TranslationKey } from "./translations";

export function useT() {
  const lang = useLangStore((s) => s.lang);
  return (key: TranslationKey): string => translations[lang][key] ?? translations.en[key] ?? key;
}
