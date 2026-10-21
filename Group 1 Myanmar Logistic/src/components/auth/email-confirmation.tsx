"use client";
import {useState} from 'react';
import {createBrowserClient} from '@supabase/ssr';
import {getSupabaseConfig} from '@/lib/supabase/config';
import {parseCallbackUrl} from '@/lib/auth/callback';
import {confirmEmailLink,finishEmailConfirmation} from '@/app/auth/callback/actions';
import {T} from '@/components/i18n/language-provider';
import type {Database} from '@/types/database';

export function EmailConfirmation(){
  const [pending,setPending]=useState(false),[message,setMessage]=useState<string>();
  async function confirm(){
    setPending(true);setMessage(undefined);
    try{
      const credentials=parseCallbackUrl(window.location.href);
      // Remove one-time credentials from browser history before creating an Auth client.
      window.history.replaceState(null,'','/auth/callback');
      let result;
      if(credentials.kind==='session'){
        const {url,key}=getSupabaseConfig();
        const client=createBrowserClient<Database>(url,key,{isSingleton:false,auth:{detectSessionInUrl:false}});
        const current=await client.auth.getUser();
        if(current.data.user){setMessage('Sign out of the current account before accepting a Driver invitation.');return;}
        const session=await client.auth.setSession({access_token:credentials.accessToken,refresh_token:credentials.refreshToken});
        result=session.error?{message:'This email link could not be confirmed. Ask Admin to resend the Driver setup email.'}:await finishEmailConfirmation();
      }else if(credentials.kind==='code')result=await confirmEmailLink({code:credentials.code});
      else if(credentials.kind==='token')result=await confirmEmailLink({tokenHash:credentials.tokenHash,type:credentials.type});
      else result={message:'This email link could not be confirmed. Ask Admin to resend the Driver setup email.'};
      if(result.destination){window.location.replace(result.destination);return;}
      setMessage(result.message);
    }catch{setMessage('Could not confirm the invitation. Try again shortly.');}
    finally{setPending(false);}
  }
  return <><p><T>Use the button below to confirm this email link and continue to your account.</T></p><button className="button button-dark" onClick={confirm} disabled={pending}><T>{pending?'Confirming…':'Confirm and continue'}</T></button>{message&&<p role="alert" className="auth-error"><T>{message}</T></p>}</>;
}
