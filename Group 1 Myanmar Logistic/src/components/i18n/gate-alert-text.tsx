"use client";
import {useLanguage} from "./language-provider";

/** Translate generated notification framing, preserving the entered reason. */
export function GateAlertText({text}:{text:string}){
  const {locale,t}=useLanguage();
  if(locale==="en")return <>{text}</>;
  const title=text.match(/^(.*) Gate (Delayed|Closed)$/);
  if(title)return <>{t(title[1])} ဂိတ် — {t(title[2])}</>;
  const message=text.match(/^Route (closed|delayed): ([\s\S]+)\. Shipment (.+) may be affected\.$/);
  if(message)return <>လမ်းကြောင်း {t(message[1])} — {message[2]}။ ကုန်ပို့မှု {message[3]} အပေါ် သက်ရောက်မှု ရှိနိုင်သည်။</>;
  return <>{text}</>;
}
