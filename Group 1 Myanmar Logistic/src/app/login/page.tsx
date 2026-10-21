
import {T} from "@/components/i18n/language-provider";
﻿import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/brand/public-brand";
import { LoginForm } from "@/components/auth/login-form";
import { getProfile } from "@/lib/auth/session";
import {profileDestination} from "@/lib/auth/destination";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({searchParams}:{searchParams:Promise<{notice?:string}>}) {
  const profile = await getProfile();
  if (profile) redirect(profileDestination(profile));
  const {notice}=await searchParams;
  return <AuthFrame><p className="editorial-label"><T>BACK TO YOUR WORKSPACE</T></p><h1><T>Good to see you.</T></h1><p><T>Log in to follow your cargo, coordinate your team or share an update from the road.</T></p>{notice==="confirmation-error"&&<div className="auth-confirmation" role="alert"><p><T>We couldn’t finish that confirmation link. It may have expired or been opened in another browser. Try logging in if your email is already confirmed, or register again to request a fresh link.</T></p></div>}<LoginForm/><p className="auth-switch"><T>New to Myanmar Trading? </T><Link href="/signup"><T>Create an account ↗</T></Link></p></AuthFrame>;
}
