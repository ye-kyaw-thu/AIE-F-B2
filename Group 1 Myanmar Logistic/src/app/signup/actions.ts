"use server";

import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {signupSchema,type SignupState} from "@/lib/auth/signup-validation";
import {appOrigin} from "@/lib/auth/app-origin";

export async function signup(_previous:SignupState,form:FormData):Promise<SignupState>{
  const parsed=signupSchema.safeParse(Object.fromEntries(["fullName","email","password","confirmPassword"].map(key=>[key,form.get(key)])));
  if(!parsed.success)return {errors:parsed.error.flatten().fieldErrors};
  let destination:string|null=null;
  try {
    const supabase=await createClient();
    // Roles are assigned by the database trigger. Never accept a role from the form.
    const {data,error}=await supabase.auth.signUp({
      email:parsed.data.email,password:parsed.data.password,
      options:{data:{full_name:parsed.data.fullName},emailRedirectTo:appOrigin()+"/auth/callback"},
    });
    if(error){
      if(error.code==="over_email_send_rate_limit"||error.status===429)return {message:"Too many attempts. Please wait a few minutes before trying again."};
      if(error.code==="weak_password")return {errors:{password:["Choose a stronger password with a mix of letters, numbers and symbols."]}};
      if(error.code==="signup_disabled")return {message:"New registrations are currently closed. Please contact your operations team."};
      if(error.code==="user_already_exists")return {success:true};
      return {message:"We couldn’t complete registration. Try again shortly, or log in if you already have an account."};
    }
    if(data.session)destination="/trader/dashboard";
  }catch{return {message:"Registration is temporarily unavailable. Please try again shortly."};}
  if(destination){revalidatePath("/","layout");redirect(destination);}
  // Same message for new and existing emails; never disclose account existence.
  return {success:true};
}
