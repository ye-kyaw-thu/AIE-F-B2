import type {DriverFormState} from './validation';
type ProviderError={status?:number;code?:string};
type ProviderUser={id:string;email?:string;email_confirmed_at?:string};
type ProviderResult={data:{user:ProviderUser|null};error:ProviderError|null};
export type InvitationRecord={id:string;email:string;full_name:string;driver_id:string|null};
type DeliveryPorts={
  getUser:(id:string)=>Promise<ProviderResult>;
  sendRecovery:(email:string,redirectTo:string)=>Promise<{error:ProviderError|null}>;
  sendInvite:(email:string,fullName:string,redirectTo:string)=>Promise<ProviderResult>;
  finalize:(invitationId:string,userId:string)=>Promise<{error:unknown}>;
};
function deliveryError(error:ProviderError|null):DriverFormState{
  if(error?.status===429)return {message:'Too many attempts. Please wait a few minutes before trying again.'};
  if(['email_exists','user_already_exists'].includes(error?.code??''))return {message:'This email already has an account. Reload the Driver list or contact your administrator.'};
  return {message:'Invitation email could not be sent. Check SMTP settings and retry from the invitation list.'};
}
/** Called only after the server action checks Admin access and reserves the attempt in SQL. */
export async function deliverDriverInvitation(record:InvitationRecord,redirectTo:string,ports:DeliveryPorts):Promise<DriverFormState>{
  if(record.driver_id){
    const existing=await ports.getUser(record.driver_id);
    if(existing.error||!existing.data.user||existing.data.user.id!==record.driver_id||existing.data.user.email?.toLowerCase()!==record.email)return {message:'Could not load the invitation. Reload and try again.'};
    if(existing.data.user.email_confirmed_at){
      const recovery=await ports.sendRecovery(record.email,redirectTo);
      return recovery.error?deliveryError(recovery.error):{success:true,message:'Driver password setup email sent. Open the latest email to choose a password.'};
    }
  }
  const result=await ports.sendInvite(record.email,record.full_name,redirectTo);
  if(result.error||!result.data.user)return deliveryError(result.error);
  const finalized=await ports.finalize(record.id,result.data.user.id);
  if(finalized.error)return {message:'The email was sent but Driver access could not be prepared. Contact your administrator before retrying.'};
  return {success:true,message:'Driver invitation sent. They must confirm their email and set a password.'};
}
