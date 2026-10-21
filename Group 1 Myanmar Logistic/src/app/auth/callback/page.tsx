import type {Metadata} from 'next';
import Link from 'next/link';
import {AuthFrame} from '@/components/brand/public-brand';
import {T} from '@/components/i18n/language-provider';
import {EmailConfirmation} from '@/components/auth/email-confirmation';
import {getProfile} from '@/lib/auth/session';
import {profileDestination} from '@/lib/auth/destination';
import {signOut} from '@/app/login/actions';
export const metadata:Metadata={title:'Confirm your email',robots:{index:false,follow:false}};
export default async function CallbackPage(){
  const profile=await getProfile();
  return <AuthFrame><p className="editorial-label"><T>YOUR NEXT JOURNEY</T></p><h1><T>Confirm your email.</T></h1>{profile?<><p><T>You are already signed in. Continue with this account, or sign out and reopen the email link to use another account.</T></p><Link className="button button-dark" href={profileDestination(profile)}><T>Continue to my account</T></Link><form action={signOut}><button className="button signout-button"><T>Sign out</T></button></form></>:<EmailConfirmation/>}<p className="login-footnote"><T>Invited Drivers choose a password after confirming their email. Public signup creates a Trader account.</T></p><Link href="/login"><T>Log in</T></Link></AuthFrame>;
}
