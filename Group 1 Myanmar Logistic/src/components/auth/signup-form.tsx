"use client";
import {T} from "@/components/i18n/language-provider";
import {Input} from "@/components/i18n/fields";

import Link from "next/link";
import {useActionState} from "react";
import {signup} from "@/app/signup/actions";
import type {SignupState} from "@/lib/auth/signup-validation";
import {PasswordInput} from "./password-input";

export function SignupForm(){
  const [state,action,pending]=useActionState<SignupState,FormData>(signup,{});
  if(state.success)return <div className="auth-confirmation" role="status"><h2><T>Check your inbox.</T></h2><p><T>If this email can be registered, a confirmation link will arrive shortly. Open it in this browser to finish setting up your account.</T></p><p><T>Already registered? </T><Link href="/login"><T>Log in to your account</T></Link>.</p><p><T>Check your spam folder if the message hasn’t arrived.</T></p></div>;
  return <form action={action} className="login-form signup-form">
    <label htmlFor="fullName"><T>Full name</T></label><Input id="fullName" name="fullName" autoComplete="name" required minLength={2} maxLength={120} placeholder="Your full name" aria-invalid={!!state.errors?.fullName} aria-describedby={state.errors?.fullName?"name-error":undefined}/>
    {state.errors?.fullName&&<p className="field-error" id="name-error"><T>{state.errors.fullName[0]}</T></p>}
    <label htmlFor="email"><T>Email address</T></label><Input id="email" name="email" type="email" autoComplete="email" required maxLength={320} placeholder="you@company.com" aria-invalid={!!state.errors?.email} aria-describedby={state.errors?.email?"email-error":undefined}/>
    {state.errors?.email&&<p className="field-error" id="email-error"><T>{state.errors.email[0]}</T></p>}
    <label htmlFor="password"><T>Password</T></label><PasswordInput id="password" name="password" autoComplete="new-password" minLength={10} error={!!state.errors?.password} describedBy={state.errors?.password?"password-error":"password-help"}/>
    <p className="login-footnote" id="password-help"><T>At least 10 characters. A longer, unique passphrase works well.</T></p>
    {state.errors?.password&&<p className="field-error" id="password-error"><T>{state.errors.password[0]}</T></p>}
    <label htmlFor="confirmPassword"><T>Confirm password</T></label><PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" minLength={10} error={!!state.errors?.confirmPassword} describedBy={state.errors?.confirmPassword?"confirm-error":undefined}/>
    {state.errors?.confirmPassword&&<p className="field-error" id="confirm-error"><T>{state.errors.confirmPassword[0]}</T></p>}
    <div aria-live="polite">{state.message&&<p className="auth-error" role="alert"><T>{state.message}</T></p>}</div>
    <button className="button button-dark" type="submit" disabled={pending}><T>{pending?"Creating your account…":"Create Trader account"}</T> <span aria-hidden="true">↗</span></button>
    <p className="login-footnote"><T>This creates a Trader workspace. Drivers and operations staff receive their access from the team.</T></p>
  </form>;
}
