"use client";
import {T,useLanguage} from "@/components/i18n/language-provider";
import {Input} from "@/components/i18n/fields";

import {useState} from "react";

export function PasswordInput({id,name,autoComplete,error,describedBy,minLength}:{id:string;name:string;autoComplete:string;error?:boolean;describedBy?:string;minLength?:number}){
  const {t}=useLanguage();
  const [visible,setVisible]=useState(false);
  return <div className="password-input"><Input id={id} name={name} type={visible?"text":"password"} required minLength={minLength} maxLength={128} autoComplete={autoComplete} aria-invalid={error} aria-describedby={describedBy}/><button type="button" onClick={()=>setVisible(value=>!value)} aria-label={t(visible?"Hide password":"Show password")} aria-pressed={visible}><T>{visible?"Hide":"Show"}</T></button></div>;
}
