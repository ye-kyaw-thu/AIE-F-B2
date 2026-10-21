"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {createClient} from "@/lib/supabase/server";
import {driverPasswordSchema,type DriverFormState} from "@/lib/drivers/validation";

export async function finishDriverSetup(_state:DriverFormState,form:FormData):Promise<DriverFormState>{
  const parsed=driverPasswordSchema.safeParse({password:form.get("password"),confirmPassword:form.get("confirmPassword")});
  if(!parsed.success)return {errors:parsed.error.flatten().fieldErrors};
  try {
    const client=await createClient();
    const identity=await client.auth.getUser();
    if(!identity.data.user?.email_confirmed_at)return {message:"Confirm your Driver invitation before continuing."};
    const {data:profile}=await client.from("profiles").select("role,driver_access").eq("id",identity.data.user.id).maybeSingle();
    if(!profile||profile.role!=="driver"||profile.driver_access!=="invited")return {message:"Driver access is not ready. Contact your operations team."};
    const password=await client.auth.updateUser({password:parsed.data.password});
    if(password.error)return {message:"Could not set the password. Choose a strong password and try again."};
    const activation=await client.rpc("activate_invited_driver");
    if(activation.error)return {message:"Your password was saved but activation failed. Retry setup or contact Admin."};
  }catch{return {message:"Connection interrupted. Try setting up your account again."};}
  revalidatePath("/","layout");revalidatePath("/admin/drivers");
  redirect("/driver/dashboard");
}
