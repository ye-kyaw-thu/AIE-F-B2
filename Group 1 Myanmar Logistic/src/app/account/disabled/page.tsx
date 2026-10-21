import {redirect} from "next/navigation";
import {AuthFrame} from "@/components/brand/public-brand";
import {T} from "@/components/i18n/language-provider";
import {getIdentity,getProfile} from "@/lib/auth/session";
import {profileDestination} from "@/lib/auth/destination";
import {signOut} from "@/app/login/actions";
export default async function DisabledAccountPage(){
  if(!await getIdentity())redirect("/login");
  const profile=await getProfile();if(!profile)redirect("/account/setup");
  if(profile.role!=="driver"||profile.driver_access!=="disabled")redirect(profileDestination(profile));
  return <AuthFrame><h1><T>Driver access is disabled.</T></h1><p><T>Contact your operations team to restore access. Your shipment history is preserved.</T></p><form action={signOut}><button className="button signout-button"><T>Sign out</T></button></form></AuthFrame>;
}
