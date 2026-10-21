"use server";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {requireRole} from "@/lib/auth/session";
import {createClient} from "@/lib/supabase/server";
import {createAuthAdminClient,invitationsConfigured} from "@/lib/supabase/admin";
import {appOrigin} from "@/lib/auth/app-origin";
import {driverInviteSchema,type DriverFormState} from "@/lib/drivers/validation";
import {deliverDriverInvitation} from "@/lib/drivers/invitation-delivery";

function rpcMessage(code:string,message:string){
  return ["PT409","PT422","PT429","22023"].includes(code)?message:"Could not update Driver access. Reload and try again.";
}
async function sendInvitation(retryId:string|null,fields?:z.infer<typeof driverInviteSchema>):Promise<DriverFormState>{
  await requireRole("admin");
  if(!invitationsConfigured())return {message:"Driver invitations are not configured. Contact your administrator."};
  try {
    const redirectTo=appOrigin()+"/auth/callback";
    const authAdmin=createAuthAdminClient();
    const client=await createClient();
    const reserved=await client.rpc("reserve_driver_invitation",{p_full_name:fields?.fullName??null,p_email:fields?.email??null,p_phone:fields?.phone??null,p_retry_id:retryId});
    if(reserved.error||!reserved.data)return {message:rpcMessage(reserved.error?.code??"",reserved.error?.message??"")};
    const {data:record,error:lookupError}=await client.from("driver_invitations").select("id,email,full_name,driver_id").eq("id",reserved.data).single();
    if(lookupError||!record)return {message:"Could not load the invitation. Reload and try again."};
    const result=await deliverDriverInvitation(record,redirectTo,{
      getUser:id=>authAdmin.auth.admin.getUserById(id),
      sendRecovery:(email,target)=>authAdmin.auth.resetPasswordForEmail(email,{redirectTo:target}),
      sendInvite:(email,fullName,target)=>authAdmin.auth.admin.inviteUserByEmail(email,{data:{full_name:fullName},redirectTo:target}),
      finalize:async(invitationId,userId)=>{const {error}=await client.rpc("finalize_driver_invitation",{p_invitation_id:invitationId,p_user_id:userId});return {error};},
    });
    revalidatePath("/admin/drivers");
    return result;
  }catch{return {message:"Connection interrupted. Reload the Driver list before retrying."};}
}
export async function inviteDriver(_state:DriverFormState,form:FormData):Promise<DriverFormState>{
  await requireRole("admin");
  const parsed=driverInviteSchema.safeParse(Object.fromEntries(["fullName","email","phone"].map(key=>[key,form.get(key)])));
  if(!parsed.success)return {errors:parsed.error.flatten().fieldErrors};
  return sendInvitation(null,parsed.data);
}
export async function resendDriverInvitation(id:string,_state:DriverFormState):Promise<DriverFormState>{
  await requireRole("admin");
  if(!z.uuid().safeParse(id).success)return {message:"Invitation not found."};
  return sendInvitation(id);
}
export async function changeDriverAccess(id:string,expected:string,enable:boolean,_state:DriverFormState,form:FormData):Promise<DriverFormState>{
  await requireRole("admin");
  if(!z.uuid().safeParse(id).success||!["active","invited","disabled"].includes(expected)||typeof enable!=="boolean")return {message:"Driver not found."};
  if(!enable&&form.get("confirm")!=="on")return {message:"Confirm disabling access"};
  try{
    const client=await createClient();
    const result=await client.rpc("set_driver_access",{p_driver_id:id,p_expected_access:expected,p_enable:enable});
    if(result.error)return {message:rpcMessage(result.error.code,result.error.message)};
    revalidatePath("/admin", "layout");
    return {success:true,message:enable?"Driver access restored.":"Driver access disabled."};
  }catch{return {message:"Could not update Driver access. Reload and try again."};}
}
