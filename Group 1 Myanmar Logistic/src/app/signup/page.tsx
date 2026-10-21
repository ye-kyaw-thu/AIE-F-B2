
import {T} from "@/components/i18n/language-provider";
import type {Metadata} from "next";
import Link from "next/link";
import {redirect} from "next/navigation";
import {AuthFrame} from "@/components/brand/public-brand";
import {SignupForm} from "@/components/auth/signup-form";
import {getProfile} from "@/lib/auth/session";
import {profileDestination} from "@/lib/auth/destination";

export const metadata:Metadata={title:"Create an account",robots:{index:false,follow:true}};
export default async function SignupPage(){
  const profile=await getProfile();
  if(profile)redirect(profileDestination(profile));
  return <AuthFrame><p className="editorial-label"><T>A PLACE FOR YOUR NEXT SHIPMENT</T></p><h1><T>Let’s get started.</T></h1><p><T>Create your Trader account to request transport and follow your cargo from departure to delivery.</T></p><SignupForm/><p className="auth-switch"><T>Already have an account? </T><Link href="/login"><T>Log in ↗</T></Link></p></AuthFrame>;
}
