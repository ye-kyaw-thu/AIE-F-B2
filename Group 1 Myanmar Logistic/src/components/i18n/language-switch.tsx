"use client";

import {useLanguage} from "./language-provider";
import type {Locale} from "@/lib/i18n/locale";

export function LanguageSwitch(){
  const {locale}=useLanguage();
  function change(next:Locale){
    if(next===locale)return;
    // Reload ensures all server-rendered strings and the document language agree.
    // This is a deliberate user navigation, never a background form refresh.
    document.cookie=`logistics-language=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol==="https:"?"; Secure":""}`;
    window.location.reload();
  }
  return <div className="language-switch" role="group" title={locale==="my"?"ဘာသာစကား မပြောင်းမီ ဖြည့်ထားသောအချက်အလက် သိမ်းပါ။ စာမျက်နှာ ပြန်ဖွင့်မည်။":"Save unfinished forms before changing language. The page will reload."} aria-label={locale==="my"?"ဘာသာစကား ရွေးချယ်ရန်":"Choose language"}><button type="button" lang="my" aria-pressed={locale==="my"} onClick={()=>change("my")}>မြန်မာ</button><button type="button" lang="en" aria-pressed={locale==="en"} onClick={()=>change("en")}>EN</button></div>;
}
