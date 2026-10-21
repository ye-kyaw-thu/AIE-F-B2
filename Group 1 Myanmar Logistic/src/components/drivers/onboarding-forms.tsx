"use client";
import {useActionState} from "react";
import {T} from "@/components/i18n/language-provider";
import {PasswordInput} from "@/components/auth/password-input";
import {finishDriverSetup} from "@/app/auth/driver-setup/actions";
import type {DriverFormState} from "@/lib/drivers/validation";

export function DriverPasswordForm(){
  const [state,action,pending]=useActionState<DriverFormState,FormData>(finishDriverSetup,{});
  return <form action={action} className="login-form"><label htmlFor="password"><T>Password</T></label><PasswordInput id="password" name="password" autoComplete="new-password" minLength={10} error={!!state.errors?.password} describedBy="driver-password-help"/><p className="login-footnote" id="driver-password-help"><T>At least 10 characters. A longer, unique passphrase works well.</T></p>{state.errors?.password&&<p className="field-error"><T>{state.errors.password[0]}</T></p>}<label htmlFor="confirmPassword"><T>Confirm password</T></label><PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" minLength={10} error={!!state.errors?.confirmPassword} describedBy={state.errors?.confirmPassword?"driver-confirm-error":undefined}/>{state.errors?.confirmPassword&&<p className="field-error" id="driver-confirm-error"><T>{state.errors.confirmPassword[0]}</T></p>}<button type="submit" className="button button-dark" disabled={pending}><T>{pending?"Saving…":"Set password and start driving"}</T></button>{state.message&&<p role="alert" className="auth-error"><T>{state.message}</T></p>}</form>;
}
