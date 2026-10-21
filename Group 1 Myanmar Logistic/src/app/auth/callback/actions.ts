"use server";
import {z} from 'zod';
import {createClient} from '@/lib/supabase/server';
import {profileDestination} from '@/lib/auth/destination';
import {isUserRole} from '@/lib/auth/roles';
import {emailLinkSchema} from '@/lib/auth/callback';

type ConfirmationResult={destination?:string;message?:string};
/** Identity is always checked against Supabase, including after the browser sets cookies. */
export async function finishEmailConfirmation():Promise<ConfirmationResult>{
  try{
    const client=await createClient();const {data,error}=await client.auth.getUser();
    if(error||!data.user?.email_confirmed_at)return {message:'This email link could not be confirmed. Ask Admin to resend the Driver setup email.'};
    const {data:profile,error:profileError}=await client.from('profiles').select('role,driver_access').eq('id',data.user.id).maybeSingle();
    if(profileError)return {message:'Could not load your account. Try again shortly.'};
    return {destination:profile&&isUserRole(profile.role)?profileDestination({...profile,role:profile.role}):'/account/setup'};
  }catch{return {message:'Could not confirm the invitation. Try again shortly.'};}
}
export async function confirmEmailLink(input:unknown):Promise<ConfirmationResult>{
  const parsed=z.union([emailLinkSchema,z.object({code:z.string().min(1).max(2048)})]).safeParse(input);
  if(!parsed.success)return {message:'This email link could not be confirmed. Ask Admin to resend the Driver setup email.'};
  try{
    const client=await createClient();const current=await client.auth.getUser();
    if(current.data.user)return {message:'Sign out of the current account before accepting a Driver invitation.'};
    const result='code' in parsed.data?await client.auth.exchangeCodeForSession(parsed.data.code):await client.auth.verifyOtp({token_hash:parsed.data.tokenHash,type:parsed.data.type});
    if(result.error)return {message:'This email link could not be confirmed. Ask Admin to resend the Driver setup email.'};
    return finishEmailConfirmation();
  }catch{return {message:'Could not confirm the invitation. Try again shortly.'};}
}
