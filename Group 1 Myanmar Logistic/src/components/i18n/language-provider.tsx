"use client";

import {createContext,useContext,type ReactNode} from "react";
import type {Locale} from "@/lib/i18n/locale";
import {translate} from "@/lib/i18n/messages";

const LanguageContext=createContext<Locale>("my");
export function LanguageProvider({locale,children}:{locale:Locale;children:ReactNode}) {
  return <LanguageContext.Provider value={locale}>{children}</LanguageContext.Provider>;
}
export function useLanguage() {
  const locale=useContext(LanguageContext);
  return {locale,t:(text:string)=>translate(text,locale)};
}
/** Localize interface strings only. Shipment notes and other user content stay original. */
export function T({children}:{children:ReactNode}) {
  const {t}=useLanguage();
  function render(value:ReactNode):ReactNode {
    if(typeof value==="string")return t(value);
    if(Array.isArray(value))return value.map(render);
    return value;
  }
  return <>{render(children)}</>;
}
