"use client";
import {T} from "@/components/i18n/language-provider";
import {Input} from "@/components/i18n/fields";


import { useActionState, useState } from "react";
import { login } from "@/app/login/actions";
import type { LoginState } from "@/lib/auth/validation";
import { Icon } from "@/components/ui/icon";
import { PasswordInput } from "./password-input";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [email, setEmail] = useState("");
  return (
    <form action={action} className="login-form">
      <label htmlFor="email"><T>Email address</T></label>
      <Input id="email" name="email" type="email" autoComplete="username" required maxLength={320}
        value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com"
        aria-invalid={!!state.errors?.email} aria-describedby={state.errors?.email ? "email-error" : undefined} />
      {state.errors?.email && <p id="email-error" className="field-error"><T>{state.errors.email[0]}</T></p>}
      <label htmlFor="password"><T>Password</T></label>
      <PasswordInput id="password" name="password" autoComplete="current-password" error={!!state.errors?.password} describedBy={state.errors?.password ? "password-error" : undefined} />
      {state.errors?.password && <p id="password-error" className="field-error"><T>{state.errors.password[0]}</T></p>}
      <div aria-live="polite" aria-atomic="true">
        {state.message && <p className="auth-error" role="alert"><T>{state.message}</T></p>}
      </div>
      <button type="submit" className="button button-dark" disabled={pending}>
        <T>{pending ? "Signing in…" : "Sign in to your workspace"}</T><Icon name="arrow" />
      </button>
      <details className="demo-access"><summary><T>Using a demo account?</T></summary><fieldset className="demo-choices" disabled={pending}>
        <legend><T>Demo account shortcuts</T></legend>
        {(["admin", "trader", "driver"] as const).map((role) => (
          <button key={role} type="button" onClick={() => setEmail(`${role}@demo.com`)}><T>{role}</T></button>
        ))}
      </fieldset><p className="login-footnote"><T>Select a role to fill its demo email, then enter the demo password.</T></p></details>
    </form>
  );
}
