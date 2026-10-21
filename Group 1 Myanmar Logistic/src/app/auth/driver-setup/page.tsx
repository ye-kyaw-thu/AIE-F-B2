import type {Metadata} from "next";
import {redirect} from "next/navigation";
import {AuthFrame} from "@/components/brand/public-brand";
import {T} from "@/components/i18n/language-provider";
import {DriverPasswordForm} from "@/components/drivers/onboarding-forms";
import {getIdentity,getProfile} from "@/lib/auth/session";
import {profileDestination} from "@/lib/auth/destination";
import {signOut} from "@/app/login/actions";

export const metadata:Metadata={title:"Set Driver password",robots:{index:false,follow:false}};
export default async function DriverSetupPage(){
  const identity=await getIdentity();if(!identity)redirect("/login");
  const profile=await getProfile();if(!profile)redirect("/account/setup");
  if(profile.role!=="driver"||profile.driver_access!=="invited")redirect(profileDestination(profile));
  return <AuthFrame><p className="editorial-label"><T>DRIVER WORKSPACE</T></p><h1><T>Choose your password.</T></h1><p>{profile.full_name}</p>{identity.email_confirmed_at?<DriverPasswordForm/>:<p role="alert"><T>Confirm your Driver invitation before continuing.</T></p>}<form action={signOut}><button className="button signout-button"><T>Sign out</T></button></form></AuthFrame>;
}
