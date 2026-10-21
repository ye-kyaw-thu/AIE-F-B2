import {loadEnvironment,printSafeError} from './lib/environment.mjs';
async function main(){
  const {ref}=loadEnvironment();
  const email=process.argv[2];if(!email||!email.includes('@'))throw new Error('Provide the Driver email to review.');
  if(!process.env.SUPABASE_ACCESS_TOKEN)throw new Error('Supabase management access is required.');
  const emailLiteral="'"+email.replaceAll("'","''")+"'";
  const query=`select p.role,p.driver_access,i.status as invitation_status,
    (u.email_confirmed_at is not null) as email_confirmed,
    (coalesce(u.encrypted_password,'')<>'') as auth_password_hash_present
    from public.profiles p join auth.users u on u.id=p.id
    left join public.driver_invitations i on i.driver_id=p.id where lower(p.email)=lower(${emailLiteral})`;
  const result=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(20000)});
  if(!result.ok)throw new Error('Driver onboarding review failed: '+result.status);
  // Only state and booleans; never Auth tokens, password hashes or email links.
  console.log(JSON.stringify(await result.json(),null,2));
}
main().catch(printSafeError);
