
import {T} from "@/components/i18n/language-provider";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getIdentity, getProfile } from "@/lib/auth/session";
import {profileDestination} from "@/lib/auth/destination";
import { signOut } from "@/app/login/actions";

export default async function AccountSetupPage() {
  if (!(await getIdentity())) redirect("/login");
  const profile = await getProfile();
  if (profile) redirect(profileDestination(profile));
  return <main className="state-page">
    <p className="eyebrow"><T>ACCOUNT ACCESS</T></p>
    <h1><T>Your workspace isn’t ready yet.</T></h1>
    <p className="muted"><T>You are signed in, but we couldn’t load your account profile. Contact your administrator or try again shortly.</T></p>
    <Link className="button button-dark" href="/account/setup"><T>Check again</T></Link>
    <form action={signOut}><button className="button" type="submit"><T>Sign out</T></button></form>
  </main>;
}
