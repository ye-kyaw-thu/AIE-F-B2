import {createClient} from '@supabase/supabase-js';
import {loadEnvironment,printSafeError} from './lib/environment.mjs';

const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
async function main(){
  const {ref,url}=loadEnvironment();
  const email=process.argv[2]?.trim().toLowerCase();
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Provide the exact Driver email.');
  if(!process.env.SUPABASE_ACCESS_TOKEN)throw new Error('Management access is required for the safety checks.');
  async function query(sql){
    const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:'POST',headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql}),signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error('Database request failed: '+response.status);
    return response.json();
  }
  const rows=await query(`select u.id,p.role,p.driver_access,
    (select count(*)::int from public.shipments where driver_id=u.id or trader_id=u.id) as shipments,
    (select count(*)::int from public.shipment_updates where driver_id=u.id or actor_id=u.id) as updates,
    (select count(*)::int from public.documents where driver_id=u.id) as documents,
    (select count(*)::int from public.gate_statuses where updated_by=u.id) as gates,
    (select count(*)::int from public.alerts where trader_id=u.id) as alerts,
    (select count(*)::int from public.driver_invitations where invited_by=u.id) as invitations_created,
    (select count(*)::int from public.driver_invitations where driver_id=u.id or email=${literal(email)}) as invitations
    from auth.users u left join public.profiles p on p.id=u.id where lower(u.email)=${literal(email)}`);
  if(rows.length!==1)throw new Error('Expected exactly one existing account; nothing deleted.');
  const row=rows[0];console.log(JSON.stringify(row,null,2));
  if(row.role!=='driver'||row.driver_access!=='invited'||['shipments','updates','documents','gates','alerts','invitations_created'].some(field=>row[field]!==0))throw new Error('Only an unfinished Driver with no operational records can be reset. Nothing deleted.');
  if(!process.argv.includes('--delete')){console.log('Read-only check passed. Add --delete to remove this unfinished account and its invitation.');return;}
  if(!process.env.SUPABASE_SECRET_KEY?.trim())throw new Error('Server-only secret key required for Auth Admin deletion. Nothing deleted.');
  const admin=createClient(url,process.env.SUPABASE_SECRET_KEY.trim(),{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const user=await admin.auth.admin.getUserById(row.id);
  if(user.error||user.data.user?.email?.toLowerCase()!==email)throw new Error('Auth identity did not match. Nothing deleted.');
  // Database guards are repeated immediately before deletion. Operational FKs
  // also prevent Auth deletion if this identity acquires any historical records.
  const invitations=await query(`with target as (
    select id from public.profiles where id=${literal(row.id)}::uuid and role='driver' and driver_access='invited' for update
  ), ready as (
    select id from target t
    where not exists(select 1 from public.shipments where driver_id=t.id or trader_id=t.id)
      and not exists(select 1 from public.shipment_updates where driver_id=t.id or actor_id=t.id)
      and not exists(select 1 from public.documents where driver_id=t.id)
      and not exists(select 1 from public.gate_statuses where updated_by=t.id)
      and not exists(select 1 from public.alerts where trader_id=t.id)
      and not exists(select 1 from public.driver_invitations where invited_by=t.id)
      and not exists(select 1 from public.driver_invitations where (driver_id=t.id or email=${literal(email)}) and status='accepted')
  ) delete from public.driver_invitations
    where (driver_id=${literal(row.id)}::uuid or email=${literal(email)}) and exists(select 1 from ready) returning *`);
  if(invitations.length!==row.invitations)throw new Error('Invitation changed during reset. Auth account was not deleted.');
  const deletion=await admin.auth.admin.deleteUser(row.id,false);
  if(deletion.error){
    // Keep the pending invitation usable if the Auth API refuses deletion.
    if(invitations.length)await query(`insert into public.driver_invitations select * from json_populate_recordset(null::public.driver_invitations,${literal(JSON.stringify(invitations))}::json) on conflict do nothing`);
    throw new Error('Auth deletion failed; invitation restored. No email was sent.');
  }
  const remaining=await query(`select (select count(*)::int from auth.users where id=${literal(row.id)}::uuid) as auth_accounts,
    (select count(*)::int from public.profiles where id=${literal(row.id)}::uuid) as profiles,
    (select count(*)::int from public.driver_invitations where email=${literal(email)} or driver_id=${literal(row.id)}::uuid) as invitations`);
  console.log(JSON.stringify(remaining,null,2));
  if(remaining.some(result=>Object.values(result).some(value=>value!==0)))throw new Error('Deletion verification incomplete. Review the account before reinviting.');
  console.log('Unfinished Driver account and invitation removed. No email sent. Email rate limits are unchanged.');
}
main().catch(printSafeError);
